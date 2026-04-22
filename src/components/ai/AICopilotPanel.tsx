import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  extractAssistantProposalResultFromParts,
  extractAssistantProposalFromText,
  stripAssistantProposalFromText,
  validateAssistantProposal,
  type AssistantCellChange,
  type AssistantProposalResult,
} from "../../assistant/proposals";
import {
  ASSISTANT_MODEL_OPTIONS,
  DEFAULT_ASSISTANT_MODEL_ID,
  type AssistantModelId,
} from "../../assistant/modelOptions";
import { SpreadsheetContext } from "../../context/SpreadsheetContext";
import styles from "./AICopilotPanel.module.css";

type ProposalValidationResult = ReturnType<typeof validateAssistantProposal>;
type AssistantMode = "ask" | "write";

const ASSISTANT_MODE_OPTIONS: Array<{
  id: AssistantMode;
  label: string;
}> = [
  { id: "ask", label: "Ask" },
  { id: "write", label: "Write" },
];

const getPromptPlaceholder = (mode: AssistantMode): string =>
  mode === "write"
    ? "Tell Sage what to change. Write mode can apply safe workbook edits directly..."
    : "Ask Sage about formulas, uncertainty, or what to change next...";

interface AssistantMessageProposalEntry {
  key: string;
  messageId: string;
  result: AssistantProposalResult;
  isApplied: boolean;
  isDismissed: boolean;
  needsValidation: boolean;
  validation: ProposalValidationResult | null;
  displayProposal: AssistantProposalResult["proposal"];
  canApply: boolean;
  show: boolean;
}

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

const getMessageProposalResult = (
  message: UIMessage,
): AssistantProposalResult | null => {
  const toolProposal = extractAssistantProposalResultFromParts(message.parts);
  if (toolProposal !== null) {
    return toolProposal;
  }

  const textProposal = extractAssistantProposalFromText(
    getMessageText(message),
  );
  return textProposal === null
    ? null
    : { proposal: textProposal, source: "text" };
};

const getProposalKey = (
  message: UIMessage,
  proposal: AssistantProposalResult["proposal"],
): string => `${message.id}:${JSON.stringify(proposal)}`;

const proposalFencePattern = /```(?:maybe-proposal|json)/g;

const getVisibleAssistantText = (rawText: string): string => {
  const proposalStarts = [...rawText.matchAll(proposalFencePattern)];
  const latestProposalStart = proposalStarts[proposalStarts.length - 1];
  const proposalStartIndex = latestProposalStart?.index ?? -1;

  if (proposalStartIndex !== -1 && latestProposalStart) {
    const proposalEndIndex = rawText.indexOf(
      "```",
      proposalStartIndex + latestProposalStart[0].length,
    );

    if (proposalEndIndex === -1) {
      return rawText.slice(0, proposalStartIndex).trim();
    }
  }

  return stripAssistantProposalFromText(rawText);
};

const renderInlineText = (text: string, keyPrefix: string): React.ReactNode[] =>
  text
    .split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
    .filter((token) => token.length > 0)
    .map((token, index) => {
      const key = `${keyPrefix}-${index}`;

      if (token.startsWith("**") && token.endsWith("**")) {
        return (
          <strong key={key} className={styles.assistantStrong}>
            {token.slice(2, -2)}
          </strong>
        );
      }

      if (token.startsWith("`") && token.endsWith("`")) {
        return (
          <code key={key} className={styles.assistantInlineCode}>
            {token.slice(1, -1)}
          </code>
        );
      }

      return <React.Fragment key={key}>{token}</React.Fragment>;
    });

const FormattedAssistantText: React.FC<{ text: string }> = ({ text }) => {
  const elements: React.ReactNode[] = [];
  let paragraphLines: string[] = [];
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;

    const elementIndex = elements.length;
    elements.push(
      <p
        key={`paragraph-${elementIndex}`}
        className={styles.assistantParagraph}
      >
        {renderInlineText(
          paragraphLines.join(" "),
          `paragraph-${elementIndex}`,
        )}
      </p>,
    );
    paragraphLines = [];
  };

  const flushBulletList = () => {
    if (bulletItems.length === 0) return;

    const elementIndex = elements.length;
    elements.push(
      <ul key={`bullets-${elementIndex}`} className={styles.assistantList}>
        {bulletItems.map((item, itemIndex) => (
          <li key={`bullet-${elementIndex}-${itemIndex}`}>
            {renderInlineText(item, `bullet-${elementIndex}-${itemIndex}`)}
          </li>
        ))}
      </ul>,
    );
    bulletItems = [];
  };

  const flushNumberedList = () => {
    if (numberedItems.length === 0) return;

    const elementIndex = elements.length;
    elements.push(
      <ol key={`numbers-${elementIndex}`} className={styles.assistantList}>
        {numberedItems.map((item, itemIndex) => (
          <li key={`number-${elementIndex}-${itemIndex}`}>
            {renderInlineText(item, `number-${elementIndex}-${itemIndex}`)}
          </li>
        ))}
      </ol>,
    );
    numberedItems = [];
  };

  const flushLists = () => {
    flushBulletList();
    flushNumberedList();
  };

  const flushCodeBlock = () => {
    if (codeLines.length === 0) return;

    const elementIndex = elements.length;
    elements.push(
      <pre key={`code-${elementIndex}`} className={styles.assistantCodeBlock}>
        <code>{codeLines.join("\n")}</code>
      </pre>,
    );
    codeLines = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      flushParagraph();
      flushLists();

      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }

      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (trimmedLine.length === 0) {
      flushParagraph();
      flushLists();
      continue;
    }

    const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      flushNumberedList();
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    const numberedMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      flushBulletList();
      numberedItems.push(numberedMatch[1]);
      continue;
    }

    flushLists();
    paragraphLines.push(trimmedLine);
  }

  flushParagraph();
  flushLists();
  flushCodeBlock();

  return <>{elements}</>;
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
  const [dismissedProposalKeys, setDismissedProposalKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("ask");
  const [selectedModel, setSelectedModel] = useState<AssistantModelId>(
    DEFAULT_ASSISTANT_MODEL_ID,
  );
  const [appliedProposalKeys, setAppliedProposalKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [applyError, setApplyError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/assistant" }),
    [],
  );
  const { messages, sendMessage, status, error, clearError } =
    useChat<UIMessage>({
      transport,
    });

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

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
    const allowDirectCellChanges = assistantMode === "write";
    try {
      await sendMessage(
        { text },
        { body: { workbookSnapshot, allowDirectCellChanges, selectedModel } },
      );
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
  const proposalCandidates = assistantMessages
    .map((message) => {
      const result = getMessageProposalResult(message);

      if (result === null) {
        return null;
      }

      const key = getProposalKey(message, result.proposal);
      const isApplied = appliedProposalKeys.has(key);
      const isDismissed = dismissedProposalKeys.has(key);

      return {
        key,
        messageId: message.id,
        result,
        isApplied,
        isDismissed,
        needsValidation: !isApplied && !isDismissed,
      };
    })
    .filter((entry) => entry !== null);
  const needsProposalValidation = proposalCandidates.some(
    (entry) => entry.needsValidation,
  );
  const validationSnapshot = needsProposalValidation
    ? getWorkbookSnapshot(selectedCell ?? null)
    : null;
  const proposalEntries: AssistantMessageProposalEntry[] =
    proposalCandidates.map((entry) => {
      const validation =
        entry.needsValidation && validationSnapshot
          ? validateAssistantProposal(entry.result.proposal, validationSnapshot)
          : null;
      const displayProposal = validation?.proposal ?? entry.result.proposal;
      const canApply =
        validation?.valid === true && validation.applyableChanges.length > 0;

      return {
        ...entry,
        validation,
        displayProposal,
        canApply,
        show: !entry.isDismissed,
      };
    });
  const proposalEntryByMessageId = new Map(
    proposalEntries.map((entry) => [entry.messageId, entry]),
  );
  const visibleProposalKeys = proposalEntries
    .filter((entry) => entry.show)
    .map((entry) => entry.key)
    .join("|");
  const transportError = getReadableError(error) ?? requestError;
  const isBusy = status === "submitted" || status === "streaming";
  const allowDirectCellChanges = assistantMode === "write";

  const markProposalApplied = useCallback((proposalKey: string) => {
    setAppliedProposalKeys((currentKeys) => {
      if (currentKeys.has(proposalKey)) {
        return currentKeys;
      }

      const nextKeys = new Set(currentKeys);
      nextKeys.add(proposalKey);
      return nextKeys;
    });
  }, []);

  const applyProposal = useCallback(
    (proposalKey: string, validation: ProposalValidationResult) => {
      if (!validation.valid || validation.applyableChanges.length === 0) return;

      setApplyError(null);

      try {
        applyAssistantChanges(validation.applyableChanges);
        markProposalApplied(proposalKey);
      } catch (caughtError) {
        setApplyError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to apply Sage's proposal.",
        );
      }
    },
    [applyAssistantChanges, markProposalApplied],
  );

  const handleDismiss = (proposalKey: string) => {
    setDismissedProposalKeys((currentKeys) => {
      if (currentKeys.has(proposalKey)) {
        return currentKeys;
      }

      const nextKeys = new Set(currentKeys);
      nextKeys.add(proposalKey);
      return nextKeys;
    });
  };

  const autoApplyProposal =
    allowDirectCellChanges && applyError === null
      ? proposalEntries.find(
          (entry) =>
            entry.show &&
            !entry.isApplied &&
            entry.canApply &&
            entry.validation !== null,
        )
      : undefined;

  // Scroll to bottom when new results appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status, visibleProposalKeys, applyError, transportError]);

  useEffect(() => {
    if (!autoApplyProposal?.validation) {
      return;
    }

    applyProposal(autoApplyProposal.key, autoApplyProposal.validation);
  }, [applyProposal, autoApplyProposal]);

  const renderProposalCard = (entry: AssistantMessageProposalEntry) => {
    if (!entry.show) return null;

    const isAutoApplyingProposal =
      allowDirectCellChanges &&
      entry.canApply &&
      !entry.isApplied &&
      applyError === null;

    return (
      <>
        {entry.needsValidation && !validationSnapshot && (
          <div className={styles.errorBox}>
            Sage prepared a proposal, but the workbook is not ready for review.
          </div>
        )}
        {entry.needsValidation &&
          entry.validation?.errors.map((validationError) => (
            <div
              key={`${entry.key}:${validationError}`}
              className={styles.errorBox}
            >
              {validationError}
            </div>
          ))}
        <div className={styles.results}>
          <div className={styles.changeList}>
            {entry.displayProposal.changes.map((row, index) => (
              <ChangeRow key={`${row.cell}:${row.kind}:${index}`} row={row} />
            ))}
          </div>

          {entry.isApplied ? (
            <div className={styles.statusRow}>
              <span className={styles.statusDot} />
              <span className={styles.statusText}>Applied</span>
            </div>
          ) : allowDirectCellChanges ? (
            isAutoApplyingProposal ? (
              <div className={styles.statusRow}>
                <span className={styles.statusDot} />
                <span className={styles.statusText}>Applying</span>
              </div>
            ) : null
          ) : (
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={`${styles.applyBtn} ${
                  !entry.canApply ? styles.applyBtnDisabled : ""
                }`}
                onClick={() => {
                  if (entry.validation) {
                    applyProposal(entry.key, entry.validation);
                  }
                }}
                disabled={!entry.canApply}
              >
                Apply {entry.validation?.applyableChanges.length ?? 0} change
                {entry.validation?.applyableChanges.length !== 1 ? "s" : ""}
              </button>
              <button
                type="button"
                className={styles.dismissBtn}
                onClick={() => handleDismiss(entry.key)}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

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
        <div className={styles.headerActions}>
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
        </div>
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
              const proposalEntry =
                message.role === "assistant"
                  ? proposalEntryByMessageId.get(message.id)
                  : undefined;

              if (!visibleText && !proposalEntry?.show) return null;

              return (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? styles.userPrompt
                      : styles.assistantMessage
                  }
                >
                  {message.role === "assistant" && visibleText ? (
                    <FormattedAssistantText text={visibleText} />
                  ) : message.role === "user" ? (
                    <span className={styles.userPromptText}>{visibleText}</span>
                  ) : null}
                  {proposalEntry ? renderProposalCard(proposalEntry) : null}
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

        {transportError && (
          <div className={styles.errorBox}>{transportError}</div>
        )}
        {applyError && <div className={styles.errorBox}>{applyError}</div>}
      </div>

      {/* ── Input area (anchored to bottom) ────────────────────────── */}
      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className={styles.input}
          aria-label="Message Sage"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPromptPlaceholder(assistantMode)}
          rows={1}
          disabled={isBusy}
        />
        <div className={styles.composerControls}>
          <select
            aria-label="Sage mode"
            className={styles.composerSelect}
            value={assistantMode}
            onChange={(event) =>
              setAssistantMode(event.target.value as AssistantMode)
            }
            disabled={isBusy}
          >
            {ASSISTANT_MODE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Sage model"
            className={styles.composerSelect}
            value={selectedModel}
            onChange={(event) =>
              setSelectedModel(event.target.value as AssistantModelId)
            }
            disabled={isBusy}
          >
            {ASSISTANT_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className={styles.composerSpacer} />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!prompt.trim() || isBusy}
            title="Send"
            aria-label="Send"
          >
            <svg
              width="14"
              height="14"
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
    </aside>
  );
};

// ── Change row (compact, single-line-ish) ───────────────────────────────────

const ChangeRow: React.FC<{ row: AssistantCellChange }> = ({ row }) => {
  return (
    <div className={styles.changeRow}>
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
