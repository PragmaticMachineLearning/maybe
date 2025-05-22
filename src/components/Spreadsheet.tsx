

interface SpreadsheetProps {
  rows: number;
  columns: number;
  onCellSelect?: (row: number, col: number) => void;
  selectedCell?: { row: number; col: number } | null;
}

export const Spreadsheet: React.FC<SpreadsheetProps> = ({
  rows,
  columns,
  onCellSelect,
  selectedCell,
}) => {


  useEffect(() => {
    if (!hfInstance) return;

    const updateCellData = () => {
      const updated: Array<Array<any>> = [];
      for (let r = 0; r < rows; r++) {
        updated[r] = [];
        for (let c = 0; c < columns; c++) {
          const addr = { sheet: 0, row: r, col: c };
          updated[r][c] = hfInstance.getCellValue(addr) ?? "";
        }
      }
      setCellData(updated);
    };

    // Initial update
    updateCellData();

    // Subscribe to changes
    hfInstance.on("valuesUpdated", updateCellData);

    // Register custom functions
    // registerCustomFunctions(hfInstance);

    return () => {
      hfInstance.off("valuesUpdated", updateCellData);
    };
  }, [hfInstance, rows, columns]);

  const renderHeader = () => (
    <tr>
      <th style={headerStyle}></th>
      {Array.from({ length: columns }).map((_, idx) => (
        <th key={idx} style={headerStyle}>
          {String.fromCharCode(65 + idx)}
        </th>
      ))}
    </tr>
  );

  const handleCellValueChange = (row: number, col: number, value: string) => {
    // Pass value directly to HyperFormula
    updateCell(row, col, value);
  };



  return (
    <div style={{ overflowX: "auto", padding: "20px" }}>
      <table style={tableStyle}>
        <thead>{renderHeader()}</thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              <td style={headerStyle}>{r + 1}</td>
              {Array.from({ length: columns }).map((_, c) => (
                <CellRenderer
                  key={`${r}-${c}`}
                  row={r}
                  col={c}
                  value={cellData[r]?.[c]}
                  onEdit={(row, col, value) => {
                    if (hfInstance) {

                    }
                  }}
                  onClick={() => onCellSelect?.(r, c)}
                  isSelected={
                    selectedCell?.row === r && selectedCell?.col === c
                  }
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const tableStyle = {
  borderCollapse: "collapse" as const,
  width: "100%",
  minWidth: "600px",
  backgroundColor: "white",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const headerStyle = {
  backgroundColor: "#f5f5f5",
  border: "1px solid #ccc",
  padding: "4px 8px",
  textAlign: "center" as const,
  fontWeight: "bold" as const,
  position: "sticky" as const,
  top: 0,
  zIndex: 1,
};
