import React from 'react'

import styles from './WorkspaceRail.module.css'

interface WorkspaceRailProps {
  insightsOpen: boolean
  aiPanelOpen: boolean
  onToggleInsights: () => void
  onToggleAiPanel: () => void
}

const InsightsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 18V6M9 18v-8M14 18V4M19 18v-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  </svg>
)

const AiIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3z"
      fill="currentColor"
    />
    <path
      d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z"
      fill="currentColor"
      opacity="0.72"
    />
  </svg>
)

export const WorkspaceRail: React.FC<WorkspaceRailProps> = ({
  insightsOpen,
  aiPanelOpen,
  onToggleInsights,
  onToggleAiPanel,
}) => (
  <nav className={styles.rail} aria-label="Workspace panels">
    <button
      type="button"
      className={`${styles.railButton} ${insightsOpen ? styles.railButtonActive : ''}`}
      onClick={onToggleInsights}
      aria-pressed={insightsOpen}
      aria-controls="insights-panel"
    >
      <InsightsIcon />
      <span>Insights</span>
    </button>

    <button
      type="button"
      className={`${styles.railButton} ${aiPanelOpen ? styles.railButtonActive : ''}`}
      onClick={onToggleAiPanel}
      aria-pressed={aiPanelOpen}
      aria-controls="ai-copilot-panel"
    >
      <AiIcon />
      <span>AI</span>
    </button>
  </nav>
)
