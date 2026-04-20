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

  await expect(
    page.getByRole('table').getByRole('button', { name: 'Analysis', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.echarts-for-react')).toBeVisible()
  expect(pageErrors).toEqual([])
})
