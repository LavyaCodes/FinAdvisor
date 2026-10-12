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

async function openBudgetPlannerWithUpload(uploadResponse = budgetUploadResponse) {
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
  fireEvent.click(screen.getByRole('button', { name: /Budget Planner/ }))
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
})
