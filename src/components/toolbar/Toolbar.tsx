import type { ExampleCell, ExampleDefinition } from "../../examples/examples";
import React, { useContext, useEffect, useRef, useState } from "react";

import { SpreadsheetContext } from "../../context/SpreadsheetContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import { spreadsheetExamples } from "../../examples/examples";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  useFlowDiag: boolean;
  aiPanelOpen: boolean;
  onToggleFlowDiag: () => void;
  onToggleAiPanel: () => void;
}

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
);

export const Toolbar: React.FC<ToolbarProps> = ({
  useFlowDiag,
  aiPanelOpen,
  onToggleFlowDiag,
  onToggleAiPanel,
}) => {
  const { formulaEngine } = useContext(SpreadsheetContext);
  const [showExamplesDropdown, setShowExamplesDropdown] = useState(false);
  const examplesDropdownRef = useRef<HTMLDivElement>(null);
  const examplesButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showExamplesDropdown) {
      return;
    }

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
    if (!formulaEngine) {
      return;
    }

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
      if (rowIndex >= targetHeight) {
        return;
      }
      rowData.forEach((cellContent, colIndex) => {
        if (colIndex >= targetWidth) {
          return;
        }
        nextSheet[rowIndex][colIndex] = cellContent ?? null;
      });
    });

    formulaEngine.setSheetContent(0, nextSheet);
    setShowExamplesDropdown(false);
  };

  return (
    <div className={styles.toolbar}>
      <button
        onClick={onToggleFlowDiag}
        className={`${styles.toolbarBtn} ${useFlowDiag ? styles.toolbarBtnActive : ""}`}
        title={
          useFlowDiag
            ? "Switch to spreadsheet view"
            : "Switch to flow diagram view"
        }
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {useFlowDiag ? (
            // Spreadsheet icon
            <>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
            </>
          ) : (
            // Flow diagram icon - 3 nodes connected by 2 edges
            <>
              <circle cx="6" cy="12" r="2" />
              <circle cx="12" cy="8" r="2" />
              <circle cx="18" cy="12" r="2" />
              <line x1="8" y1="12" x2="10" y2="8" />
              <line x1="14" y1="8" x2="16" y2="12" />
            </>
          )}
        </svg>
      </button>

      {/* Examples Button */}
      <div className={styles.examplesWrapper}>
        <button
          ref={examplesButtonRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowExamplesDropdown(!showExamplesDropdown);
          }}
          className={styles.examplesBtn}
          title="Load an example spreadsheet"
        >
          Examples
        </button>
        {showExamplesDropdown && (
          <div ref={examplesDropdownRef} className={styles.dropdown}>
            <div className={styles.dropdownHeader}>Load an example</div>
            {spreadsheetExamples.map((example) => (
              <button
                key={example.id}
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
              Selecting an example replaces the current sheet contents.
            </div>
          </div>
        )}
      </div>

      {/* Panel Toggles + Theme Toggle */}
      <div className={styles.panelToggles}>
        <button
          type="button"
          className={`${styles.panelToggle} ${aiPanelOpen ? styles.panelToggleActive : ""}`}
          onClick={onToggleAiPanel}
          aria-pressed={aiPanelOpen}
          aria-controls="ai-copilot-panel"
          title="Toggle Sage"
        >
          <AiIcon />
          <span>Sage</span>
        </button>

        <div className={styles.themeToggleWrapper}>
          <ThemeToggle showLabel={false} />
        </div>
      </div>
    </div>
  );
};
