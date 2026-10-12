import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../FinAdvisor.jsx'

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
})
