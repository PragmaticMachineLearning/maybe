import type { ExampleCell, ExampleDefinition } from '../examples/examples'
import React, { useContext, useEffect, useRef, useState } from 'react'

import { SpreadsheetContext } from '../SpreadsheetContext'
import { ThemeToggle } from './ThemeToggle'
import { spreadsheetExamples } from '../examples/examples'

interface ToolbarProps {
  useFlowDiag: boolean
  onToggleFlowDiag: () => void
  analysisMode: boolean
  onToggleAnalysisMode: () => void
}

export const Toolbar: React.FC<ToolbarProps> = ({ useFlowDiag, onToggleFlowDiag, analysisMode, onToggleAnalysisMode }) => {
  const { hfInstance } = useContext(SpreadsheetContext)
  const [showExamplesDropdown, setShowExamplesDropdown] = useState(false)
  const examplesDropdownRef = useRef<HTMLDivElement>(null)
  const examplesButtonRef = useRef<HTMLButtonElement>(null)

  const handleOpenDocs = () => {
    if (typeof window !== 'undefined') {
      window.open('/docs/index.html', '_blank', 'noopener')
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showExamplesDropdown) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        examplesDropdownRef.current &&
        !examplesDropdownRef.current.contains(target) &&
        examplesButtonRef.current &&
        !examplesButtonRef.current.contains(target)
      ) {
        setShowExamplesDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExamplesDropdown])

  const handleExampleSelect = (example: ExampleDefinition) => {
    if (!hfInstance) {
      return
    }

    const { width, height } = hfInstance.getSheetDimensions(0)
    const requiredWidth = example.data.reduce((max, row) => Math.max(max, row.length), 0)
    const targetWidth = Math.max(width, requiredWidth)
    const targetHeight = Math.max(height, example.data.length)

    const nextSheet: ExampleCell[][] = Array.from({ length: targetHeight }, () =>
      Array.from<ExampleCell>({ length: targetWidth }, () => null)
    )

    example.data.forEach((rowData, rowIndex) => {
      if (rowIndex >= targetHeight) {
        return
      }
      rowData.forEach((cellContent, colIndex) => {
        if (colIndex >= targetWidth) {
          return
        }
        nextSheet[rowIndex][colIndex] = cellContent ?? null
      })
    })

    hfInstance.setSheetContent(0, nextSheet)
    setShowExamplesDropdown(false)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '4px',
      padding: '8px 0',
      flexWrap: 'wrap',
      rowGap: '8px',
    }}>
      <button
        onClick={onToggleFlowDiag}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: useFlowDiag ? 'var(--resize-handle-active)' : 'var(--bg-surface)',
          color: useFlowDiag ? 'white' : 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          fontFamily: 'inherit',
          boxShadow: '0 1px 3px var(--shadow)',
          transition: 'all 0.2s ease',
          outline: 'none',
          width: '40px',
          height: '40px',
        }}
        onMouseEnter={(e) => {
          if (!useFlowDiag) {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
            e.currentTarget.style.borderColor = 'var(--border-header)'
          }
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 2px 6px var(--shadow-hover)'
        }}
        onMouseLeave={(e) => {
          if (!useFlowDiag) {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
            e.currentTarget.style.borderColor = 'var(--border-color)'
          }
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 1px 3px var(--shadow)'
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--resize-handle-active)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        title={useFlowDiag ? 'Switch to spreadsheet view' : 'Switch to flow diagram view'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {useFlowDiag ? (
            // Spreadsheet icon
            <>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
              <line x1="15" y1="3" x2="15" y2="21"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/>
            </>
          ) : (
            // Flow diagram icon - 3 nodes connected by 2 edges
            <>
              <circle cx="6" cy="12" r="2"/>
              <circle cx="12" cy="8" r="2"/>
              <circle cx="18" cy="12" r="2"/>
              <line x1="8" y1="12" x2="10" y2="8"/>
              <line x1="14" y1="8" x2="16" y2="12"/>
            </>
          )}
        </svg>
      </button>

      {/* Analysis Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleAnalysisMode()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: analysisMode ? 'var(--resize-handle-active)' : 'var(--bg-surface)',
          color: analysisMode ? 'white' : 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500,
          fontFamily: 'inherit',
          boxShadow: '0 1px 3px var(--shadow)',
          transition: 'all 0.2s ease',
          outline: 'none',
          height: '40px',
          gap: '8px',
        }}
        onMouseEnter={(e) => {
          if (!analysisMode) {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
            e.currentTarget.style.borderColor = 'var(--border-header)'
          }
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 2px 6px var(--shadow-hover)'
        }}
        onMouseLeave={(e) => {
          if (!analysisMode) {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
            e.currentTarget.style.borderColor = 'var(--border-color)'
          }
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 1px 3px var(--shadow)'
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--resize-handle-active)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        title={analysisMode ? 'Hide analysis panel' : 'Show analysis panel'}
      >
        <span>Analysis</span>
      </button>

      {/* Examples Button */}
      <div style={{ position: 'relative' }}>
        <button
          ref={examplesButtonRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowExamplesDropdown(!showExamplesDropdown)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            fontFamily: 'inherit',
            boxShadow: '0 1px 3px var(--shadow)',
            transition: 'all 0.2s ease',
            outline: 'none',
            height: '40px',
            paddingLeft: '12px',
            paddingRight: '12px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
            e.currentTarget.style.borderColor = 'var(--border-header)'
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 2px 6px var(--shadow-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
            e.currentTarget.style.borderColor = 'var(--border-color)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 1px 3px var(--shadow)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--resize-handle-active)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
          title="Load an example spreadsheet"
        >
          Examples
        </button>
        {showExamplesDropdown && (
          <div
            ref={examplesDropdownRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 1200,
              minWidth: '240px',
              padding: '6px 0',
            }}
          >
            <div
              style={{
                padding: '6px 12px',
                fontWeight: 'bold',
                fontSize: '11px',
                color: 'var(--text-secondary)',
              }}
            >
              Load an example
            </div>
            {spreadsheetExamples.map((example) => (
              <button
                key={example.id}
                onClick={(e) => {
                  e.stopPropagation()
                  handleExampleSelect(example)
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ fontWeight: 500 }}>{example.name}</div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginTop: '2px',
                  }}
                >
                  {example.description}
                </div>
              </button>
            ))}
            <div
              style={{
                padding: '8px 12px 4px',
                fontSize: '11px',
                color: 'var(--text-secondary)',
              }}
            >
              Selecting an example replaces the current sheet contents.
            </div>
          </div>
        )}
      </div>

      {/* Docs Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleOpenDocs()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500,
          fontFamily: 'inherit',
          boxShadow: '0 1px 3px var(--shadow)',
          transition: 'all 0.2s ease',
          outline: 'none',
          height: '40px',
          gap: '8px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
          e.currentTarget.style.borderColor = 'var(--border-header)'
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 2px 6px var(--shadow-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
          e.currentTarget.style.borderColor = 'var(--border-color)'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 1px 3px var(--shadow)'
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--resize-handle-active)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        title="Open Alea documentation in a new tab"
      >
        Docs
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 4H14L18 8V20H6Z" />
          <line x1="10" y1="12" x2="14" y2="12" />
          <line x1="10" y1="16" x2="14" y2="16" />
          <line x1="10" y1="8" x2="11" y2="8" />
        </svg>
      </button>

      {/* Theme Toggle */}
      <div style={{ 
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center'
      }}>
        <ThemeToggle showLabel={false} />
      </div>
    </div>
  )
} 
