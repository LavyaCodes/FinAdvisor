import { useState } from 'react'
import './FinAdvisor-App.css'

const pages = ['Dashboard', 'Upload Data', 'AI Analysis', 'Budget Planner', 'Settings']
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
        {activePage === 'AI Analysis' && <AnalysisPage />}
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
    <section className="features-section" id="features"><h2>Powerful Financial Tools</h2><div className="feature-grid"><div className="feature-card"><h3>📊 Expense Analysis</h3><p>Explore category-wise spending once your data is available.</p></div><div className="feature-card"><h3>💰 Budget Planner</h3><p>Set a monthly budget and organize category limits.</p></div><div className="feature-card"><h3>🤖 Smart Insights</h3><p>View AI-generated insights when the analysis service is connected.</p></div></div></section>
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
  return <aside className="sidebar"><div className="brand"><div className="brand-icon">F</div><strong>FinAdvisor</strong></div><nav className="sidebar-nav">{pages.map((page, i) => <button key={page} className={`option-button ${activePage === page ? 'active' : ''}`} onClick={() => onNavigate(page)}><span>{['▦', '⇧', '◉', '◫', '⚙'][i]}</span>{page}</button>)}</nav><div className="user-card"><div className="user-avatar">U</div><div><strong>User</strong><small>Personal Finance</small></div></div><button className="option-button logout-button" onClick={onLogout}>↪ Log out</button></aside>
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

function AnalysisPage() {
  return <><PageHeader title="AI Expense Analysis" subtitle="Understand spending patterns and financial insights." /><section className="summary-grid"><SummaryCard title="Total Expenses" value="—" note="Waiting for transaction data" icon="↘" /><SummaryCard title="Top Category" value="—" note="Not available yet" icon="▤" /><SummaryCard title="Transactions" value="—" note="No data loaded" icon="≡" /></section><section className="analysis-grid"><div className="panel"><h3>Category-wise Expenses</h3><EmptyState title="Analysis not available" message="Category totals will appear here after the backend processes your transactions." /></div><div className="panel"><h3>AI Insights</h3><EmptyState title="Waiting for AI analysis" message="No recommendations are shown until the real analysis service is connected." /></div></section></>
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
