export interface SheetDimensions {
  width: number;
  height: number;
}

export interface ZeroBasedCellAddress {
  row: number;
  col: number;
}

const toColumnLetters = (col: number): string => {
  let columnName = "";
  let columnNumber = col + 1;

  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }

  return columnName;
};

export const cellAddressToA1 = (row: number, col: number): string => {
  return `${toColumnLetters(col)}${row + 1}`;
};

export const cellAddressFromA1 = (
  address: string,
  dimensions: SheetDimensions,
): ZeroBasedCellAddress | null => {
  const normalized = address.trim().toUpperCase();
  const match = normalized.match(/^([A-Z]+)([1-9]\d*)$/);

  if (!match) {
    return null;
  }

  const [, columnLetters, rowText] = match;
  let col = 0;

  for (const letter of columnLetters) {
    col = col * 26 + (letter.charCodeAt(0) - 64);
  }

  const row = Number(rowText) - 1;
  const zeroBasedCol = col - 1;

  if (
    row < 0 ||
    zeroBasedCol < 0 ||
    row >= dimensions.height ||
    zeroBasedCol >= dimensions.width
  ) {
    return null;
  }

  return { row, col: zeroBasedCol };
};
