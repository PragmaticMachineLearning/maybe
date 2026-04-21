import React, { useEffect, useRef, useState } from "react";

import {
  createMockCopilotResult,
  type MockCopilotResult,
  type CopilotDiffRow,
} from "./aiCopilotMock";
import styles from "./AICopilotPanel.module.css";

interface AICopilotPanelProps {
  onClose: () => void;
  compact?: boolean;
  selectedCell?: { row: number; col: number } | null;
}

const SageIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
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

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
  onClose,
  compact = false,
}) => {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<MockCopilotResult | null>(null);
  const [status, setStatus] = useState<
    "idle" | "preview" | "accepted" | "cancelled"
  >("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    setResult(createMockCopilotResult(prompt));
    setStatus("preview");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim()) {
        setResult(createMockCopilotResult(prompt));
        setStatus("preview");
      }
    }
  };

  const handleConfirm = () => {
    setStatus("accepted");
  };

  const handleDismiss = () => {
    setStatus("cancelled");
  };

  const handleNewRequest = () => {
    setResult(null);
    setStatus("idle");
    setPrompt("");
    inputRef.current?.focus();
  };

  // Scroll to bottom when new results appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [result, status]);

  const hasResult =
    result != null &&
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
            <SageIcon size={16} />
          </div>
          <span className={styles.title}>Sage</span>
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

      {/* ── Scrollable content area ────────────────────────────────── */}
      <div ref={scrollRef} className={styles.content}>
        {/* Empty state */}
        {!hasResult && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <SageIcon size={20} />
            </div>
            <p className={styles.emptyTitle}>What can I help you build?</p>
            <p className={styles.emptyHint}>
              Describe a change to your model — I&apos;ll suggest the
              spreadsheet updates.
            </p>
          </div>
        )}

        {/* Results */}
        {hasResult && result && (
          <div className={styles.results}>
            {/* User's prompt (shown as context) */}
            <div className={styles.userPrompt}>
              <span className={styles.userPromptText}>{result.message}</span>
            </div>

            {/* Change list */}
            <div className={styles.changeList}>
              {result.preview.rows.map((row) => (
                <ChangeRow key={row.cell} row={row} />
              ))}
            </div>

            {/* Inline actions */}
            {status === "preview" && (
              <div className={styles.inlineActions}>
                <button
                  type="button"
                  className={styles.applyBtn}
                  onClick={handleConfirm}
                >
                  Apply {result.preview.rows.length} change
                  {result.preview.rows.length !== 1 ? "s" : ""}
                </button>
                <button
                  type="button"
                  className={styles.dismissBtn}
                  onClick={handleDismiss}
                >
                  Dismiss
                </button>
              </div>
            )}

            {status === "accepted" && (
              <div className={styles.statusRow}>
                <span className={styles.statusDot} />
                <span className={styles.statusText}>Applied</span>
                <button
                  type="button"
                  className={styles.statusLink}
                  onClick={handleNewRequest}
                >
                  New request
                </button>
              </div>
            )}

            {status === "cancelled" && (
              <div className={styles.statusRow}>
                <span className={styles.statusText}>Dismissed</span>
                <button
                  type="button"
                  className={styles.statusLink}
                  onClick={handleNewRequest}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Input area (anchored to bottom) ────────────────────────── */}
      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what to change…"
          rows={1}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!prompt.trim()}
          title="Send"
          aria-label="Send"
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
      </form>
    </aside>
  );
};

// ── Change row (compact, single-line-ish) ───────────────────────────────────

const ChangeRow: React.FC<{ row: CopilotDiffRow }> = ({ row }) => {
  const toneClass =
    row.tone === "add"
      ? styles.toneAdd
      : row.tone === "change"
        ? styles.toneChange
        : styles.toneReview;

  return (
    <div className={`${styles.changeRow} ${toneClass}`}>
      <div className={styles.changeTop}>
        <span className={styles.changeTone}>{toneLabels[row.tone]}</span>
        <span className={styles.changeCell}>{row.cell}</span>
        {row.before ? (
          <span className={styles.changeArrow}>
            <span className={styles.changeBefore}>{row.before}</span>
            <span className={styles.changeArrowIcon}>→</span>
            <span className={styles.changeAfter}>{row.after}</span>
          </span>
        ) : (
          <span className={styles.changeAfter}>{row.after}</span>
        )}
      </div>
      <p className={styles.changeReason}>{row.reason}</p>
    </div>
  );
};
