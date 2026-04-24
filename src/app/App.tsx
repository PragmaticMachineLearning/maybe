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
  const [docsOpen, setDocsOpen] = useState(false);
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

  const handleToggleDocs = () => {
    setDocsOpen((isOpen) => !isOpen);
  };

  const handleCloseAiPanel = () => {
    setAiPanelOpen(false);
  };

  const handleCloseDocs = () => {
    setDocsOpen(false);
  };

  return (
    <AppLayout
      selectedCell={selectedCell}
      useFlowDiag={useflowDiag}
      aiPanelOpen={aiPanelOpen}
      docsOpen={docsOpen}
      isCompactLayout={isCompactLayout}
      onCellSelect={handleCellSelect}
      onToggleFlowDiag={handleToggleFlowDiag}
      onToggleAiPanel={handleToggleAiPanel}
      onToggleDocs={handleToggleDocs}
      onCloseAiPanel={handleCloseAiPanel}
      onCloseDocs={handleCloseDocs}
    />
  );
};

export const App: React.FC = () => (
  <SpreadsheetProvider>
    <SpreadsheetWithWizard />
  </SpreadsheetProvider>
);
