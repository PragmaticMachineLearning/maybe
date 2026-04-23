import {
  ColumnDef,
  RowData,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useContext, useEffect, useMemo, useState } from "react";

import { CellRenderer } from "./CellRenderer";
import { SpreadsheetContext } from "../../context/SpreadsheetContext";
import styles from "./Spreadsheet.module.css";

// Extend TableMeta to include our update function
declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (
      rowIndex: number,
      columnId: string,
      value: string,
      rowData?: TData,
    ) => void;
    onCellSelect?: (row: number, col: number) => void;
    selectedCell?: { row: number; col: number } | null;
  }
}

interface SpreadsheetProps {
  rows: number;
  columns: number;
  onCellSelect?: (row: number, col: number) => void;
  selectedCell?: { row: number; col: number } | null;
}

// Define the row data type
type SpreadsheetRow = {
  rowIndex: number;
  [key: string]: unknown; // Dynamic columns for A, B, C, etc.
};

interface EditingCell {
  row: number;
  col: number;
  value: string;
}

export const Spreadsheet: React.FC<SpreadsheetProps> = ({
  rows,
  columns,
  onCellSelect,
  selectedCell,
}) => {
  const { formulaEngine, updateCell } = useContext(SpreadsheetContext);
  const [cellData, setCellData] = useState<unknown[][]>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  useEffect(() => {
    if (!formulaEngine) return;

    const updateCellData = () => {
      const updated: unknown[][] = [];
      for (let r = 0; r < rows; r++) {
        updated[r] = [];
        for (let c = 0; c < columns; c++) {
          const addr = { sheet: 0, row: r, col: c };
          updated[r][c] = formulaEngine.getCellValue(addr);
        }
      }
      setCellData(updated);
    };

    // Initial update
    updateCellData();

    // Subscribe to changes
    formulaEngine.on("valuesUpdated", updateCellData);

    return () => {
      formulaEngine.off("valuesUpdated", updateCellData);
    };
  }, [formulaEngine, rows, columns]);

  const hasData = useMemo(() => {
    return cellData.some((row) =>
      row.some((cell) => cell !== null && cell !== undefined && cell !== ""),
    );
  }, [cellData]);

  const getColumnName = (index: number): string => {
    let result = "";
    let num = index;

    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26) - 1;
    }
    return result;
  };

  // Convert 2D array data to row objects for TanStack Table
  const tableData = useMemo(() => {
    const data: SpreadsheetRow[] = [];
    for (let r = 0; r < rows; r++) {
      const row: SpreadsheetRow = { rowIndex: r };
      for (let c = 0; c < columns; c++) {
        const columnKey = getColumnName(c); // A, B, C, etc.
        row[columnKey] = cellData[r]?.[c];
      }
      data.push(row);
    }
    return data;
  }, [cellData, rows, columns]);

  // Create column definitions
  const columnDefs = useMemo((): ColumnDef<SpreadsheetRow>[] => {
    const cols: ColumnDef<SpreadsheetRow>[] = [];

    // Row number column
    cols.push({
      id: "rowNumber",
      header: "",
      cell: ({ row }) => (
        <div className={styles.headerCell}>{row.original.rowIndex + 1}</div>
      ),
      size: 20,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false, // Don't allow resizing the row number column
    });

    // Data columns (A, B, C, etc.)
    for (let c = 0; c < columns; c++) {
      const columnKey = getColumnName(c);
      cols.push({
        id: columnKey,
        header: columnKey,
        cell: ({ row, table }) => {
          const rowIndex = row.original.rowIndex;
          const colIndex = c;
          const value = row.original[columnKey];

          return (
            <CellRenderer
              row={rowIndex}
              col={colIndex}
              value={
                value as React.ComponentProps<typeof CellRenderer>["value"]
              }
              onEdit={(row, _col, value) => {
                table.options.meta?.updateData(row, columnKey, value);
              }}
              onClick={() =>
                table.options.meta?.onCellSelect?.(rowIndex, colIndex)
              }
              isSelected={
                table.options.meta?.selectedCell?.row === rowIndex &&
                table.options.meta?.selectedCell?.col === colIndex
              }
              isEditing={
                editingCell?.row === rowIndex && editingCell?.col === colIndex
              }
              editValue={
                editingCell?.row === rowIndex && editingCell?.col === colIndex
                  ? editingCell.value
                  : ""
              }
              onRequestEdit={(row, col, value) =>
                setEditingCell({ row, col, value })
              }
              onStopEdit={() => setEditingCell(null)}
            />
          );
        },
        size: 60,
        minSize: 40,
        maxSize: 400,
        enableSorting: true,
        enableColumnFilter: true,
        enableResizing: true, // Enable resizing for data columns
      });
    }

    return cols;
  }, [columns, editingCell]);

  const handleCellValueChange = (
    rowIndex: number,
    columnId: string,
    value: string,
  ) => {
    const colIndex = columnId.charCodeAt(0) - 65;
    updateCell(rowIndex, colIndex, value);
  };

  const table = useReactTable({
    data: tableData,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    enableSorting: false,
    enableFilters: false,
    enableColumnFilters: false,
    enableGlobalFilter: false,
    enableColumnResizing: true, // Enable column resizing
    columnResizeMode: "onChange", // Update column size while dragging
    // Provide our update function to table meta
    meta: {
      updateData: handleCellValueChange,
      onCellSelect,
      selectedCell,
    },
  });

  return (
    <div className={styles.tableContainer}>
      {!hasData && (
        <div className={styles.welcomeOverlay}>
          <div className={styles.welcomeContent}>
            <svg
              className={styles.welcomeIcon}
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect
                x="6"
                y="6"
                width="36"
                height="36"
                rx="4"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <line
                x1="6"
                y1="16"
                x2="42"
                y2="16"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <line
                x1="18"
                y1="6"
                x2="18"
                y2="42"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle
                cx="30"
                cy="28"
                r="6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <path
                d="M28 28 L30 24 L32 28"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className={styles.welcomeTitle}>Start building your model</p>
            <p className={styles.welcomeSubtitle}>
              Type values, formulas, or uncertainty like{" "}
              <code>N.CI(10, 20)</code> to add uncertainty
            </p>
          </div>
        </div>
      )}
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header, headerIndex) => (
                <th
                  key={header.id}
                  className={`${styles.header} ${headerIndex === 0 ? styles.stickyHeader : ""}`}
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                  {/* Resize handle */}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`${styles.resizeHandle} resizer ${header.column.getIsResizing() ? "isResizing" : ""}`}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className={styles.tableBody}>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell, cellIndex) => (
                <td
                  key={cell.id}
                  className={`${styles.cell} ${cellIndex === 0 ? styles.stickyCell : ""}`}
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
