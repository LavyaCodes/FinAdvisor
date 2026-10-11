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
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response }))
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
