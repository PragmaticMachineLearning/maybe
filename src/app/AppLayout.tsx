import React from "react";

import { AnalysisPanel } from "../components/analysis/AnalysisPanel";
import { AICopilotPanel } from "../components/ai/AICopilotPanel";
import { FlowDiag } from "../components/flow-diagram/FlowDiag";
import { FormulaBar } from "../components/formula-bar/FormulaBar";
import { Spreadsheet } from "../components/spreadsheet/Spreadsheet";
import { Toolbar } from "../components/toolbar/Toolbar";
import styles from "./AppLayout.module.css";
import type { AnalysisState, SelectedCell } from "./analysisState";

interface AppLayoutProps {
  selectedCell: SelectedCell | null;
  useFlowDiag: boolean;
  insightsOpen: boolean;
  aiPanelOpen: boolean;
  analysisState: AnalysisState | null;
  isCompactLayout: boolean;
  onCellSelect: (row: number, col: number) => void;
  onToggleFlowDiag: () => void;
  onToggleInsights: () => void;
  onToggleAiPanel: () => void;
  onCloseInsights: () => void;
  onCloseAiPanel: () => void;
  onCloseFlowDiag: () => void;
  onFormulaSubmit: (row: number, col: number, formula: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  selectedCell,
  useFlowDiag,
  insightsOpen,
  aiPanelOpen,
  analysisState,
  isCompactLayout,
  onCellSelect,
  onToggleFlowDiag,
  onToggleInsights,
  onToggleAiPanel,
  onCloseInsights,
  onCloseAiPanel,
  onCloseFlowDiag,
  onFormulaSubmit,
}) => (
  <div className={styles.appShell}>
    <header className={styles.toolbarRow}>
      <Toolbar
        useFlowDiag={useFlowDiag}
        onToggleFlowDiag={onToggleFlowDiag}
        insightsOpen={insightsOpen}
        aiPanelOpen={aiPanelOpen}
        onToggleInsights={onToggleInsights}
        onToggleAiPanel={onToggleAiPanel}
      />
    </header>

    {!useFlowDiag && (
      <FormulaBar
        selectedCell={selectedCell}
        onFormulaSubmit={onFormulaSubmit}
      />
    )}

    <div className={styles.workspace}>
      <div className={styles.sheetPane}>
        <Spreadsheet
          rows={50}
          columns={26}
          onCellSelect={onCellSelect}
          selectedCell={selectedCell}
          onOpenAnalysis={onToggleInsights}
        />
      </div>

      {!useFlowDiag && (
        <div className={styles.sidePanels}>
          {insightsOpen && analysisState && (
            <div className={styles.panelSlot} id="insights-panel">
              <AnalysisPanel
                cellLabel={analysisState.cellLabel}
                samples={analysisState.samples}
                distributionType={analysisState.distributionType}
                confidenceInterval={analysisState.confidenceInterval}
                message={analysisState.message}
                onClose={onCloseInsights}
                compact={isCompactLayout}
              />
            </div>
          )}

          {aiPanelOpen && (
            <div className={styles.panelSlot} id="ai-copilot-panel">
              <AICopilotPanel
                onClose={onCloseAiPanel}
                compact={isCompactLayout}
              />
            </div>
          )}
        </div>
      )}

      {useFlowDiag && (
        <div
          className={styles.flowOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onCloseFlowDiag();
            }
          }}
        >
          <div
            className={styles.flowDialog}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onCloseFlowDiag}
              className={styles.flowCloseButton}
              title="Close Flow Diagram"
            >
              ×
            </button>
            <FlowDiag />
          </div>
        </div>
      )}
    </div>
  </div>
);
