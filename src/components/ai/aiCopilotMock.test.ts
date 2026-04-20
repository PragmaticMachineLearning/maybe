import { describe, expect, it } from 'vitest'

import { createMockCopilotResult } from './aiCopilotMock'

describe('createMockCopilotResult', () => {
  it('uses the prompt in the assistant response', () => {
    const result = createMockCopilotResult('Propagate uncertainty downstream')

    expect(result.message).toContain('Propagate uncertainty downstream')
  })

  it('returns a reviewable diff preview', () => {
    const result = createMockCopilotResult('Add 95% confidence intervals')

    expect(result.preview.title).toBe('Diff preview')
    expect(result.preview.columns).toEqual(['Cell', 'Before', 'After', 'Reason'])
    expect(result.preview.rows).toHaveLength(3)
    expect(result.preview.rows[0]).toMatchObject({
      cell: 'C1',
      before: '=A1*B1',
      after: 'SIM(A1*B1, 95%)',
    })
  })

  it('falls back to a default prompt label for blank input', () => {
    const result = createMockCopilotResult('   ')

    expect(result.message).toContain('the selected uncertainty workflow')
  })
})
