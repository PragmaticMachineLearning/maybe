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
