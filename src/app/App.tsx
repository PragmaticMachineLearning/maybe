import React, { useEffect, useState } from "react";

import { SpreadsheetProvider } from "../context/SpreadsheetContext";
import { AppLayout } from "./AppLayout";
import type { SelectedCell } from "./analysisState";

const SpreadsheetWithWizard: React.FC = () => {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>({
    row: 0,
    col: 0,
  });
  const [useflowDiag, setUseFlowDiag] = useState<boolean>(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );

  const handleCellSelect = (row: number, col: number) => {
    setSelectedCell({ row, col });
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isCompactLayout = viewportWidth < 1024;

  const handleToggleFlowDiag = () => {
    setUseFlowDiag((prev) => !prev);
  };

  const handleToggleAiPanel = () => {
    setAiPanelOpen((isOpen) => !isOpen);
  };

  const handleCloseAiPanel = () => {
    setAiPanelOpen(false);
  };

  const handleFormulaSubmit = (row: number, col: number, formula: string) => {
    console.log(
      `Formula submitted for ${String.fromCharCode(65 + col)}${row + 1}: ${formula}`,
    );
  };

  return (
    <AppLayout
      selectedCell={selectedCell}
      useFlowDiag={useflowDiag}
      aiPanelOpen={aiPanelOpen}
      isCompactLayout={isCompactLayout}
      onCellSelect={handleCellSelect}
      onToggleFlowDiag={handleToggleFlowDiag}
      onToggleAiPanel={handleToggleAiPanel}
      onCloseAiPanel={handleCloseAiPanel}
      onFormulaSubmit={handleFormulaSubmit}
    />
  );
};

export const App: React.FC = () => (
  <SpreadsheetProvider>
    <SpreadsheetWithWizard />
  </SpreadsheetProvider>
);
