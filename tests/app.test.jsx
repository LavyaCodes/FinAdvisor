import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../FinAdvisor.jsx'

describe('FinAdvisor app shell', () => {
  it('renders the landing page and opens the demo login', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /take control of your finances/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})
