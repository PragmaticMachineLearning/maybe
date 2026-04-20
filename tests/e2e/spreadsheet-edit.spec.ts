import { expect, test } from '@playwright/test'

test('edits a spreadsheet cell directly', async ({ page }) => {
  await page.goto('/')

  const firstCell = page.locator('tbody tr:first-child td:nth-child(2) > div')
  await firstCell.dblclick()

  const editor = page.getByLabel('Cell A1')
  await expect(editor).toBeVisible()

  await editor.fill('456')
  await editor.press('Enter')

  await expect(firstCell).toHaveText('456')
  await expect(page.getByPlaceholder('Enter formula or value...')).toHaveValue('456')
})

test('opens a confidence interval distribution chart', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')

  const firstCell = page.locator('tbody tr:first-child td:nth-child(2) > div')
  await firstCell.dblclick()

  const editor = page.getByLabel('Cell A1')
  await editor.fill('CI[10, 20]')
  await editor.press('Enter')

  await expect(firstCell).toHaveText('N(μ=15.00, σ=2.55)')

  await firstCell.click({ button: 'right' })

  await page.getByRole('button', { name: /Insights/i }).click()
  await expect(page.getByLabel('Resize analysis panel')).toBeVisible()
  await expect(page.locator('.echarts-for-react')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('opens the local AI copilot and reviews a mock diff', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: /AI/i })).toBeVisible()
  await expect(page.getByLabel('AI Copilot')).toHaveCount(0)

  await page.getByRole('button', { name: /AI/i }).click()
  await expect(page.getByLabel('AI Copilot')).toBeVisible()
  await expect(page.getByLabel('Diff preview')).toBeVisible()

  await page.getByLabel('How can I assist?').fill('Add 95% confidence interval outputs')
  await page.getByRole('button', { name: 'Preview diff' }).click()

  await expect(page.getByText('I prepared a local preview')).toContainText(
    'Add 95% confidence interval outputs',
  )
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('No sheet changes were applied')).toBeVisible()
})

test('starts with workstation side panels collapsed', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: /Insights/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /AI/i })).toBeVisible()
  await expect(page.getByLabel('AI Copilot')).toHaveCount(0)
  await expect(page.locator('.echarts-for-react')).toHaveCount(0)
})
