import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../FinAdvisor.jsx'

const budgetUploadResponse = {
  total_income: 2000,
  total_expenses: 157,
  net_balance: 1843,
  transaction_count: 5,
  transactions: [
    { date: '2026-01-05', description: 'Groceries', category: 'Food & Dining', amount: -80 },
    { date: '2026-01-20', description: 'Restaurant', category: 'Food & Dining', amount: -30 },
    { date: '2026-01-25', description: 'Salary', category: 'Food & Dining', amount: 2000 },
    { date: '2026-01-27', description: 'Cash purchase', category: 'Uncategorized', amount: -15 },
    { date: '2026-02-04', description: 'Coffee', category: 'Food & Dining', amount: -32 },
  ],
  category_expenses: { 'Food & Dining': 142, Uncategorized: 15 },
}

const sampleCategoryUploadResponse = {
  total_income: 35000,
  total_expenses: 2300,
  net_balance: 32700,
  transaction_count: 4,
  transactions: [
    { date: '2026-01-05', description: 'Salary', category: 'Income', amount: 30000 },
    { date: '2026-01-06', description: 'Groceries', category: 'Food', amount: -1500 },
    { date: '2026-01-07', description: 'Bus pass', category: 'Transport', amount: -800 },
    { date: '2026-01-30', description: 'Bonus', category: 'Income', amount: 5000 },
  ],
  category_expenses: { Food: 1500, Transport: 800 },
}

const anomalyUploadResponse = {
  total_income: 100000,
  total_expenses: 146,
  net_balance: 99854,
  transaction_count: 7,
  transactions: [
    { date: '2026-01-01', description: 'Small purchase', category: 'Food', amount: -10 },
    { date: '2026-01-02', description: 'Bus fare', category: 'Transport', amount: -11 },
    { date: '2026-01-03', description: 'Coffee', category: 'Food & Dining', amount: -12 },
    { date: '2026-01-04', description: 'Book', category: 'Education', amount: -13 },
    { date: '2026-01-05', description: 'Large appliance', category: 'Shopping', amount: -100 },
    { date: '2026-01-06', description: 'Salary', category: 'Income', amount: 100000 },
    { date: '2026-01-07', description: 'No charge', category: 'Food', amount: 0 },
  ],
  category_expenses: {},
}

async function openPageWithUpload(uploadResponse, pageName) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => uploadResponse,
  }))
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
  fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'demo@example.com' } })
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'demo-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
  fireEvent.click(screen.getAllByRole('button', { name: /Upload Data/ })[0])
  fireEvent.change(screen.getByLabelText(/choose csv file/i), {
    target: { files: [new File(['date,description,amount'], 'budget.csv', { type: 'text/csv' })] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByText('CSV processed successfully. Results are available for this session only.')
  fireEvent.click(screen.getByRole('button', { name: new RegExp(pageName) }))
}

async function openBudgetPlannerWithUpload(uploadResponse = budgetUploadResponse) {
  await openPageWithUpload(uploadResponse, 'Budget Planner')
}

async function openSpendingInsightsWithUpload(uploadResponse = budgetUploadResponse) {
  await openPageWithUpload(uploadResponse, 'Spending Insights')
}

async function openAnomalyDetectionWithUpload(uploadResponse = anomalyUploadResponse) {
  await openPageWithUpload(uploadResponse, 'Anomaly Detection')
}

async function openFinancialAssistantWithUpload(uploadResponse = sampleCategoryUploadResponse) {
  await openPageWithUpload(uploadResponse, 'AI Financial Assistant')
}

function submitAssistantQuestion(question) {
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
}

describe('FinAdvisor app shell', () => {
  it('renders the landing page and opens the demo login', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /take control of your finances/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('uploads a selected CSV and displays the processed summary', async () => {
    const response = {
      total_income: 1000,
      total_expenses: 125.5,
      net_balance: 874.5,
      transaction_count: 2,
      transactions: [
        { date: '2026-01-01', description: 'Salary', category: 'Income', amount: 1000 },
        { date: '2026-01-02', description: 'Groceries', category: 'Food & Dining', amount: -125.5 },
      ],
      category_expenses: { 'Food & Dining': 125.5 },
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'demo@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'demo-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Upload Data/ })[0])
    fireEvent.change(screen.getByLabelText(/choose csv file/i), {
      target: { files: [new File(['date,description,amount\n2026-01-01,Coffee,-2'], 'transactions.csv', { type: 'text/csv' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Total income: ₹1000.00')).toBeInTheDocument()
    expect(screen.getByText('Total expenses: ₹125.50')).toBeInTheDocument()
    expect(screen.getByText('Net balance: ₹874.50')).toBeInTheDocument()
    expect(screen.getByText('Transactions: 2')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/transactions/upload', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    }))
    expect(fetchMock.mock.calls[0][1].body.get('file').name).toBe('transactions.csv')

    fireEvent.click(screen.getByRole('button', { name: /Dashboard/ }))
    expect(screen.getAllByText('₹1000.00')).toHaveLength(2)
    expect(screen.getByText('₹874.50')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getAllByText('Food & Dining')).toHaveLength(2)
    expect(screen.getByText('−₹125.50')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Food & Dining spending' })).toHaveAttribute('aria-valuenow', '125.5')
  })

  it('shows dashboard empty states before a CSV is uploaded', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'demo@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'demo-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('No spending data yet')).toBeInTheDocument()
    expect(screen.getByText('No transactions to show')).toBeInTheDocument()
  })

  it('asks for a file before sending an upload request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'demo@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'demo-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Upload Data/ })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please choose a CSV file first.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a clear backend upload error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'CSV is missing required column(s): amount.' }) }))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'demo@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'demo-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Upload Data/ })[0])
    fireEvent.change(screen.getByLabelText(/choose csv file/i), {
      target: { files: [new File(['date,description'], 'transactions.csv', { type: 'text/csv' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('CSV is missing required column(s): amount.')
  })

  it('compares a selected month, excludes income, and warns at 80 percent', async () => {
    await openBudgetPlannerWithUpload()

    fireEvent.change(screen.getByLabelText('Spending month'), { target: { value: '2026-01' } })
    fireEvent.change(screen.getByLabelText('Budget for Food & Dining'), { target: { value: '125' } })

    const foodRow = screen.getByRole('heading', { name: 'Food & Dining' }).closest('.budget-comparison-row')
    expect(within(foodRow).getByText('₹110.00')).toBeInTheDocument()
    expect(within(foodRow).getByText('₹15.00')).toBeInTheDocument()
    expect(within(foodRow).getByText('88.0%')).toBeInTheDocument()
    expect(within(foodRow).getByText('Approaching budget')).toBeInTheDocument()
    expect(within(foodRow).getByRole('alert')).toHaveTextContent(/at least 80%/i)

    const uncategorizedRow = screen.getByRole('heading', { name: 'Uncategorized' }).closest('.budget-comparison-row')
    expect(within(uncategorizedRow).getByText('₹15.00')).toBeInTheDocument()
    expect(within(uncategorizedRow).getByText('No budget set')).toBeInTheDocument()
    expect(within(uncategorizedRow).getByText('Set a budget to see remaining funds and spending alerts.')).toBeInTheDocument()
  })

  it('shows exceeded spending with a negative remaining amount', async () => {
    await openBudgetPlannerWithUpload()

    fireEvent.change(screen.getByLabelText('Spending month'), { target: { value: '2026-01' } })
    fireEvent.change(screen.getByLabelText('Budget for Food & Dining'), { target: { value: '100' } })

    const foodRow = screen.getByRole('heading', { name: 'Food & Dining' }).closest('.budget-comparison-row')
    expect(within(foodRow).getByText('−₹10.00')).toBeInTheDocument()
    expect(within(foodRow).getByText('110.0%')).toBeInTheDocument()
    expect(within(foodRow).getByText('Exceeded budget')).toBeInTheDocument()
    expect(within(foodRow).getByRole('alert')).toHaveTextContent('Exceeded budget by ₹10.00.')
  })

  it('handles a zero budget without dividing by zero', async () => {
    await openBudgetPlannerWithUpload()

    fireEvent.change(screen.getByLabelText('Spending month'), { target: { value: '2026-01' } })
    fireEvent.change(screen.getByLabelText('Budget for Food & Dining'), { target: { value: '0' } })

    const foodRow = screen.getByRole('heading', { name: 'Food & Dining' }).closest('.budget-comparison-row')
    expect(within(foodRow).getByText('−₹110.00')).toBeInTheDocument()
    expect(within(foodRow).getByText('N/A')).toBeInTheDocument()
    expect(within(foodRow).getByText('Exceeded budget')).toBeInTheDocument()
    expect(within(foodRow).queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('keeps category budgets while navigating and shows within-budget status', async () => {
    await openBudgetPlannerWithUpload()

    fireEvent.change(screen.getByLabelText('Budget for Food & Dining'), { target: { value: '200' } })
    expect(screen.getByText('Within budget')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Dashboard/ }))
    fireEvent.click(screen.getByRole('button', { name: /Budget Planner/ }))

    expect(screen.getByLabelText('Budget for Food & Dining')).toHaveValue(200)
    expect(screen.getByText('Within budget')).toBeInTheDocument()
  })

  it('allows setting budgets before upload and explains comparisons are unavailable', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'demo@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'demo-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    fireEvent.click(screen.getByRole('button', { name: /Budget Planner/ }))

    expect(screen.getByRole('note')).toHaveTextContent('session only')
    expect(screen.getByText('Upload a CSV to compare your limits with expenses. You can set category budgets now.')).toBeInTheDocument()
    expect(screen.getByText('No uploaded spending yet')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Budget for Food & Dining'), { target: { value: '250' } })
    expect(screen.getByLabelText('Budget for Food & Dining')).toHaveValue(250)
  })

  it('matches the sample Food and Transport expenses to their canonical budgets', async () => {
    await openBudgetPlannerWithUpload(sampleCategoryUploadResponse)

    fireEvent.change(screen.getByLabelText('Budget for Food & Dining'), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('Budget for Transportation'), { target: { value: '1000' } })

    const foodRow = screen.getByRole('heading', { name: 'Food & Dining' }).closest('.budget-comparison-row')
    const transportRow = screen.getByRole('heading', { name: 'Transportation' }).closest('.budget-comparison-row')
    expect(within(foodRow).getByText('₹1500.00')).toBeInTheDocument()
    expect(within(foodRow).getByText('75.0%')).toBeInTheDocument()
    expect(within(transportRow).getByText('₹800.00')).toBeInTheDocument()
    expect(within(transportRow).getByText('80.0%')).toBeInTheDocument()
    expect(within(transportRow).getByText('Approaching budget')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Income' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Savings & Investments' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Dashboard/ }))
    const transactionTable = screen.getByRole('table')
    expect(within(transactionTable).getByText('Food')).toBeInTheDocument()
    expect(within(transactionTable).getByText('Transport')).toBeInTheDocument()
    expect(within(transactionTable).getAllByText('Income')).toHaveLength(2)
  })

  it('combines capitalization and category aliases without duplicate rows', async () => {
    const duplicateAliases = {
      ...sampleCategoryUploadResponse,
      transactions: [
        { date: '2026-01-01', description: 'A', category: 'Food & Dining', amount: -100 },
        { date: '2026-01-02', description: 'B', category: ' food ', amount: -100 },
        { date: '2026-01-03', description: 'C', category: 'GROCERIES', amount: -100 },
        { date: '2026-01-04', description: 'D', category: 'Restaurants', amount: -100 },
        { date: '2026-01-05', description: 'E', category: 'Groceries and Restaurants', amount: -100 },
        { date: '2026-01-06', description: 'F', category: 'TRANSPORTATION', amount: -100 },
        { date: '2026-01-07', description: 'G', category: 'Transport', amount: -100 },
        { date: '2026-01-08', description: 'H', category: 'Emi And Loan', amount: -40 },
        { date: '2026-01-09', description: 'I', category: 'EMI & Loans', amount: -10 },
      ],
    }
    await openBudgetPlannerWithUpload(duplicateAliases)

    const foodRows = screen.getAllByRole('heading', { name: 'Food & Dining' })
    const transportRows = screen.getAllByRole('heading', { name: 'Transportation' })
    expect(foodRows).toHaveLength(1)
    expect(transportRows).toHaveLength(1)
    expect(within(foodRows[0].closest('.budget-comparison-row')).getByText('₹500.00')).toBeInTheDocument()
    expect(within(transportRows[0].closest('.budget-comparison-row')).getByText('₹200.00')).toBeInTheDocument()
    expect(within(screen.getByRole('heading', { name: 'EMI & Loans' }).closest('.budget-comparison-row')).getByText('₹50.00')).toBeInTheDocument()
  })

  it('keeps unknown and missing expense categories in Others and Uncategorized', async () => {
    const uncategorizedUpload = {
      ...sampleCategoryUploadResponse,
      transactions: [
        { date: '2026-01-01', description: 'Unknown service', category: 'Pet Grooming', amount: -45 },
        { date: '2026-01-02', description: 'Cash purchase', category: '   ', amount: -25 },
        { date: '2026-01-03', description: 'Salary', category: 'Income', amount: 1000 },
      ],
    }
    await openBudgetPlannerWithUpload(uncategorizedUpload)

    expect(within(screen.getByRole('heading', { name: 'Others' }).closest('.budget-comparison-row')).getByText('₹45.00')).toBeInTheDocument()
    expect(within(screen.getByRole('heading', { name: 'Uncategorized' }).closest('.budget-comparison-row')).getByText('₹25.00')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pet Grooming' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Income' })).not.toBeInTheDocument()
  })

  it('shows expense-only category totals, shares, and highest category using canonical aliases', async () => {
    await openSpendingInsightsWithUpload(sampleCategoryUploadResponse)

    expect(screen.getByRole('heading', { name: 'Spending Insights' })).toBeInTheDocument()
    expect(screen.getByText('Total Expenses')).toBeInTheDocument()
    expect(screen.getByText('₹2300.00')).toBeInTheDocument()
    expect(screen.getByText('Highest-Spending Category')).toBeInTheDocument()
    expect(screen.getByText('Food & Dining is your highest-spending category at ₹1500.00 (65.2% of recorded expenses).')).toBeInTheDocument()

    const categoryChart = screen.getByRole('list', { name: 'Expense distribution by category' })
    expect(within(categoryChart).getByText('Food & Dining')).toBeInTheDocument()
    expect(within(categoryChart).getByText('Transportation')).toBeInTheDocument()
    expect(within(categoryChart).getByText('(65.2%)')).toBeInTheDocument()
    expect(within(categoryChart).getByText('(34.8%)')).toBeInTheDocument()
    expect(within(categoryChart).getByText('Highest')).toBeInTheDocument()
    expect(within(categoryChart).queryByText('Income')).not.toBeInTheDocument()
  })

  it('shows monthly expenses only for valid dated months and explains excluded dates', async () => {
    const datedAndUndatedUpload = {
      ...sampleCategoryUploadResponse,
      transactions: [
        { date: '2026-01-05', description: 'Food', category: 'Food', amount: -100 },
        { date: '2026-02-07', description: 'Groceries', category: 'Groceries', amount: -200 },
        { date: '', description: 'Undated shopping', category: 'Shopping', amount: -50 },
        { date: 'not-a-date', description: 'Invalid date', category: 'Traveling', amount: -25 },
        { date: '2026-02-30', description: 'Impossible date', category: 'Trips', amount: -25 },
        { date: '2026-02-10', description: 'Income', category: 'Income', amount: 5000 },
      ],
    }
    await openSpendingInsightsWithUpload(datedAndUndatedUpload)

    const monthlyChart = screen.getByRole('list', { name: 'Monthly expenses' })
    expect(within(monthlyChart).getByRole('progressbar', { name: 'January 2026 expenses' })).toHaveAttribute('aria-valuenow', '100')
    expect(within(monthlyChart).getByRole('progressbar', { name: 'February 2026 expenses' })).toHaveAttribute('aria-valuenow', '200')
    expect(within(monthlyChart).queryByText('March 2026')).not.toBeInTheDocument()
    expect(screen.getByText(/Spending increased 100.0% from ₹100.00 in January 2026 to ₹200.00 in February 2026\./)).toBeInTheDocument()
    expect(screen.getByText('Shopping')).toBeInTheDocument()
    expect(screen.getByText('Travel')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('3 expense transactions have missing or invalid dates.')
    expect(screen.getByRole('note')).toHaveTextContent('They remain included in category totals but are omitted from the monthly trend.')
  })

  it('explains insufficient monthly trend data and still includes undated expense totals', async () => {
    const oneDatedMonthUpload = {
      ...sampleCategoryUploadResponse,
      transactions: [
        { date: '2026-01-05', description: 'Food', category: 'Food', amount: -100 },
        { date: '', description: 'Undated food', category: 'Food & Dining', amount: -50 },
        { date: 'not-a-date', description: 'Invalid date', category: 'Groceries', amount: -25 },
      ],
    }
    await openSpendingInsightsWithUpload(oneDatedMonthUpload)

    expect(screen.getByText('Not enough dated months')).toBeInTheDocument()
    expect(screen.getByText(/At least two distinct months with valid dated expenses are needed/i)).toBeInTheDocument()
    const foodRows = screen.getAllByText('Food & Dining')
    expect(foodRows.length).toBeGreaterThan(0)
    expect(screen.getAllByText('₹175.00').length).toBeGreaterThan(0)
  })

  it('shows helpful empty states with no upload and with income-only data', async () => {
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'demo@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'demo-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    fireEvent.click(screen.getByRole('button', { name: /Spending Insights/ }))

    expect(screen.getByText('No transaction data yet')).toBeInTheDocument()
    unmount()

    await openSpendingInsightsWithUpload({
      ...sampleCategoryUploadResponse,
      transactions: [
        { date: '2026-01-01', description: 'Salary', category: 'Income', amount: 30000 },
        { date: '2026-01-02', description: 'Savings', category: 'Savings & Investments', amount: 5000 },
      ],
    })
    expect(screen.getByText('No expenses to analyze')).toBeInTheDocument()
    expect(screen.getByText(/Income is not included in spending insights/i)).toBeInTheDocument()
  })

  it('flags an unusually large expense and explains the upload-relative threshold', async () => {
    await openAnomalyDetectionWithUpload()

    expect(screen.getByRole('heading', { name: 'Anomaly Detection' })).toBeInTheDocument()
    expect(screen.getByText('Large appliance')).toBeInTheDocument()
    expect(screen.getByText('2026-01-05')).toBeInTheDocument()
    expect(screen.getByText('Shopping')).toBeInTheDocument()
    expect(screen.getByText('₹100.00')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/unusually large relative to this upload/i)
    expect(screen.getByText(/Threshold: ₹15.00 · Median expense: ₹12.00 · MAD: ₹1.00/)).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/does not indicate fraud or misconduct/i)
  })

  it('excludes positive income, zero amounts, and invalid amounts from anomaly sampling', async () => {
    await openAnomalyDetectionWithUpload({
      ...anomalyUploadResponse,
      transactions: [
        ...anomalyUploadResponse.transactions,
        { date: '2026-01-08', description: 'Bonus', category: 'Income', amount: 999999 },
        { date: '2026-01-09', description: 'Invalid amount', category: 'Shopping', amount: 'not-a-number' },
      ],
    })

    expect(screen.getByText('Large appliance')).toBeInTheDocument()
    expect(screen.queryByText('Bonus')).not.toBeInTheDocument()
    expect(screen.getAllByRole('note').some(note => note.textContent.includes('1 transaction amount was missing or invalid and excluded from this check.'))).toBe(true)
    expect(screen.getByText(/requires at least 5 expenses/i)).toBeInTheDocument()
  })

  it('shows an insufficient-data state below the documented minimum sample size', async () => {
    await openAnomalyDetectionWithUpload({
      ...anomalyUploadResponse,
      transactions: anomalyUploadResponse.transactions.slice(0, 4),
    })

    expect(screen.getByText('Not enough expenses to assess')).toBeInTheDocument()
    expect(screen.getByText(/At least 5 valid expense transactions are needed/i)).toBeInTheDocument()
    expect(screen.getByText(/No statistical conclusion is made/i)).toBeInTheDocument()
  })

  it('reports zero-MAD expense data as unassessable rather than anomaly-free', async () => {
    const zeroMadTransactions = Array.from({ length: 5 }, (_, index) => ({
      date: `2026-01-0${index + 1}`,
      description: `Same cost ${index + 1}`,
      category: 'Food',
      amount: -20,
    }))
    await openAnomalyDetectionWithUpload({ ...anomalyUploadResponse, transactions: zeroMadTransactions })

    expect(screen.getByText('Expense pattern cannot be assessed reliably')).toBeInTheDocument()
    expect(screen.getByText(/median absolute deviation is zero/i)).toBeInTheDocument()
    expect(screen.getByText(/No anomalies are claimed/i)).toBeInTheDocument()
    expect(screen.queryByText('No unusually large expenses found')).not.toBeInTheDocument()
  })

  it('shows no-upload and assessed-with-no-anomalies empty states', async () => {
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'demo@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'demo-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    fireEvent.click(screen.getByRole('button', { name: /Anomaly Detection/ }))
    expect(screen.getByText('No transaction data yet')).toBeInTheDocument()
    unmount()

    await openAnomalyDetectionWithUpload({
      ...anomalyUploadResponse,
      transactions: [
        { date: '2026-01-01', description: 'Expense A', category: 'Food', amount: -10 },
        { date: '2026-01-02', description: 'Expense B', category: 'Food', amount: -11 },
        { date: '2026-01-03', description: 'Expense C', category: 'Food', amount: -12 },
        { date: '2026-01-04', description: 'Expense D', category: 'Food', amount: -13 },
        { date: '2026-01-05', description: 'Expense E', category: 'Food', amount: -14 },
      ],
    })
    expect(screen.getByText('No unusually large expenses found')).toBeInTheDocument()
    expect(screen.getByText(/None of the 5 expenses exceeded the data-based threshold of ₹15.00/i)).toBeInTheDocument()
  })

  it('handles missing descriptions and invalid or missing dates without changing uploaded rows', async () => {
    const transactionsWithMissingDetails = [
      { date: '2026-01-01', description: 'Routine 1', category: 'Food', amount: -10 },
      { date: '2026-01-02', description: 'Routine 2', category: 'Food', amount: -11 },
      { date: '2026-01-03', description: 'Routine 3', category: 'Food', amount: -12 },
      { date: '2026-01-04', description: 'Routine 4', category: 'Food', amount: -13 },
      { date: 'not-a-date', description: '   ', category: 'Food', amount: -100 },
      { date: '', description: 'Bad amount', category: 'Food', amount: 'NaN' },
      { date: '2026-01-06', description: 'No amount' },
    ]
    await openAnomalyDetectionWithUpload({ ...anomalyUploadResponse, transactions: transactionsWithMissingDetails })

    expect(screen.getByText('Description unavailable')).toBeInTheDocument()
    expect(screen.getByText('Date unavailable')).toBeInTheDocument()
    expect(screen.getByText('Food & Dining')).toBeInTheDocument()
    expect(screen.getAllByRole('note').some(note => note.textContent.includes('2 transaction amounts were missing or invalid and excluded from this check.'))).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Dashboard/ }))
    const transactionTable = screen.getByRole('table')
    expect(within(transactionTable).getByText('not-a-date')).toBeInTheDocument()
    expect(within(transactionTable).getAllByText('₹NaN')).toHaveLength(2)
  })

  it('answers largest-expense questions from negative transaction records', async () => {
    await openFinancialAssistantWithUpload(anomalyUploadResponse)

    submitAssistantQuestion('What was my largest expense?')

    expect(screen.getAllByText('What was my largest expense?').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Your largest expense was Large appliance at ₹100\.00\./)).toBeInTheDocument()
    expect(screen.getByText(/Date: 2026-01-05\./)).toBeInTheDocument()
  })

  it('answers canonical category spending questions and excludes income', async () => {
    await openFinancialAssistantWithUpload(sampleCategoryUploadResponse)

    submitAssistantQuestion('How much did I spend on food?')

    expect(screen.getByText(/Your recorded spending in Food & Dining is ₹1500\.00 across 1 expense transaction/)).toBeInTheDocument()
    expect(screen.queryByText(/35000/)).not.toBeInTheDocument()
  })

  it('answers monthly income, expense, and net balance from valid dated records', async () => {
    const monthlyRecords = {
      ...sampleCategoryUploadResponse,
      transactions: [
        { date: '2026-01-02', description: 'Pay', category: 'Income', amount: 3000 },
        { date: '2026-01-03', description: 'Food shop', category: 'Food', amount: -700 },
        { date: '2026-02-02', description: 'Other pay', category: 'Income', amount: 10000 },
        { date: '2026-02-03', description: 'Bus', category: 'Transport', amount: -400 },
        { date: '', description: 'Undated expense', category: 'Food', amount: -50 },
        { date: '2026-01-04', description: 'Invalid amount', category: 'Food', amount: 'bad' },
      ],
    }
    await openFinancialAssistantWithUpload(monthlyRecords)

    submitAssistantQuestion('What were my total income, expenses, and net balance for January 2026?')

    expect(screen.getByText(/Recorded totals for January 2026: income ₹3000\.00, expenses ₹700\.00, and net balance ₹2300\.00\./)).toBeInTheDocument()
    expect(screen.getByText(/1 invalid amount record\(s\) were excluded/)).toBeInTheDocument()
    expect(screen.getByText(/1 record\(s\) with missing or invalid dates were excluded from this month/)).toBeInTheDocument()
  })

  it('answers overall totals and ISO month questions using actual records', async () => {
    await openFinancialAssistantWithUpload()

    submitAssistantQuestion('What are my total income, expenses, and net balance across all transactions?')
    expect(screen.getByText(/Recorded totals across all uploaded transactions: income ₹35000\.00, expenses ₹2300\.00, and net balance ₹32700\.00\./)).toBeInTheDocument()

    submitAssistantQuestion('What were my total income, expenses, and net balance for 2026-01?')
    expect(screen.getByText(/Recorded totals for January 2026: income ₹35000\.00, expenses ₹2300\.00, and net balance ₹32700\.00\./)).toBeInTheDocument()
  })

  it('asks for a CSV when no data is uploaded', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'demo@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'demo-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    fireEvent.click(screen.getByRole('button', { name: /AI Financial Assistant/ }))

    expect(screen.getByRole('status')).toHaveTextContent('Upload a CSV statement first.')
    submitAssistantQuestion('What was my largest expense?')
    expect(screen.getByText(/Please upload a CSV statement first/)).toBeInTheDocument()
    expect(screen.getByText(/No transaction data is sent to an external AI provider/)).toBeInTheDocument()
  })

  it('clarifies ambiguous months and unsupported questions', async () => {
    await openFinancialAssistantWithUpload()

    submitAssistantQuestion('What were my totals this month?')
    expect(screen.getByText(/Which month and year should I use/)).toBeInTheDocument()

    submitAssistantQuestion('How should I invest my money?')
    expect(screen.getByText(/I can answer questions about your largest expense/)).toBeInTheDocument()
  })

  it('does not invent category or month values absent from the records', async () => {
    await openFinancialAssistantWithUpload()

    submitAssistantQuestion('How much did I spend on healthcare?')
    expect(screen.getByText(/Which expense category do you mean/)).toBeInTheDocument()

    submitAssistantQuestion('What were my income, expenses, and balance for December 2025?')
    expect(screen.getByText(/I could not find transactions with valid dates for December 2025/)).toBeInTheDocument()
  })

  it('handles invalid amounts and missing or invalid dates without crashing or claiming unsupported facts', async () => {
    const incompleteRecords = {
      ...sampleCategoryUploadResponse,
      transactions: [
        { date: 'not-a-date', description: '', category: 'Food', amount: -100 },
        { date: '', description: 'Bad amount', category: 'Food', amount: 'not-a-number' },
        { description: 'Missing amount', category: 'Food' },
      ],
    }
    await openFinancialAssistantWithUpload(incompleteRecords)

    submitAssistantQuestion('What was my largest expense?')
    expect(screen.getByText(/Description unavailable at ₹100\.00/)).toBeInTheDocument()
    expect(screen.getByText(/A valid date was not available/)).toBeInTheDocument()

    submitAssistantQuestion('What were my total income, expenses, and net balance for January 2026?')
    expect(screen.getByText(/I could not find transactions with valid dates for January 2026/)).toBeInTheDocument()

    submitAssistantQuestion('What are my total income, expenses, and net balance across all transactions?')
    expect(screen.getByText(/Recorded totals across all uploaded transactions: income ₹0\.00, expenses ₹100\.00, and net balance −₹100\.00\./)).toBeInTheDocument()
    expect(screen.getByText(/2 invalid amount record\(s\) were excluded/)).toBeInTheDocument()
  })
})
