import type { ExampleCell, ExampleDefinition } from "../../examples/examples";
import React, { useContext, useEffect, useRef, useState } from "react";

import { SpreadsheetContext } from "../../context/SpreadsheetContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import { spreadsheetExamples } from "../../examples/examples";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  useFlowDiag: boolean;
  aiPanelOpen: boolean;
  docsOpen: boolean;
  onToggleFlowDiag: () => void;
  onToggleAiPanel: () => void;
  onToggleDocs: () => void;
  // Formula bar props (merged)
  selectedCell?: { row: number; col: number } | null;
  formulaValue: string;
  onFormulaChange: (value: string) => void;
  onFormulaCommit: () => void;
  onFormulaCancel: () => void;
}

const FlowDiagIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle cx="6" cy="12" r="2" />
    <circle cx="12" cy="8" r="2" />
    <circle cx="18" cy="12" r="2" />
    <line x1="8" y1="12" x2="10" y2="8" />
    <line x1="14" y1="8" x2="16" y2="12" />
  </svg>
);

const SpreadsheetIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
  </svg>
);

const SageIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
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

const ChevronIcon: React.FC = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const getCellReference = (
  cell: { row: number; col: number } | null | undefined,
): string => {
  if (!cell) return "";
  let result = "";
  let num = cell.col;
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return `${result}${cell.row + 1}`;
};

export const Toolbar: React.FC<ToolbarProps> = ({
  useFlowDiag,
  aiPanelOpen,
  docsOpen,
  onToggleFlowDiag,
  onToggleAiPanel,
  onToggleDocs,
  selectedCell,
  formulaValue,
  onFormulaChange,
  onFormulaCommit,
  onFormulaCancel,
}) => {
  const { formulaEngine } = useContext(SpreadsheetContext);
  const [showExamplesDropdown, setShowExamplesDropdown] = useState(false);
  const examplesDropdownRef = useRef<HTMLDivElement>(null);
  const examplesButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showExamplesDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        examplesDropdownRef.current &&
        !examplesDropdownRef.current.contains(target) &&
        examplesButtonRef.current &&
        !examplesButtonRef.current.contains(target)
      ) {
        setShowExamplesDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExamplesDropdown]);

  const handleExampleSelect = (example: ExampleDefinition) => {
    if (!formulaEngine) return;

    const { width, height } = formulaEngine.getSheetDimensions(0);
    const requiredWidth = example.data.reduce(
      (max, row) => Math.max(max, row.length),
      0,
    );
    const targetWidth = Math.max(width, requiredWidth);
    const targetHeight = Math.max(height, example.data.length);

    const nextSheet: ExampleCell[][] = Array.from(
      { length: targetHeight },
      () => Array.from({ length: targetWidth }, (): ExampleCell => null),
    );

    example.data.forEach((rowData, rowIndex) => {
      if (rowIndex >= targetHeight) return;
      rowData.forEach((cellContent, colIndex) => {
        if (colIndex >= targetWidth) return;
        nextSheet[rowIndex][colIndex] = cellContent ?? null;
      });
    });

    formulaEngine.setSheetContent(0, nextSheet);
    setShowExamplesDropdown(false);
  };

  const handleFormulaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onFormulaCommit();
    } else if (e.key === "Escape") {
      onFormulaCancel();
    }
  };

  const cellRef = getCellReference(selectedCell);

  return (
    <div className={styles.toolbar}>
      {/* ── Left: view controls ──────────────────────────────────── */}
      <div className={styles.leftGroup}>
        <button
          type="button"
          onClick={onToggleFlowDiag}
          className={`${styles.iconBtn} ${useFlowDiag ? styles.iconBtnActive : ""}`}
          title={
            useFlowDiag ? "Switch to spreadsheet view" : "Show dependency graph"
          }
          aria-pressed={useFlowDiag}
        >
          {useFlowDiag ? <SpreadsheetIcon /> : <FlowDiagIcon />}
        </button>

        <div className={styles.separator} />

        <div className={styles.examplesWrapper}>
          <button
            ref={examplesButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowExamplesDropdown(!showExamplesDropdown);
            }}
            className={`${styles.textBtn} ${showExamplesDropdown ? styles.textBtnActive : ""}`}
            title="Load an example spreadsheet"
          >
            <span>Examples</span>
            <ChevronIcon />
          </button>

          {showExamplesDropdown && (
            <div ref={examplesDropdownRef} className={styles.dropdown}>
              <div className={styles.dropdownHeader}>Load an example</div>
              {spreadsheetExamples.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExampleSelect(example);
                  }}
                  className={styles.dropdownItem}
                >
                  <div className={styles.dropdownItemName}>{example.name}</div>
                  <div className={styles.dropdownItemDesc}>
                    {example.description}
                  </div>
                </button>
              ))}
              <div className={styles.dropdownFooter}>
                This replaces your current sheet.
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleDocs}
          className={`${styles.textBtn} ${docsOpen ? styles.textBtnActive : ""}`}
          title="Open Maybe documentation"
          aria-pressed={docsOpen}
        >
          Docs
        </button>
      </div>

      {/* ── Center: formula bar ──────────────────────────────────── */}
      <div className={styles.formulaGroup}>
        {cellRef && <span className={styles.cellRef}>{cellRef}</span>}
        <input
          type="text"
          value={formulaValue}
          onChange={(e) => onFormulaChange(e.target.value)}
          onKeyDown={handleFormulaKeyDown}
          onBlur={onFormulaCommit}
          className={styles.formulaInput}
          placeholder={
            selectedCell ? "Enter value or formula…" : "Select a cell"
          }
          disabled={!selectedCell}
        />
      </div>

      {/* ── Right: Sage + theme ──────────────────────────────────── */}
      <div className={styles.rightGroup}>
        <button
          type="button"
          className={`${styles.sageBtn} ${aiPanelOpen ? styles.sageBtnActive : ""}`}
          onClick={onToggleAiPanel}
          aria-pressed={aiPanelOpen}
          aria-controls="ai-copilot-panel"
          title="Toggle Ask Maybe"
        >
          <SageIcon />
          <span>Ask Maybe</span>
        </button>

        <div className={styles.separator} />

        <ThemeToggle showLabel={false} />
      </div>
    </div>
  );
};
