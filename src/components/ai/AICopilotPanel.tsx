import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  extractAssistantProposalFromText,
  stripAssistantProposalFromText,
  validateAssistantProposal,
  type AssistantCellChange,
} from "../../assistant/proposals";
import { SpreadsheetContext } from "../../context/SpreadsheetContext";
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

const toneLabels: Record<AssistantCellChange["kind"], string> = {
  update: "Update",
  add: "New",
  review: "Review",
};

const getMessageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

const proposalFence = "```maybe-proposal";

const getVisibleAssistantText = (rawText: string): string => {
  const proposalStartIndex = rawText.lastIndexOf(proposalFence);

  if (proposalStartIndex !== -1) {
    const proposalEndIndex = rawText.indexOf(
      "```",
      proposalStartIndex + proposalFence.length,
    );

    if (proposalEndIndex === -1) {
      return rawText.slice(0, proposalStartIndex).trim();
    }
  }

  return stripAssistantProposalFromText(rawText);
};

const getReadableError = (error: Error | undefined): string | null => {
  if (!error) return null;

  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Non-JSON transport errors are already readable enough to show.
  }

  return error.message;
};

const getUnknownErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? (getReadableError(error) ?? error.message)
    : "Unable to contact Sage.";

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
  onClose,
  compact = false,
  selectedCell = null,
}) => {
  const { getWorkbookSnapshot, applyAssistantChanges } =
    useContext(SpreadsheetContext);
  const [prompt, setPrompt] = useState("");
  const [dismissedProposalKey, setDismissedProposalKey] = useState<
    string | null
  >(null);
  const [appliedProposalKey, setAppliedProposalKey] = useState<string | null>(
    null,
  );
  const [applyError, setApplyError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/assistant" }),
    [],
  );
  const {
    messages,
    sendMessage,
    status,
    error,
    clearError,
  } = useChat<UIMessage>({
    transport,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitPrompt();
  };

  const submitPrompt = async () => {
    const text = prompt.trim();
    if (!text) return;

    setPrompt("");
    setApplyError(null);
    setRequestError(null);
    clearError();
    const workbookSnapshot = getWorkbookSnapshot(selectedCell ?? null);
    try {
      await sendMessage({ text }, { body: { workbookSnapshot } });
    } catch (caughtError) {
      setRequestError(getUnknownErrorMessage(caughtError));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitPrompt();
    }
  };

  const assistantMessages = messages.filter(
    (message) => message.role === "assistant",
  );
  const latestAssistantWithProposal = assistantMessages
    .slice()
    .reverse()
    .map((message) => ({
      message,
      text: getMessageText(message),
    }))
    .find(({ text }) => extractAssistantProposalFromText(text) !== null);
  const latestProposal = latestAssistantWithProposal
    ? extractAssistantProposalFromText(latestAssistantWithProposal.text)
    : null;
  const latestProposalKey =
    latestAssistantWithProposal && latestProposal
      ? `${latestAssistantWithProposal.message.id}:${JSON.stringify(latestProposal)}`
      : null;
  const proposalIsApplied =
    latestProposalKey !== null && latestProposalKey === appliedProposalKey;
  const proposalIsDismissed =
    latestProposalKey !== null && latestProposalKey === dismissedProposalKey;
  const proposalNeedsValidation =
    latestProposal !== null &&
    latestProposalKey !== null &&
    !proposalIsApplied &&
    !proposalIsDismissed;
  const validationSnapshot = proposalNeedsValidation
    ? getWorkbookSnapshot(selectedCell ?? null)
    : null;
  const proposalValidation =
    proposalNeedsValidation && validationSnapshot
      ? validateAssistantProposal(latestProposal, validationSnapshot)
      : null;
  const showProposal =
    latestProposal !== null &&
    latestProposalKey !== null &&
    !proposalIsDismissed;
  const displayProposal = proposalValidation?.proposal ?? latestProposal;
  const canApplyProposal =
    proposalValidation?.valid === true &&
    proposalValidation.applyableChanges.length > 0;
  const transportError = getReadableError(error) ?? requestError;
  const isBusy = status === "submitted" || status === "streaming";

  const handleConfirm = () => {
    if (!proposalValidation || !canApplyProposal || !latestProposalKey) return;

    setApplyError(null);

    try {
      applyAssistantChanges(proposalValidation.applyableChanges);
      setAppliedProposalKey(latestProposalKey);
    } catch (caughtError) {
      setApplyError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to apply Sage's proposal.",
      );
    }
  };

  const handleDismiss = () => {
    if (latestProposalKey) {
      setDismissedProposalKey(latestProposalKey);
    }
  };

  // Scroll to bottom when new results appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status, showProposal, applyError, transportError]);

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
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <SageIcon size={20} />
            </div>
            <p className={styles.emptyTitle}>Ask Sage about this workbook</p>
            <p className={styles.emptyHint}>
              Sage can inspect workbook values, formulas, and uncertainty, then
              suggest spreadsheet updates for you to review.
            </p>
          </div>
        )}

        {messages.length > 0 && (
          <div className={styles.messages}>
            {messages.map((message) => {
              const rawText = getMessageText(message);
              const visibleText =
                message.role === "assistant"
                  ? getVisibleAssistantText(rawText)
                  : rawText;

              if (!visibleText) return null;

              return (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? styles.userPrompt
                      : styles.assistantMessage
                  }
                >
                  <span className={styles.userPromptText}>{visibleText}</span>
                </div>
              );
            })}
          </div>
        )}

        {isBusy && (
          <div className={styles.statusRow}>
            <span className={styles.statusDot} />
            <span className={styles.statusText}>Sage is thinking…</span>
          </div>
        )}

        {transportError && <div className={styles.errorBox}>{transportError}</div>}
        {proposalNeedsValidation && !validationSnapshot && (
          <div className={styles.errorBox}>
            Sage prepared a proposal, but the workbook is not ready for review.
          </div>
        )}
        {proposalNeedsValidation &&
          proposalValidation?.errors.map((validationError) => (
            <div key={validationError} className={styles.errorBox}>
              {validationError}
            </div>
          ))}
        {applyError && <div className={styles.errorBox}>{applyError}</div>}

        {/* Results */}
        {showProposal && displayProposal && (
          <div className={styles.results}>
            <div className={styles.changeList}>
              {displayProposal.changes.map((row, index) => (
                <ChangeRow
                  key={`${row.cell}:${row.kind}:${index}`}
                  row={row}
                />
              ))}
            </div>

            {/* Inline actions */}
            {proposalIsApplied ? (
              <div className={styles.statusRow}>
                <span className={styles.statusDot} />
                <span className={styles.statusText}>Applied</span>
              </div>
            ) : (
              <div className={styles.inlineActions}>
                <button
                  type="button"
                  className={`${styles.applyBtn} ${
                    !canApplyProposal
                      ? styles.applyBtnDisabled
                      : ""
                  }`}
                  onClick={handleConfirm}
                  disabled={!canApplyProposal}
                >
                  Apply {proposalValidation?.applyableChanges.length ?? 0}{" "}
                  change
                  {proposalValidation?.applyableChanges.length !== 1
                    ? "s"
                    : ""}
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
          disabled={isBusy}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!prompt.trim() || isBusy}
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

const ChangeRow: React.FC<{ row: AssistantCellChange }> = ({ row }) => {
  const toneClass =
    row.kind === "add"
      ? styles.toneAdd
      : row.kind === "update"
        ? styles.toneChange
        : styles.toneReview;

  return (
    <div className={`${styles.changeRow} ${toneClass}`}>
      <div className={styles.changeTop}>
        <span className={styles.changeTone}>{toneLabels[row.kind]}</span>
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
