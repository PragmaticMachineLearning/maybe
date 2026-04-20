import React, { useState } from 'react'

import {
  createMockCopilotResult,
  type MockCopilotResult,
} from './aiCopilotMock'
import styles from './AICopilotPanel.module.css'

interface AICopilotPanelProps {
  onClose: () => void
  compact?: boolean
}

const DEFAULT_PROMPT = 'Propagate uncertainty downstream cells (95% CI)'

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
  onClose,
  compact = false,
}) => {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [result, setResult] = useState<MockCopilotResult | null>(() =>
    createMockCopilotResult(DEFAULT_PROMPT),
  )
  const [reviewStatus, setReviewStatus] = useState('Preview ready')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setResult(createMockCopilotResult(prompt))
    setReviewStatus('Preview ready')
  }

  const handleConfirm = () => {
    setReviewStatus('Preview accepted locally. No sheet changes were applied.')
  }

  const handleCancel = () => {
    setReviewStatus('Preview cancelled. No sheet changes were applied.')
  }

  return (
    <aside
      className={`${styles.panel} ${compact ? styles.panelCompact : ''}`}
      aria-label="AI Copilot"
    >
      <header className={styles.header}>
        <span className={styles.statusDot} />
        <span className={styles.title}>AI Copilot</span>
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
          title="Close AI copilot"
        >
          ×
        </button>
      </header>

      <div className={styles.body}>
        <form className={styles.promptForm} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="ai-copilot-prompt">
            How can I assist?
          </label>
          <textarea
            id="ai-copilot-prompt"
            className={styles.promptInput}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button type="submit" className={styles.submitButton}>
            Preview diff
          </button>
        </form>

        {result && (
          <>
            <div className={styles.message}>{result.message}</div>
            <section className={styles.preview} aria-label="Diff preview">
              <div className={styles.previewHeader}>
                <span>{result.preview.title}</span>
                <span>{reviewStatus}</span>
              </div>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    {result.preview.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.preview.rows.map((row) => (
                    <tr
                      key={row.cell}
                      className={
                        row.tone === 'add' ? styles.rowAdd : styles.rowChange
                      }
                    >
                      <td className={styles.cellCode}>{row.cell}</td>
                      <td className={styles.cellCode}>{row.before || '-'}</td>
                      <td className={styles.cellCode}>{row.after}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={handleConfirm}
              >
                Confirm
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        <p className={styles.notice}>
          Local prototype only. Confirm and cancel update this panel without
          applying spreadsheet changes or calling an AI provider.
        </p>
      </div>
    </aside>
  )
}
