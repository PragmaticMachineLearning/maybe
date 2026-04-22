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
const DEFAULT_SAGE_WIDTH = 340;
const MIN_SAGE_PX = 280;
const MAX_SAGE_PX = 600;

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
  const [sageWidth, setSageWidth] = useState(DEFAULT_SAGE_WIDTH);
  const [isSageDragging, setIsSageDragging] = useState(false);
  const splitAreaRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

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

  // ── Sage panel resize ───────────────────────────────────────────────

  const handleSagePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsSageDragging(true);
  }, []);

  const handleSagePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isSageDragging || !workspaceRef.current) return;

      const rect = workspaceRef.current.getBoundingClientRect();
      const fromRight = rect.right - e.clientX;
      const clamped = Math.min(MAX_SAGE_PX, Math.max(MIN_SAGE_PX, fromRight));
      setSageWidth(clamped);
    },
    [isSageDragging],
  );

  const handleSagePointerUp = useCallback(() => {
    setIsSageDragging(false);
  }, []);

  // Prevent text selection while dragging either handle
  useEffect(() => {
    if (!isDragging && !isSageDragging) return;

    const preventSelection = (e: Event) => e.preventDefault();
    document.addEventListener("selectstart", preventSelection);
    return () => document.removeEventListener("selectstart", preventSelection);
  }, [isDragging, isSageDragging]);

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
        ref={workspaceRef}
        className={`${styles.workspace} ${isDragging || isSageDragging ? styles.workspaceDragging : ""}`}
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

        {/* ── Sage panel with resize handle ── */}
        {aiPanelOpen && (
          <>
            <div
              className={`${styles.sageResizeHandle} ${isSageDragging ? styles.sageResizeHandleActive : ""}`}
              onPointerDown={handleSagePointerDown}
              onPointerMove={handleSagePointerMove}
              onPointerUp={handleSagePointerUp}
              onPointerCancel={handleSagePointerUp}
              aria-label="Resize Sage panel"
              role="separator"
              aria-orientation="vertical"
            >
              <div className={styles.resizeHandleBar} />
            </div>
            <div
              className={styles.sageSlot}
              id="ai-copilot-panel"
              style={{ width: sageWidth }}
            >
              <AICopilotPanel
                onClose={onCloseAiPanel}
                compact={isCompactLayout}
                selectedCell={selectedCell}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
