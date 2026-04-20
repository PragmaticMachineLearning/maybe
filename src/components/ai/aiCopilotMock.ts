export interface CopilotDiffRow {
  cell: string
  before: string
  after: string
  reason: string
  tone: 'add' | 'change' | 'review'
}

export interface CopilotDiffPreview {
  title: string
  columns: ['Cell', 'Before', 'After', 'Reason']
  rows: CopilotDiffRow[]
}

export interface MockCopilotResult {
  message: string
  preview: CopilotDiffPreview
}

export const createMockCopilotResult = (prompt: string): MockCopilotResult => {
  const trimmedPrompt = prompt.trim()
  const promptLabel = trimmedPrompt || 'the selected uncertainty workflow'

  return {
    message: `I prepared a local preview for "${promptLabel}". Review the proposed spreadsheet changes before applying them.`,
    preview: {
      title: 'Diff preview',
      columns: ['Cell', 'Before', 'After', 'Reason'],
      rows: [
        {
          cell: 'C1',
          before: '=A1*B1',
          after: 'SIM(A1*B1, 95%)',
          reason: 'Propagates uncertainty through the dependent formula.',
          tone: 'change',
        },
        {
          cell: 'D1',
          before: '',
          after: 'PERCENTILE(C1, 5)',
          reason: 'Adds a lower-bound review point for the simulated output.',
          tone: 'add',
        },
        {
          cell: 'E1',
          before: '',
          after: 'PERCENTILE(C1, 95)',
          reason: 'Adds an upper-bound review point for the simulated output.',
          tone: 'add',
        },
      ],
    },
  }
}
