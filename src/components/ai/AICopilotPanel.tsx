import React, { useState } from "react";

import {
  createMockCopilotResult,
  type MockCopilotResult,
  type CopilotDiffRow,
} from "./aiCopilotMock";
import styles from "./AICopilotPanel.module.css";

interface AICopilotPanelProps {
  onClose: () => void;
  compact?: boolean;
}

const DEFAULT_PROMPT = "Propagate uncertainty downstream cells (95% CI)";

const SageIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3z"
      fill="currentColor"
    />
    <path
      d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z"
      fill="currentColor"
      opacity="0.6"
    />
  </svg>
);

const toneLabels: Record<CopilotDiffRow["tone"], string> = {
  change: "Update",
  add: "New",
  review: "Review",
};

const toneClasses: Record<CopilotDiffRow["tone"], string> = {
  change: styles.changeBadgeChange,
  add: styles.changeBadgeAdd,
  review: styles.changeBadgeReview,
};

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
  onClose,
  compact = false,
}) => {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [result, setResult] = useState<MockCopilotResult | null>(() =>
    createMockCopilotResult(DEFAULT_PROMPT),
  );
  const [status, setStatus] = useState<
    "idle" | "preview" | "accepted" | "cancelled"
  >("preview");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    setResult(createMockCopilotResult(prompt));
    setStatus("preview");
  };

  const handleConfirm = () => {
    setStatus("accepted");
  };

  const handleCancel = () => {
    setStatus("cancelled");
  };

  const handleReset = () => {
    setResult(null);
    setStatus("idle");
  };

  const showResult =
    result &&
    (status === "preview" || status === "accepted" || status === "cancelled");

  return (
    <aside
      className={`${styles.panel} ${compact ? styles.panelCompact : ""}`}
      aria-label="Sage"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.sageAvatar}>
            <SageIcon />
          </div>
          <div className={styles.headerText}>
            <span className={styles.title}>Sage</span>
            <span className={styles.subtitle}>Modeling assistant</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
          title="Close Sage"
          aria-label="Close Sage"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className={styles.body}>
        {/* Prompt area */}
        <form className={styles.promptForm} onSubmit={handleSubmit}>
          <div className={styles.promptHeader}>
            <label className={styles.promptLabel} htmlFor="sage-prompt">
              What would you like to model?
            </label>
          </div>
          <div className={styles.promptInputWrapper}>
            <textarea
              id="sage-prompt"
              className={styles.promptInput}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="e.g. Add confidence intervals to my cost forecast..."
              rows={3}
            />
            <button
              type="submit"
              className={styles.submitButton}
              disabled={!prompt.trim()}
              title="Generate suggestions"
              aria-label="Generate suggestions"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </form>

        {/* Results */}
        {showResult && result && (
          <div className={styles.results}>
            {/* Sage's message */}
            <div className={styles.sageMessage}>
              <div className={styles.sageMessageAvatar}>
                <SageIcon />
              </div>
              <div className={styles.sageMessageBubble}>
                <p className={styles.sageMessageText}>{result.message}</p>
              </div>
            </div>

            {/* Change cards */}
            <div className={styles.changesSection}>
              <div className={styles.changesSectionHeader}>
                <span className={styles.changesSectionTitle}>
                  Suggested changes
                </span>
                <span className={styles.changesSectionCount}>
                  {result.preview.rows.length}
                </span>
              </div>

              <div className={styles.changeCards}>
                {result.preview.rows.map((row) => (
                  <div key={row.cell} className={styles.changeCard}>
                    <div className={styles.changeCardHeader}>
                      <span
                        className={`${styles.changeBadge} ${toneClasses[row.tone]}`}
                      >
                        {toneLabels[row.tone]}
                      </span>
                      <span className={styles.changeCell}>{row.cell}</span>
                    </div>
                    <p className={styles.changeReason}>{row.reason}</p>
                    <div className={styles.changeFormula}>
                      {row.before ? (
                        <>
                          <span className={styles.formulaBefore}>
                            {row.before}
                          </span>
                          <svg
                            className={styles.formulaArrow}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </>
                      ) : null}
                      <span className={styles.formulaAfter}>{row.after}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {status === "preview" && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={handleConfirm}
                >
                  Apply changes
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleCancel}
                >
                  Dismiss
                </button>
              </div>
            )}

            {status === "accepted" && (
              <div className={styles.statusBanner}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--resize-handle-active)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Changes applied to your sheet</span>
                <button
                  type="button"
                  className={styles.statusAction}
                  onClick={handleReset}
                >
                  New request
                </button>
              </div>
            )}

            {status === "cancelled" && (
              <div className={styles.statusBanner}>
                <span>Suggestions dismissed</span>
                <button
                  type="button"
                  className={styles.statusAction}
                  onClick={handleReset}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no result */}
        {!showResult && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <SageIcon />
            </div>
            <p className={styles.emptyText}>
              Describe what you&apos;d like to add or change in your model, and
              I&apos;ll suggest the spreadsheet updates.
            </p>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <span className={styles.footerText}>
          Sage previews changes locally before applying
        </span>
      </footer>
    </aside>
  );
};
