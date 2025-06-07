import React from 'react'

interface ToolbarProps {
  useFlowDiag: boolean
  onToggleFlowDiag: () => void
}

export const Toolbar: React.FC<ToolbarProps> = ({ useFlowDiag, onToggleFlowDiag }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '4px',
      padding: '8px 0',
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
    </div>
  )
} 