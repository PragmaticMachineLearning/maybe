import React, { useCallback, useEffect, useRef, useState } from "react";

import { AICopilotPanel } from "../components/ai/AICopilotPanel";
import { FlowDiag } from "../components/flow-diagram/FlowDiag";
import { Spreadsheet } from "../components/spreadsheet/Spreadsheet";
import { Toolbar } from "../components/toolbar/Toolbar";
import { useFormulaBar } from "../hooks/useFormulaBar";
import styles from "./AppLayout.module.css";
import type { SelectedCell } from "./analysisState";

interface AppLayoutProps {
  selectedCell: SelectedCell | null;
  useFlowDiag: boolean;
  aiPanelOpen: boolean;
  isCompactLayout: boolean;
  onCellSelect: (row: number, col: number) => void;
  onToggleFlowDiag: () => void;
  onToggleAiPanel: () => void;
  onCloseAiPanel: () => void;
}

const MIN_SHEET_PX = 200;
const MIN_FLOW_PX = 200;

export const AppLayout: React.FC<AppLayoutProps> = ({
  selectedCell,
  useFlowDiag,
  aiPanelOpen,
  isCompactLayout,
  onCellSelect,
  onToggleFlowDiag,
  onToggleAiPanel,
  onCloseAiPanel,
}) => {
  const { formulaValue, onFormulaChange, onFormulaCommit, onFormulaCancel } =
    useFormulaBar(selectedCell);
  // sheetWidth is stored in pixels; null means "not yet measured / use default 50%"
  const [sheetWidth, setSheetWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const splitAreaRef = useRef<HTMLDivElement>(null);

  // When the flow diagram is first toggled on, initialise sheetWidth to half
  // the available split area.
  useEffect(() => {
    if (useFlowDiag && sheetWidth === null && splitAreaRef.current) {
      setSheetWidth(splitAreaRef.current.getBoundingClientRect().width / 2);
    }
    if (!useFlowDiag) {
      setSheetWidth(null);
    }
  }, [useFlowDiag, sheetWidth]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !splitAreaRef.current) return;

      const rect = splitAreaRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const maxSheet = rect.width - MIN_FLOW_PX;
      const clamped = Math.min(maxSheet, Math.max(MIN_SHEET_PX, offsetX));
      setSheetWidth(clamped);
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Prevent text selection while dragging
  useEffect(() => {
    if (!isDragging) return;

    const preventSelection = (e: Event) => e.preventDefault();
    document.addEventListener("selectstart", preventSelection);
    return () => document.removeEventListener("selectstart", preventSelection);
  }, [isDragging]);

  return (
    <div className={styles.appShell}>
      <header className={styles.toolbarRow}>
        <Toolbar
          useFlowDiag={useFlowDiag}
          onToggleFlowDiag={onToggleFlowDiag}
          aiPanelOpen={aiPanelOpen}
          onToggleAiPanel={onToggleAiPanel}
          selectedCell={selectedCell}
          formulaValue={formulaValue}
          onFormulaChange={onFormulaChange}
          onFormulaCommit={onFormulaCommit}
          onFormulaCancel={onFormulaCancel}
        />
      </header>

      <div
        className={`${styles.workspace} ${isDragging ? styles.workspaceDragging : ""}`}
      >
        {/* ── Split area: sheet + handle + flow (takes remaining space) ── */}
        <div
          ref={splitAreaRef}
          className={useFlowDiag ? styles.splitArea : styles.sheetPane}
        >
          {useFlowDiag ? (
            <>
              <div
                className={styles.sheetPaneSplit}
                style={
                  sheetWidth !== null
                    ? { width: sheetWidth }
                    : { flex: "1 1 50%" }
                }
              >
                <Spreadsheet
                  rows={50}
                  columns={26}
                  onCellSelect={onCellSelect}
                  selectedCell={selectedCell}
                />
              </div>

              <div
                className={`${styles.resizeHandle} ${isDragging ? styles.resizeHandleActive : ""}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                aria-label="Resize split panes"
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={
                  sheetWidth !== null ? Math.round(sheetWidth) : 50
                }
                aria-valuemin={MIN_SHEET_PX}
                aria-valuemax={800}
              >
                <div className={styles.resizeHandleBar} />
              </div>

              <div className={styles.flowPane}>
                <FlowDiag
                  selectedCell={selectedCell}
                  onCellSelect={onCellSelect}
                />
              </div>
            </>
          ) : (
            <Spreadsheet
              rows={50}
              columns={26}
              onCellSelect={onCellSelect}
              selectedCell={selectedCell}
            />
          )}
        </div>

        {/* ── Side panels (AI) — always outside the split area ── */}
        <div className={styles.sidePanels}>
          {aiPanelOpen && (
            <div className={styles.panelSlot} id="ai-copilot-panel">
              <AICopilotPanel
                onClose={onCloseAiPanel}
                compact={isCompactLayout}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
