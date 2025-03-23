// This module is a wrapper around the hyperformula module
// It helps with TypeScript type compatibility for direct source imports

// Import any needed types for TypeScript
// (This is only for static type checking and will not be included in the runtime)
import type {
  CellValueDetailedType,
  CellValueType,
  ErrorType
} from 'hyperformula';

// Directly import from the original package
import HyperFormula from 'hyperformula';

// Re-export everything
export default HyperFormula;

// Also explicitly re-export types for TypeScript
export type {
  CellValueType,
  CellValueDetailedType,
  ErrorType
}; 