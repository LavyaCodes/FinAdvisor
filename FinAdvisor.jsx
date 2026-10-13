import { useState } from 'react'
import './FinAdvisor-App.css'

const pages = ['Dashboard', 'Upload Data', 'Spending Insights', 'Anomaly Detection', 'AI Financial Assistant', 'Budget Planner', 'Settings']
const budgetCategories = [
  'Food & Dining', 'Shopping', 'Transportation', 'Education', 'Entertainment',
  'Housing & Rent', 'Bills & Utilities', 'Health & Medical', 'Travel', 'Family',
  'Personal Care', 'EMI & Loans', 'Others', 'Uncategorized',
]
const categoryAliases = {
  food: 'Food & Dining',
  groceries: 'Food & Dining',
  'groceries and restaurants': 'Food & Dining',
  dining: 'Food & Dining',
  restaurant: 'Food & Dining',
  restaurants: 'Food & Dining',
  transport: 'Transportation',
  'transport and transportation': 'Transportation',
  traveling: 'Travel',
  trips: 'Travel',
  emi: 'EMI & Loans',
  'emi and loan': 'EMI & Loans',
  'emi and loans': 'EMI & Loans',
  'emis and loans': 'EMI & Loans',
  loan: 'EMI & Loans',
  loans: 'EMI & Loans',
  other: 'Others',
  uncategorized: 'Uncategorized',
}
const nonExpenseCategoryKeys = new Set([
  'income', 'salary', 'salaries', 'wage', 'wages', 'paycheck', 'earnings',
  'interest income', 'dividend', 'dividends', 'refund', 'refunds',
  'savings and investments', 'savings investment', 'investment', 'investments',
])

function categoryKey(category) {
  return String(category ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const canonicalCategoryByKey = Object.fromEntries(
  budgetCategories.map(category => [categoryKey(category), category]),
)

function normalizeBudgetCategory(rawCategory) {
  const key = categoryKey(rawCategory)
  if (nonExpenseCategoryKeys.has(key)) return null
  if (key === 'other income' || key === 'additional income' || key === 'business income' || key === 'rental income') return null
  if (!key) return 'Uncategorized'
  return categoryAliases[key] ?? canonicalCategoryByKey[key] ?? 'Others'
}

const MIN_ANOMALY_SAMPLE_SIZE = 5

function median(values) {
  const sortedValues = [...values].sort((first, second) => first - second)
  const middleIndex = Math.floor(sortedValues.length / 2)
  if (sortedValues.length % 2 === 1) return sortedValues[middleIndex]
  return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
}

function isValidTransactionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function findExpenseAnomalies(uploadedData) {
  const transactions = Array.isArray(uploadedData?.transactions) ? uploadedData.transactions : []
  let invalidAmountCount = 0
  const expenses = []
  for (const transaction of transactions) {
    const rawAmount = transaction?.amount
    const amount = typeof rawAmount === 'number'
      ? rawAmount
      : typeof rawAmount === 'string' && rawAmount.trim() !== ''
        ? Number(rawAmount)
        : Number.NaN
    if (!Number.isFinite(amount)) {
      invalidAmountCount += 1
      continue
    }
    if (amount < 0) expenses.push({ transaction, amount: Math.abs(amount) })
  }

  if (expenses.length < MIN_ANOMALY_SAMPLE_SIZE) {
    return { status: 'insufficient', expenseCount: expenses.length, invalidAmountCount, anomalies: [] }
  }

  const expenseValues = expenses.map(expense => expense.amount)
  const typicalExpense = median(expenseValues)
  const medianAbsoluteDeviation = median(expenseValues.map(value => Math.abs(value - typicalExpense)))
  const threshold = typicalExpense + (3 * medianAbsoluteDeviation)

  // A zero MAD or invalid/non-increasing threshold cannot distinguish outliers reliably.
  if (!Number.isFinite(medianAbsoluteDeviation) || medianAbsoluteDeviation <= 0
    || !Number.isFinite(threshold) || threshold <= typicalExpense) {
    return {
      status: 'unassessable',
      expenseCount: expenses.length,
      invalidAmountCount,
      typicalExpense,
      medianAbsoluteDeviation,
      anomalies: [],
    }
  }

  const anomalies = expenses
    .filter(expense => expense.amount > threshold)
    .map(({ transaction, amount }) => ({
      description: typeof transaction.description === 'string' && transaction.description.trim()
        ? transaction.description.trim()
        : 'Description unavailable',
      date: isValidTransactionDate(transaction.date) ? transaction.date : null,
      category: normalizeBudgetCategory(transaction.category) ?? 'Others',
      amount,
      threshold,
      typicalExpense,
    }))

  return {
    status: 'assessed',
    expenseCount: expenses.length,
    invalidAmountCount,
    typicalExpense,
    medianAbsoluteDeviation,
    threshold,
    anomalies,
  }
}

function readTransactionAmount(transaction) {
  const rawAmount = transaction?.amount
  if (typeof rawAmount === 'number') return Number.isFinite(rawAmount) ? rawAmount : null
  if (typeof rawAmount === 'string' && rawAmount.trim() !== '') {
    const amount = Number(rawAmount)
    return Number.isFinite(amount) ? amount : null
  }
  return null
}

function findQuestionCategory(question) {
  const questionKey = categoryKey(question)
  const knownNames = [
    ...Object.keys(categoryAliases),
    ...Object.keys(canonicalCategoryByKey),
  ].sort((first, second) => second.length - first.length)

  for (const name of knownNames) {
    if (` ${questionKey} `.includes(` ${name} `)) {
      return normalizeBudgetCategory(name)
    }
  }
  return null
}

function parseQuestionMonth(question) {
  const yearMonth = question.match(/\b(\d{4})-(0[1-9]|1[0-2])\b/)
  if (yearMonth) return `${yearMonth[1]}-${yearMonth[2]}`

  const monthNames = [
    ['january', 'jan'], ['february', 'feb'], ['march', 'mar'], ['april', 'apr'],
    ['may'], ['june', 'jun'], ['july', 'jul'], ['august', 'aug'],
    ['september', 'sep', 'sept'], ['october', 'oct'], ['november', 'nov'], ['december', 'dec'],
  ]
  const normalizedQuestion = categoryKey(question)
  for (let monthIndex = 0; monthIndex < monthNames.length; monthIndex += 1) {
    for (const monthName of monthNames[monthIndex]) {
      const match = normalizedQuestion.match(new RegExp(`\\b${monthName}\\s+(\\d{4})\\b`))
      if (match) return `${match[1]}-${String(monthIndex + 1).padStart(2, '0')}`
      if (new RegExp(`\\b${monthName}\\b`).test(normalizedQuestion)) return 'missing-year'
    }
  }
  return null
}

function answerTransactionQuestion(question, uploadedData) {
  if (!uploadedData || !Array.isArray(uploadedData.transactions)) {
    return 'Please upload a CSV statement first. The assistant can answer using transactions available in this session.'
  }

  const transactions = uploadedData.transactions
  const validRecords = []
  const invalidAmountRecords = []
  let invalidAmountCount = 0
  for (const transaction of transactions) {
    const amount = readTransactionAmount(transaction)
    if (amount === null) {
      invalidAmountCount += 1
      invalidAmountRecords.push(transaction)
      continue
    }
    validRecords.push({ transaction, amount })
  }

  const normalizedQuestion = categoryKey(question)
  const asksLargest = /\b(largest|biggest|highest)\b/.test(normalizedQuestion)
    && /\b(expense|spend|spending|purchase|transaction)\b/.test(normalizedQuestion)
  const asksCategorySpend = /\b(spend|spent|spending|expense|expenses)\b/.test(normalizedQuestion)
    && /\b(how much|total|what|show|tell)\b/.test(normalizedQuestion)
  const asksMonthly = /\b(month|monthly|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|\d{4}\s+\d{2})\b/.test(normalizedQuestion)
  const asksIncome = /\b(income|earned|earnings)\b/.test(normalizedQuestion)
  const asksExpense = /\b(expense|expenses|spending|spent)\b/.test(normalizedQuestion)
  const asksNet = /\b(net|balance)\b/.test(normalizedQuestion)
  const month = parseQuestionMonth(question)

  if (asksLargest) {
    if (validRecords.length === 0 && invalidAmountCount > 0) {
      return `I cannot identify the largest expense because all ${invalidAmountCount} transaction amount(s) in this upload are missing or invalid.`
    }
    const expenses = validRecords.filter(record => record.amount < 0)
    if (expenses.length === 0) return 'I could not find any valid expense transactions in this upload.'
    const largestAmount = Math.max(...expenses.map(record => Math.abs(record.amount)))
    const largestTransactions = expenses.filter(record => Math.abs(record.amount) === largestAmount)
    const descriptions = largestTransactions.map(({ transaction }) => (
      typeof transaction.description === 'string' && transaction.description.trim()
        ? transaction.description.trim()
        : 'Description unavailable'
    ))
    const dates = largestTransactions.map(({ transaction }) => (
      isValidTransactionDate(transaction.date) ? transaction.date : null
    ))
    const dateText = dates.some(Boolean) ? ` Date: ${dates.filter(Boolean).join(', ')}.` : ' A valid date was not available.'
    const invalidNote = invalidAmountCount ? ` ${invalidAmountCount} record(s) with invalid amounts were excluded.` : ''
    return `Your largest expense${largestTransactions.length > 1 ? 's were' : ' was'} ${descriptions.join(', ')} at ${formatAmount(largestAmount)}.${dateText}${invalidNote}`
  }

  if (asksCategorySpend && !asksMonthly && !asksIncome && !asksNet) {
    const category = findQuestionCategory(question)
    if (!category) return 'Which expense category do you mean? Try a category such as Food & Dining, Transportation, or Travel.'
    const expenses = validRecords.filter(record => record.amount < 0
      && normalizeBudgetCategory(record.transaction.category) === category)
    if (expenses.length === 0) return `I could not find valid expenses for ${category} in this upload.`
    const total = expenses.reduce((sum, record) => sum + Math.abs(record.amount), 0)
    const invalidNote = invalidAmountCount ? ` ${invalidAmountCount} record(s) with invalid amounts were excluded.` : ''
    return `Your recorded spending in ${category} is ${formatAmount(total)} across ${expenses.length} expense transaction(s).${invalidNote}`
  }

  if (asksCategorySpend && asksMonthly && !asksIncome && !asksNet) {
    return 'I can total a category across the uploaded transactions, or overall income, expenses, and balance for a month. Monthly category totals are not available in this assistant yet.'
  }

  if (asksMonthly || asksIncome || asksNet || (asksExpense && /\b(total|all|overall)\b/.test(normalizedQuestion))) {
    if (asksMonthly && !month) {
      return 'Which month and year should I use? Please specify both, for example “January 2026” or “2026-01”.'
    }
    if (month === 'missing-year') {
      return 'Which year should I use for that month? Please specify the month and year, for example “January 2026”.'
    }
    const datedRecordsInMonth = month
      ? transactions.filter(transaction => isValidTransactionDate(transaction?.date)
        && transaction.date.slice(0, 7) === month)
      : []
    const invalidAmountsInMonth = month
      ? invalidAmountRecords.filter(transaction => isValidTransactionDate(transaction?.date)
        && transaction.date.slice(0, 7) === month).length
      : invalidAmountCount
    const scopedRecords = month
      ? validRecords.filter(({ transaction }) => isValidTransactionDate(transaction.date)
        && transaction.date.slice(0, 7) === month)
      : validRecords
    if (!month && scopedRecords.length === 0 && invalidAmountCount > 0) {
      return `I cannot calculate overall totals because all ${invalidAmountCount} transaction amount(s) in this upload are missing or invalid.`
    }
    if (month && datedRecordsInMonth.length === 0) {
      return `I could not find transactions with valid dates for ${formatMonthLabel(month)}. I cannot determine that month's totals from this upload.`
    }
    if (month && scopedRecords.length === 0 && invalidAmountsInMonth > 0) {
      return `I cannot calculate totals for ${formatMonthLabel(month)} because all ${invalidAmountsInMonth} dated transaction amount(s) for that month are missing or invalid.`
    }
    if (month && scopedRecords.length === 0) {
      return `I could not find transactions with valid dates for ${formatMonthLabel(month)}. I cannot determine that month's totals from this upload.`
    }
    const income = scopedRecords.reduce((sum, record) => sum + (record.amount > 0 ? record.amount : 0), 0)
    const expenses = scopedRecords.reduce((sum, record) => sum + (record.amount < 0 ? Math.abs(record.amount) : 0), 0)
    const balance = income - expenses
    const scopeLabel = month ? ` for ${formatMonthLabel(month)}` : ' across all uploaded transactions'
    const invalidDateCount = month
      ? validRecords.filter(({ transaction }) => !isValidTransactionDate(transaction.date)).length
      : 0
    const notes = []
    if (invalidAmountsInMonth) notes.push(`${invalidAmountsInMonth} invalid amount record(s) were excluded`)
    if (invalidDateCount) notes.push(`${invalidDateCount} record(s) with missing or invalid dates were excluded from this month`)
    return `Recorded totals${scopeLabel}: income ${formatAmount(income)}, expenses ${formatAmount(expenses)}, and net balance ${formatAmount(balance)}.${notes.length ? ` ${notes.join('; ')}.` : ''}`
  }

  return 'I can answer questions about your largest expense, spending in a category, or income, expenses, and net balance for a specified month or all uploaded transactions. Please rephrase your question using one of those topics.'
}

function App() {
  const [screen, setScreen] = useState('landing')
  const [activePage, setActivePage] = useState('Dashboard')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadedData, setUploadedData] = useState(null)
  const [categoryBudgets, setCategoryBudgets] = useState({})
  const [settings, setSettings] = useState({ name: '', email: '', income: '', monthlyBudget: '', savingsGoal: '' })

  const enterApp = () => { setScreen('app'); setActivePage('Dashboard') }
  const logout = () => { setScreen('landing'); setActivePage('Dashboard') }

  if (screen === 'landing') return <LandingPage onStart={() => setScreen('login')} />
  if (screen === 'login') return <LoginPage onBack={() => setScreen('landing')} onLogin={enterApp} />

  return (
    <div className="app">
      <Sidebar activePage={activePage} onNavigate={setActivePage} onLogout={logout} />
      <main className="main-content">
        {activePage === 'Dashboard' && <DashboardPage onNavigate={setActivePage} uploadedData={uploadedData} />}
        {activePage === 'Upload Data' && <UploadPage selectedFile={selectedFile} setSelectedFile={setSelectedFile} uploadedData={uploadedData} setUploadedData={setUploadedData} />}
        {activePage === 'Spending Insights' && <AnalysisPage uploadedData={uploadedData} />}
        {activePage === 'Anomaly Detection' && <AnomalyDetectionPage uploadedData={uploadedData} />}
        {activePage === 'AI Financial Assistant' && <FinancialAssistantPage uploadedData={uploadedData} />}
        {activePage === 'Budget Planner' && <BudgetPage uploadedData={uploadedData} categoryBudgets={categoryBudgets} setCategoryBudgets={setCategoryBudgets} />}
        {activePage === 'Settings' && <SettingsPage settings={settings} setSettings={setSettings} />}
      </main>
    </div>
  )
}

function LandingPage({ onStart }) {
  return <div className="landing-page">
    <nav className="navbar"><div className="logo">FinAdvisor</div><div className="nav-links"><a href="#features">Features</a><a href="#how">How it works</a><a href="#about">About</a><button className="login-btn" onClick={onStart}>Login</button></div></nav>
    <section className="hero"><div className="hero-text"><h1>Take control of your <span>finances.</span></h1><p>Understand your spending, plan your budget and make more informed financial decisions with FinAdvisor.</p><button className="primary-btn" onClick={onStart}>Get Started</button></div><div className="hero-card"><h3>Financial Overview</h3><div className="preview-row"><span>Total Expenses</span><strong>—</strong></div><div className="preview-row"><span>Financial Health</span><strong>— / 100</strong></div><div className="preview-bar"><div style={{ width: '0%' }} /></div><p className="muted-note">Your overview will appear after financial data is connected.</p></div></section>
    <section className="features-section" id="features"><h2>Powerful Financial Tools</h2><div className="feature-grid"><div className="feature-card"><h3>📊 Expense Analysis</h3><p>Explore category-wise spending once your data is available.</p></div><div className="feature-card"><h3>💰 Budget Planner</h3><p>Set a monthly budget and organize category limits.</p></div><div className="feature-card"><h3>📈 Spending Insights</h3><p>Review clear observations based on your uploaded transaction data.</p></div></div></section>
    <section className="how-section" id="how"><h2>How It Works</h2><div className="steps"><div><span>1</span><h3>Add Your Data</h3><p>Upload your bank statement in CSV format.</p></div><div><span>2</span><h3>Analyze</h3><p>Review your spending analysis when data is processed.</p></div><div><span>3</span><h3>Plan</h3><p>Use the dashboard and budget tools to plan ahead.</p></div></div></section>
    <section className="about-section" id="about"><h2>About FinAdvisor</h2><p>FinAdvisor is a student project designed to make personal finance management simple, visual and accessible.</p></section><footer>© 2026 FinAdvisor. All rights reserved.</footer>
  </div>
}

function LoginPage({ onBack, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return <div className="login-page"><button className="back-button" onClick={onBack}>← Back</button><form className="login-card" onSubmit={e => { e.preventDefault(); onLogin() }}><div className="logo">FinAdvisor</div><h2>Welcome back</h2><p>Sign in to continue to your dashboard.</p><label>Email address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required /><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required /><button className="primary-button" type="submit">Sign In</button><p className="muted-note">Frontend demo only — authentication will be connected by the backend team.</p></form></div>
}

function Sidebar({ activePage, onNavigate, onLogout }) {
  return <aside className="sidebar"><div className="brand"><div className="brand-icon">F</div><strong>FinAdvisor</strong></div><nav className="sidebar-nav">{pages.map((page, i) => <button key={page} className={`option-button ${activePage === page ? 'active' : ''}`} onClick={() => onNavigate(page)}><span>{['▦', '⇧', '◉', '!', '✦', '◫', '⚙'][i]}</span>{page}</button>)}</nav><div className="user-card"><div className="user-avatar">U</div><div><strong>User</strong><small>Personal Finance</small></div></div><button className="option-button logout-button" onClick={onLogout}>↪ Log out</button></aside>
}

function PageHeader({ title, subtitle, action }) { return <header className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</header> }
function EmptyState({ title, message }) { return <div className="empty-state"><div className="empty-icon">◌</div><h3>{title}</h3><p>{message}</p></div> }

function DashboardPage({ onNavigate, uploadedData }) {
  const categoryExpenses = uploadedData?.category_expenses ?? {}
  const categoryEntries = Object.entries(categoryExpenses)
  const largestCategoryExpense = Math.max(0, ...Object.values(categoryExpenses))

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your financial overview at a glance."
        action={
          <button className="primary-button" onClick={() => onNavigate('Upload Data')}>
            ＋ Upload Data
          </button>
        }
      />

      <section className="summary-grid">
        <SummaryCard
          title="Net Balance"
          value={uploadedData ? formatAmount(uploadedData.net_balance) : '—'}
          note={uploadedData ? 'Income minus expenses in this upload' : 'Connect your data to view balance'}
          icon="◈"
        />
        <SummaryCard
          title="Total Income"
          value={uploadedData ? formatAmount(uploadedData.total_income) : '—'}
          note={uploadedData ? 'From uploaded transactions' : 'No data available'}
          icon="↗"
        />
        <SummaryCard
          title="Total Expenses"
          value={uploadedData ? formatAmount(uploadedData.total_expenses) : '—'}
          note={uploadedData ? 'From uploaded transactions' : 'No data available'}
          icon="↘"
        />
        <SummaryCard title="Financial Health" value="— / 100" note="Awaiting analysis" icon="♡" />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-title">
            <h3>Spending Overview</h3>
            <span>By category</span>
          </div>
          {!uploadedData ? (
            <EmptyState
              title="No spending data yet"
              message="Upload a CSV statement to display your spending breakdown here."
            />
          ) : categoryEntries.length === 0 ? (
            <EmptyState
              title="No expenses recorded"
              message="This upload has no expense transactions to group by category."
            />
          ) : (
            <CategoryBreakdown categories={categoryEntries} largestExpense={largestCategoryExpense} />
          )}
        </div>

        <div className="panel health-panel">
          <div className="panel-title"><h3>Financial Health Score</h3></div>
          <div className="score-circle"><span>—</span><small>out of 100</small></div>
          <p className="muted-note">Your score will appear after the analysis service is connected.</p>
        </div>
      </section>

      <section className="panel transactions-panel">
        <div className="panel-title">
          <h3>Uploaded Transactions</h3>
          <button className="text-button" onClick={() => onNavigate('Upload Data')}>Upload data</button>
        </div>
        {uploadedData ? (
          <>
            <p className="transaction-count">
              {uploadedData.transaction_count} transaction{uploadedData.transaction_count === 1 ? '' : 's'}
            </p>
            <TransactionTable transactions={uploadedData.transactions} />
          </>
        ) : (
          <EmptyState
            title="No transactions to show"
            message="Your uploaded transactions will appear here after data is processed."
          />
        )}
      </section>
    </>
  )
}
function SummaryCard({ title, value, note, icon }) { return <div className="summary-card"><div className="summary-card-top"><span>{title}</span><span className="summary-icon">{icon}</span></div><h2>{value}</h2><p>{note}</p></div> }

function formatAmount(amount) {
  const value = Number(amount)
  const formattedValue = Math.abs(value).toFixed(2)
  return value < 0 ? `−₹${formattedValue}` : `₹${formattedValue}`
}

function CategoryBreakdown({ categories, largestExpense }) {
  return (
    <div className="category-breakdown" aria-label="Expenses by category">
      {categories.map(([category, amount]) => (
        <div className="category-breakdown-item" key={category}>
          <div className="category-breakdown-label">
            <span>{category}</span>
            <strong>{formatAmount(amount)}</strong>
          </div>
          <div
            className="category-bar"
            role="progressbar"
            aria-label={`${category} spending`}
            aria-valuemin="0"
            aria-valuemax={largestExpense}
            aria-valuenow={amount}
          >
            <div
              className="category-bar-fill"
              style={{ width: `${largestExpense ? (amount / largestExpense) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function TransactionTable({ transactions }) {
  return (
    <div className="transaction-table-wrap">
      <table className="transaction-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr key={`${transaction.date}-${index}`}>
              <td>{transaction.date}</td>
              <td>{transaction.description || '—'}</td>
              <td>{transaction.category}</td>
              <td className={transaction.amount < 0 ? 'transaction-expense' : 'transaction-income'}>
                {formatAmount(transaction.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UploadPage({ selectedFile, setSelectedFile, uploadedData, setUploadedData }) {
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    setSelectedFile(file || null)
    setUploadedData(null)
    setStatus('')
  }

  const handleContinue = async () => {
    if (!selectedFile) {
      setStatus('Please choose a CSV file first.')
      return
    }

    setIsLoading(true)
    setStatus('')
    setUploadedData(null)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${apiUrl}/transactions/upload`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.detail || 'The CSV could not be processed.')
      }
      setUploadedData(result)
      setStatus('CSV processed successfully. Results are available for this session only.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to connect to the upload service.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Upload Data"
        subtitle="Choose a CSV bank statement to begin. The backend will validate and summarize the file."
      />

      <div className="upload-layout">
        <section className="panel upload-box">
          <div className="upload-icon">⇧</div>
          <h2>Upload your bank statement</h2>
          <p>
            Choose a CSV file from your device. Your statement is processed in memory and is not stored.
          </p>

          <label className="file-button">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
            />
          </label>

          {selectedFile && (
            <div className="selected-file">
              Selected file: {selectedFile.name}
            </div>
          )}

          <button
            className="primary-button"
            type="button"
            onClick={handleContinue}
            disabled={isLoading}
          >
            {isLoading ? 'Processing…' : 'Continue'}
          </button>

          {status && (
            <p className="notification" role={uploadedData ? 'status' : 'alert'}>
              {status}
            </p>
          )}

          {uploadedData && (
            <div className="upload-summary" aria-label="Transaction summary">
              <p>Total income: {formatAmount(uploadedData.total_income)}</p>
              <p>Total expenses: {formatAmount(uploadedData.total_expenses)}</p>
              <p>Net balance: {formatAmount(uploadedData.net_balance)}</p>
              <p>Transactions: {uploadedData.transaction_count}</p>
            </div>
          )}

          <small>Accepted format: .CSV</small>
        </section>

        <aside className="panel side-info">
          <h3>Before you upload</h3>
          <ul>
            <li>Use a CSV bank statement.</li>
            <li>Review the file before sharing it.</li>
          </ul>
        </aside>
      </div>
    </>
  )
}

function getExpenseInsights(uploadedData) {
  const categoryTotals = {}
  const monthTotals = {}
  let expensesWithoutValidDate = 0
  const transactions = uploadedData?.transactions ?? []

  for (const transaction of transactions) {
    const amount = Number(transaction.amount)
    if (!Number.isFinite(amount) || amount >= 0) continue

    // Reuse the Budget Planner's canonical category mapping for consistent totals.
    const category = normalizeBudgetCategory(transaction.category)
    if (!category) continue
    const expense = Math.abs(amount)
    categoryTotals[category] = (categoryTotals[category] ?? 0) + expense

    // Invalid/missing dates still contribute to category totals, but not monthly trends.
    const date = String(transaction.date ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      expensesWithoutValidDate += 1
      continue
    }
    const parsedDate = new Date(`${date}T00:00:00Z`)
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      expensesWithoutValidDate += 1
      continue
    }

    const month = date.slice(0, 7)
    monthTotals[month] = (monthTotals[month] ?? 0) + expense
  }

  const categoriesBySpend = Object.entries(categoryTotals)
    .sort(([categoryA, amountA], [categoryB, amountB]) => amountB - amountA || categoryA.localeCompare(categoryB))
  const monthlySpending = Object.entries(monthTotals)
    .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
  const totalExpenses = categoriesBySpend.reduce((total, [, amount]) => total + amount, 0)

  return {
    categories: categoriesBySpend,
    monthlySpending,
    expensesWithoutValidDate,
    totalExpenses,
    topCategory: categoriesBySpend[0] ?? null,
  }
}

function AnalysisPage({ uploadedData }) {
  const insights = getExpenseInsights(uploadedData)
  const topCategoryShare = insights.topCategory && insights.totalExpenses > 0
    ? (insights.topCategory[1] / insights.totalExpenses) * 100
    : 0

  return (
    <>
      <PageHeader
        title="Spending Insights"
        subtitle="Explore expense categories and monthly changes based on your uploaded transactions."
      />

      {!uploadedData ? (
        <section className="panel insights-empty-panel">
          <EmptyState
            title="No transaction data yet"
            message="Upload a CSV statement to see category spending and monthly trends here."
          />
        </section>
      ) : insights.totalExpenses === 0 ? (
        <section className="panel insights-empty-panel">
          <EmptyState
            title="No expenses to analyze"
            message="This upload has no negative expense transactions. Income is not included in spending insights."
          />
        </section>
      ) : (
        <>
          <section className="summary-grid insights-summary-grid">
            <SummaryCard title="Total Expenses" value={formatAmount(insights.totalExpenses)} note="Negative transactions only" icon="↘" />
            <SummaryCard title="Highest-Spending Category" value={insights.topCategory[0]} note={`${formatAmount(insights.topCategory[1])} in expenses`} icon="▤" />
            <SummaryCard title="Months with Dated Expenses" value={insights.monthlySpending.length} note="Used for the monthly trend" icon="▥" />
          </section>

          <section className="insights-grid">
            <div className="panel insights-panel">
              <div className="panel-title">
                <h3>Expense Distribution</h3>
                <span>{formatAmount(insights.totalExpenses)} total</span>
              </div>
              <p className="insights-caption">Share of expenses by normalized category. The largest category is highlighted.</p>
              <CategorySpendingChart
                categories={insights.categories}
                totalExpenses={insights.totalExpenses}
                topCategory={insights.topCategory[0]}
              />
            </div>

            <div className="panel insights-panel">
              <div className="panel-title"><h3>Monthly Spending Trend</h3></div>
              {insights.monthlySpending.length >= 2 ? (
                <>
                  <MonthlySpendingChart months={insights.monthlySpending} />
                  <p className="insights-observation" role="status">
                    {describeMonthlyChange(insights.monthlySpending)}
                  </p>
                </>
              ) : (
                <EmptyState
                  title="Not enough dated months"
                  message="At least two distinct months with valid dated expenses are needed to show a spending trend."
                />
              )}
              {insights.expensesWithoutValidDate > 0 && (
                <p className="insights-date-note" role="note">
                  {insights.expensesWithoutValidDate} expense transaction{insights.expensesWithoutValidDate === 1 ? ' has' : 's have'} missing or invalid dates. {insights.expensesWithoutValidDate === 1 ? 'It remains' : 'They remain'} included in category totals but are omitted from the monthly trend.
                </p>
              )}
            </div>
          </section>

          <section className="panel insights-observations">
            <h3>What stands out</h3>
            <p role="status">
              {insights.topCategory[0]} is your highest-spending category at {formatAmount(insights.topCategory[1])}
              {' '}({topCategoryShare.toFixed(1)}% of recorded expenses).
            </p>
            <p className="muted-note">These observations are calculated from this session's uploaded transactions; no AI analysis is used.</p>
          </section>
        </>
      )}
    </>
  )
}

function CategorySpendingChart({ categories: categoryEntries, totalExpenses, topCategory }) {
  return (
    <ol className="insights-category-chart" aria-label="Expense distribution by category">
      {categoryEntries.map(([category, amount]) => {
        const share = (amount / totalExpenses) * 100
        const isTopCategory = category === topCategory
        return (
          <li className={`insights-category-row ${isTopCategory ? 'top-spending-category' : ''}`} key={category}>
            <div className="insights-category-label">
              <span>{category}{isTopCategory && <span className="top-category-badge">Highest</span>}</span>
              <strong>{formatAmount(amount)} <small>({share.toFixed(1)}%)</small></strong>
            </div>
            <div
              className="insights-category-track"
              role="progressbar"
              aria-label={`${category} share of expenses`}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Number(share.toFixed(1))}
            >
              <div className="insights-category-fill" style={{ width: `${share}%` }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function MonthlySpendingChart({ months }) {
  const highestMonthSpend = Math.max(...months.map(([, amount]) => amount))

  return (
    <ol className="monthly-spending-chart" aria-label="Monthly expenses">
      {months.map(([month, amount]) => {
        const share = highestMonthSpend > 0 ? (amount / highestMonthSpend) * 100 : 0
        return (
          <li className="monthly-spending-column" key={month}>
            <strong>{formatAmount(amount)}</strong>
            <div
              className="monthly-spending-track"
              role="progressbar"
              aria-label={`${formatMonthLabel(month)} expenses`}
              aria-valuemin="0"
              aria-valuemax={highestMonthSpend}
              aria-valuenow={amount}
            >
              <div className="monthly-spending-fill" style={{ height: `${share}%` }} />
            </div>
            <span>{formatMonthLabel(month)}</span>
          </li>
        )
      })}
    </ol>
  )
}

function describeMonthlyChange(months) {
  const [firstMonth, firstAmount] = months[0]
  const [lastMonth, lastAmount] = months[months.length - 1]
  const difference = lastAmount - firstAmount
  if (difference === 0) {
    return `Spending was unchanged at ${formatAmount(lastAmount)} from ${formatMonthLabel(firstMonth)} to ${formatMonthLabel(lastMonth)}.`
  }
  if (firstAmount === 0) {
    return `Spending increased from ${formatAmount(firstAmount)} in ${formatMonthLabel(firstMonth)} to ${formatAmount(lastAmount)} in ${formatMonthLabel(lastMonth)}.`
  }

  const changePercent = Math.abs((difference / firstAmount) * 100).toFixed(1)
  const direction = difference > 0 ? 'increased' : 'decreased'
  return `Spending ${direction} ${changePercent}% from ${formatAmount(firstAmount)} in ${formatMonthLabel(firstMonth)} to ${formatAmount(lastAmount)} in ${formatMonthLabel(lastMonth)}.`
}

function AnomalyDetectionPage({ uploadedData }) {
  const analysis = findExpenseAnomalies(uploadedData)

  return (
    <>
      <PageHeader
        title="Anomaly Detection"
        subtitle="Review expenses that are unusually large compared with this upload."
      />
      <p className="anomaly-method-note" role="note">
        This local check considers only finite, negative expense amounts. It flags expenses above the median plus three median absolute deviations (MAD), and requires at least {MIN_ANOMALY_SAMPLE_SIZE} expenses. A flag means unusually large relative to this upload; it does not indicate fraud or misconduct.
      </p>

      {!uploadedData ? (
        <section className="panel anomaly-empty-panel">
          <EmptyState
            title="No transaction data yet"
            message="Upload a CSV statement to check for unusually large expenses."
          />
        </section>
      ) : analysis.status === 'insufficient' ? (
        <section className="panel anomaly-empty-panel">
          <EmptyState
            title="Not enough expenses to assess"
            message={`At least ${MIN_ANOMALY_SAMPLE_SIZE} valid expense transactions are needed for this comparison. This upload has ${analysis.expenseCount}. No statistical conclusion is made.`}
          />
        </section>
      ) : analysis.status === 'unassessable' ? (
        <section className="panel anomaly-empty-panel">
          <EmptyState
            title="Expense pattern cannot be assessed reliably"
            message={`The median absolute deviation is zero or does not produce a useful threshold across ${analysis.expenseCount} expenses. No anomalies are claimed.`}
          />
        </section>
      ) : analysis.anomalies.length === 0 ? (
        <section className="panel anomaly-empty-panel">
          <EmptyState
            title="No unusually large expenses found"
            message={`None of the ${analysis.expenseCount} expenses exceeded the data-based threshold of ${formatAmount(analysis.threshold)}.`}
          />
        </section>
      ) : (
        <section className="panel anomaly-results" aria-labelledby="anomaly-results-heading">
          <div className="panel-title anomaly-results-title">
            <h3 id="anomaly-results-heading">Flagged expenses</h3>
            <span>{analysis.anomalies.length} flagged</span>
          </div>
          <p className="anomaly-results-intro">
            Threshold: {formatAmount(analysis.threshold)} · Median expense: {formatAmount(analysis.typicalExpense)} · MAD: {formatAmount(analysis.medianAbsoluteDeviation)}
          </p>
          <div className="anomaly-list">
            {analysis.anomalies.map((anomaly, index) => (
              <article className="anomaly-item" key={`${anomaly.date ?? 'no-date'}-${index}`}>
                <div className="anomaly-item-heading">
                  <h4>{anomaly.description}</h4>
                  <strong>{formatAmount(anomaly.amount)}</strong>
                </div>
                <dl className="anomaly-details">
                  <div><dt>Date</dt><dd>{anomaly.date ?? 'Date unavailable'}</dd></div>
                  <div><dt>Category</dt><dd>{anomaly.category}</dd></div>
                </dl>
                <p className="anomaly-reason" role="status">
                  This expense is above the {formatAmount(analysis.threshold)} threshold (median {formatAmount(analysis.typicalExpense)} + 3 × MAD {formatAmount(analysis.medianAbsoluteDeviation)}), so it is unusually large relative to this upload.
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {analysis.invalidAmountCount > 0 && (
        <p className="anomaly-invalid-note" role="note">
          {analysis.invalidAmountCount} transaction amount{analysis.invalidAmountCount === 1 ? ' was' : 's were'} missing or invalid and excluded from this check.
        </p>
      )}
    </>
  )
}

const assistantSuggestions = [
  'What was my largest expense?',
  'How much did I spend on food?',
  'What were my total income, expenses, and net balance for January 2026?',
  'What are my total income, expenses, and net balance across all transactions?',
]

function FinancialAssistantPage({ uploadedData }) {
  const [question, setQuestion] = useState('')
  const [conversation, setConversation] = useState([])

  const askQuestion = (submittedQuestion) => {
    const cleanedQuestion = submittedQuestion.trim()
    if (!cleanedQuestion) return
    const answer = answerTransactionQuestion(cleanedQuestion, uploadedData)
    setConversation(currentConversation => [
      ...currentConversation,
      { question: cleanedQuestion, answer },
    ])
    setQuestion('')
  }

  return (
    <>
      <PageHeader
        title="AI Financial Assistant"
        subtitle="Ask questions about the transactions you uploaded in this session."
      />

      <section className="panel assistant-panel" aria-labelledby="assistant-panel-heading">
        <div className="assistant-local-banner" role="note">
          <strong>Local, rule-based assistant</strong>
          <span>Answers are calculated from your session data. No transaction data is sent to an external AI provider; no generative AI model is used.</span>
        </div>

        {!uploadedData && (
          <div className="assistant-upload-prompt" role="status">
            Upload a CSV statement first. Your transaction data will stay in this browser session.
          </div>
        )}

        <div className="assistant-suggestions" aria-label="Suggested questions">
          {assistantSuggestions.map(suggestion => (
            <button
              className="assistant-suggestion"
              key={suggestion}
              type="button"
              onClick={() => askQuestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="assistant-conversation" aria-label="Assistant conversation" aria-live="polite">
          {conversation.length === 0 ? (
            <div className="assistant-welcome" id="assistant-panel-heading">
              <h3>What would you like to know?</h3>
              <p>Ask about an expense, a normalized category, or totals for a month or all uploaded transactions.</p>
            </div>
          ) : conversation.map((entry, index) => (
            <div className="assistant-exchange" key={`${index}-${entry.question}`}>
              <div className="assistant-message assistant-question">
                <span className="assistant-message-label">You</span>
                <p>{entry.question}</p>
              </div>
              <div className="assistant-message assistant-answer">
                <span className="assistant-message-label">FinAdvisor · calculated from transactions</span>
                <p>{entry.answer}</p>
              </div>
            </div>
          ))}
        </div>

        <form
          className="assistant-question-form"
          onSubmit={event => {
            event.preventDefault()
            askQuestion(question)
          }}
        >
          <label htmlFor="assistantQuestion">Your question</label>
          <div className="assistant-input-row">
            <input
              id="assistantQuestion"
              type="text"
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder="e.g. How much did I spend on food?"
              autoComplete="off"
            />
            <button className="primary-button" type="submit" disabled={!question.trim()}>
              Ask
            </button>
          </div>
        </form>
      </section>
    </>
  )
}

function BudgetPage({ uploadedData, categoryBudgets, setCategoryBudgets }) {
  const uploadedMonths = [...new Set(
    (uploadedData?.transactions ?? []).map(transaction => transaction.date.slice(0, 7)),
  )].sort()
  const [selectedMonth, setSelectedMonth] = useState('')
  const activeMonth = uploadedMonths.includes(selectedMonth)
    ? selectedMonth
    : uploadedMonths[uploadedMonths.length - 1] ?? ''
  const availableCategories = budgetCategories
  const expenses = {}

  // Upload amounts use negative values for expenses; positive income is intentionally skipped.
  if (uploadedData && activeMonth) {
    for (const transaction of uploadedData.transactions) {
      const transactionMonth = transaction.date.slice(0, 7)
      if (transactionMonth !== activeMonth || transaction.amount >= 0) continue

      const category = normalizeBudgetCategory(transaction.category)
      if (!category) continue
      expenses[category] = (expenses[category] ?? 0) + Math.abs(transaction.amount)
    }
  }

  const updateBudget = (category, value) => {
    setCategoryBudgets(currentBudgets => ({ ...currentBudgets, [category]: value }))
  }

  return (
    <>
      <PageHeader
        title="Budget Planner"
        subtitle="Set a monthly limit for each category and compare it with your uploaded spending."
      />

      <p className="budget-session-note" role="note">
        Budgets are saved in this app session only. They are not permanently stored and will reset when you reload the app.
      </p>

      {uploadedMonths.length > 0 && (
        <div className="budget-month-control">
          <label htmlFor="budgetMonth">Spending month</label>
          <select
            id="budgetMonth"
            value={activeMonth}
            onChange={event => setSelectedMonth(event.target.value)}
          >
            {uploadedMonths.map(month => (
              <option key={month} value={month}>{formatMonthLabel(month)}</option>
            ))}
          </select>
        </div>
      )}

      {!uploadedData && (
        <p className="budget-empty-note" role="status">
          Upload a CSV to compare your limits with expenses. You can set category budgets now.
        </p>
      )}

      <section className="budget-grid">
        <div className="panel budget-card">
          <h3>Monthly Category Limits</h3>
          <p>Enter a spending limit for the categories you want to track.</p>
          <div className="budget-input-list">
            {availableCategories.map(category => (
              <div className="budget-input-row" key={category}>
                <label htmlFor={`budget-${category}`}>{category}</label>
                <div className="budget-input-control">
                  <span aria-hidden="true">₹</span>
                  <input
                    id={`budget-${category}`}
                    aria-label={`Budget for ${category}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="No limit"
                    value={categoryBudgets[category] ?? ''}
                    onChange={event => {
                      const value = event.target.value
                      if (value === '' || Number(value) >= 0) updateBudget(category, value)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel budget-card budget-comparison-card">
          <h3>Spending vs. Budget</h3>
          {uploadedData ? (
            <>
              <p>Comparing expenses in {formatMonthLabel(activeMonth)} with your monthly limits.</p>
              <div className="budget-comparison-list">
                {availableCategories.map(category => (
                  <BudgetComparison
                    key={category}
                    category={category}
                    spent={expenses[category] ?? 0}
                    budgetValue={categoryBudgets[category]}
                  />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No uploaded spending yet"
              message="Your category comparisons will appear here after you upload transaction data."
            />
          )}
        </div>
      </section>
    </>
  )
}

function formatMonthLabel(month) {
  if (!month) return 'No month selected'
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
    .format(new Date(`${month}-01T00:00:00`))
}

function BudgetComparison({ category, spent, budgetValue }) {
  const hasBudget = budgetValue !== undefined && budgetValue !== ''
  const budget = hasBudget ? Number(budgetValue) : null
  const remaining = hasBudget ? budget - spent : null
  const percentageUsed = hasBudget && budget > 0 ? (spent / budget) * 100 : null
  let status = 'No budget set'
  let statusClass = 'budget-status-unset'
  let alert = 'Set a budget to see remaining funds and spending alerts.'

  if (hasBudget && budget === 0 && spent > 0) {
    status = 'Exceeded budget'
    statusClass = 'budget-status-exceeded'
    alert = `Exceeded budget by ${formatAmount(spent)}.`
  } else if (hasBudget && percentageUsed !== null && percentageUsed > 100) {
    status = 'Exceeded budget'
    statusClass = 'budget-status-exceeded'
    alert = `Exceeded budget by ${formatAmount(Math.abs(remaining))}.`
  } else if (hasBudget && percentageUsed === 100) {
    status = 'Budget fully used'
    statusClass = 'budget-status-full'
    alert = 'The full category budget has been used.'
  } else if (hasBudget && percentageUsed !== null && percentageUsed >= 80) {
    status = 'Approaching budget'
    statusClass = 'budget-status-approaching'
    alert = 'Spending has reached at least 80% of this budget.'
  } else if (hasBudget) {
    status = 'Within budget'
    statusClass = 'budget-status-within'
    alert = 'Spending is within this category budget.'
  }

  const progressValue = percentageUsed === null ? 0 : Math.min(percentageUsed, 100)

  return (
    <article className="budget-comparison-row">
      <div className="budget-comparison-heading">
        <h4>{category}</h4>
        <span className={`budget-status ${statusClass}`}>{status}</span>
      </div>
      <div className="budget-metrics">
        <div><span>Spent</span><strong>{formatAmount(spent)}</strong></div>
        <div>
          <span>Remaining</span>
          <strong className={remaining !== null && remaining < 0 ? 'budget-negative' : ''}>
            {remaining === null ? '—' : formatAmount(remaining)}
          </strong>
        </div>
        <div>
          <span>Used</span>
          <strong>{percentageUsed === null ? (budget === 0 ? 'N/A' : '—') : `${percentageUsed.toFixed(1)}%`}</strong>
        </div>
      </div>
      {hasBudget && budget > 0 && (
        <div
          className={`budget-progress ${statusClass}`}
          role="progressbar"
          aria-label={`${category} budget used`}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.min(percentageUsed, 100)}
        >
          <div className="budget-progress-fill" style={{ width: `${progressValue}%` }} />
        </div>
      )}
      <p className={`budget-alert ${statusClass}`} role={statusClass === 'budget-status-exceeded' || statusClass === 'budget-status-approaching' ? 'alert' : 'status'}>
        {alert}
      </p>
    </article>
  )
}

function SettingsPage({ settings, setSettings }) {
  const [saved, setSaved] = useState(false)
  const update = (key, value) => { setSettings({ ...settings, [key]: value }); setSaved(false) }
  return <><PageHeader title="Settings" subtitle="Manage your profile and financial preferences." /><section className="settings-card"><h3>Profile Information</h3><div className="settings-form"><label htmlFor="name">Name</label><input id="name" value={settings.name} onChange={e => update('name', e.target.value)} placeholder="Enter your name" /><label htmlFor="email">Email</label><input id="email" type="email" value={settings.email} onChange={e => update('email', e.target.value)} placeholder="Enter your email" /></div><h3>Financial Preferences</h3><div className="settings-form"><label htmlFor="currency">Currency</label><select id="currency" defaultValue="INR"><option value="INR">INR - ₹</option><option value="USD">USD - $</option><option value="EUR">EUR - €</option></select><label htmlFor="dateFormat">Date format</label><select id="dateFormat" defaultValue="DD-MM-YYYY"><option>DD-MM-YYYY</option><option>MM-DD-YYYY</option><option>YYYY-MM-DD</option></select></div><button className="primary-button" onClick={() => setSaved(true)}>Save Settings</button>{saved && <p className="notification" role="status">Settings saved for this session preview only.</p>}<p className="muted-note">Backend storage and account security will be implemented separately.</p></section></>
}

export default App
