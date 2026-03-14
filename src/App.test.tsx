import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App shell', () => {
  it('renders the main chat workspace with history sidebar', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Branch Chat' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Chat history' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message composer' })).toBeInTheDocument()
  })

  it('collapses and expands the history sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    const sidebar = screen.getByTestId('history-sidebar')
    const toggleButton = screen.getByRole('button', { name: 'Collapse sidebar' })

    expect(sidebar).toHaveAttribute('data-collapsed', 'false')

    await user.click(toggleButton)
    expect(screen.getByTestId('history-sidebar')).toHaveAttribute('data-collapsed', 'true')

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByTestId('history-sidebar')).toHaveAttribute('data-collapsed', 'false')
  })

  it('opens and closes settings popup from sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('enables reading mode from settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    await user.click(screen.getByRole('checkbox', { name: 'Enable reading mode' }))

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-reading-mode', 'true')
  })

  it('offers all three providers in settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))

    const providerSelect = screen.getByRole('combobox', { name: 'Provider' })
    expect(providerSelect).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'OpenAI' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Anthropic' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Gemini' })).toBeInTheDocument()
  })

  it('shows BYOK guidance when sending without an API key', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox', { name: 'Message composer' }), 'Hello there')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText(/Add an API key for OpenAI/i)).toBeInTheDocument()
  })
})
