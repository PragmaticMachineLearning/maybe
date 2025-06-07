import {
  ColumnDef,
  RowData,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import React, { useContext, useEffect, useMemo, useState } from 'react'

import { CellRenderer } from './CellRenderer'
import { SpreadsheetContext } from '../SpreadsheetContext'

// Extend TableMeta to include our update function
declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: string) => void
    onCellSelect?: (row: number, col: number) => void
    selectedCell?: { row: number; col: number } | null
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
  [key: string]: any; // Dynamic columns for A, B, C, etc.
}

export const Spreadsheet: React.FC<SpreadsheetProps> = ({
  rows,
  columns,
  onCellSelect,
  selectedCell,
}) => {
  const { hfInstance } = useContext(SpreadsheetContext);
  const [cellData, setCellData] = useState<Array<Array<any>>>([]);

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

    return () => {
      hfInstance.off('valuesUpdated', updateCellData)
    }
  }, [hfInstance, rows, columns])
  
  const getColumnName = (index: number): string => {
    let result = '';
    let num = index;

    while (num >= 0){
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26) - 1;
    }
    return result;
  }

  // Convert 2D array data to row objects for TanStack Table
  const tableData = useMemo(() => {
    const data: SpreadsheetRow[] = []
    for (let r = 0; r < rows; r++) {
      const row: SpreadsheetRow = { rowIndex: r }
      for (let c = 0; c < columns; c++) {
        const columnKey = getColumnName(c) // A, B, C, etc.
        row[columnKey] = cellData[r]?.[c]
      }
      data.push(row)
    }
    return data
  }, [cellData, rows, columns])

  // Create column definitions
  const columnDefs = useMemo((): ColumnDef<SpreadsheetRow>[] => {
    const cols: ColumnDef<SpreadsheetRow>[] = []
    
    // Row number column
    cols.push({
      id: 'rowNumber',
      header: '',
      cell: ({ row }) => (
        <div style={headerCellStyle}>
          {row.original.rowIndex + 1}
        </div>
      ),
      size: 20,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false, // Don't allow resizing the row number column
    })

    // Data columns (A, B, C, etc.)
    for (let c = 0; c < columns; c++) {
      const columnKey = getColumnName(c)
      cols.push({
        id: columnKey,
        header: columnKey,
        cell: ({ row, table }) => {
          const rowIndex = row.original.rowIndex
          const colIndex = c
          const value = row.original[columnKey]
          
          return (
            <CellRenderer
              row={rowIndex}
              col={colIndex}
              value={value}
              onEdit={(row, _col, value) => {
                table.options.meta?.updateData(row, columnKey, value)
              }}
              onClick={() => table.options.meta?.onCellSelect?.(rowIndex, colIndex)}
              isSelected={table.options.meta?.selectedCell?.row === rowIndex && table.options.meta?.selectedCell?.col === colIndex}
            />
          )
        },
        size: 60,
        minSize: 40,
        maxSize: 400,
        enableSorting: true,
        enableColumnFilter: true,
        enableResizing: true, // Enable resizing for data columns
      })
    }

    return cols
  }, [columns])

  const handleCellValueChange = (rowIndex: number, columnId: string, value: string) => {
    const colIndex = columnId.charCodeAt(0) - 65
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
    columnResizeMode: 'onChange', // Update column size while dragging
    // Provide our update function to table meta
    meta: {
      updateData: handleCellValueChange,
      onCellSelect,
      selectedCell,
    },
  })

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  style={{
                    ...headerStyle,
                    width: header.getSize(),
                    position: 'relative',
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  {/* Resize handle */}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      style={resizeHandleStyle}
                      className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  style={{
                    width: cell.column.getSize(),
                    padding: 0,
                    border: '1px solid var(--border-color)',

                    borderColor: 'collapse',
                    position: 'relative',
                  }}
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

const tableStyle = {
  borderCollapse: 'collapse' as const,
  width: '100%',
  minWidth: '600px',
  backgroundColor: 'var(--bg-surface)',
  boxShadow: '0 1px 3px var(--shadow)',
  tableLayout: 'fixed' as const, // Important for column resizing
  border: '1px solid var(--border-color)',
}

const headerStyle = {
  backgroundColor: 'var(--bg-header)',
  border: '1px solid var(--border-header)',
  borderRight:'1px solid var(--border-color)',
  borderBottom:'1px solid var(--border-color)',
  padding: '4px 8px',
  textAlign: 'center' as const,
  fontWeight: 'normal' as const,
  fontSize: '12px',
  position: 'sticky' as const,
  top: 0,
  zIndex: 1,
  color: 'var(--text-secondary)', // Use CSS variable for theme support
}

const headerCellStyle = {
  backgroundColor: 'var(--bg-header)',
  border: '1px solid var(--border-color)',
  borderRight:'1px solid var(--border-color)',
  borderBottom:'1px solid var(--border-color)',
  padding: '2px 4px',
  textAlign: 'center' as const,
  fontWeight: 'normal' as const,
  fontSize: '12px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-secondary)', // Use CSS variable for theme support
}

const resizeHandleStyle = {
  position: 'absolute' as const,
  right: 0,
  top: 0,
  height: '100%',
  width: '6px',
  backgroundColor: 'transparent',
  cursor: 'col-resize',
  userSelect: 'none' as const,
  touchAction: 'none',
  borderRight: '2px solid transparent',
  transition: 'border-color 0.2s ease',
  zIndex: 2,
}