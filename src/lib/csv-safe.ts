/*
 * CSV / spreadsheet formula injection guard.
 *
 * Reference: ~/vault/references/csv-formula-injection-mitigation-2025.md
 *
 * Why tab prefix instead of single quote:
 * - OWASP cheat sheet historically recommended prepending a single quote (`'`).
 * - Excel strips that leading apostrophe after save/reopen and the formula
 *   re-activates (PapaParse issue #1108, OWASP CSV Injection page note,
 *   USENIX WOOT 2025). The single quote works in Sheets / LibreOffice /
 *   Numbers but is unreliable in Excel for persistent files.
 * - Tab character (0x09) is preserved across save/reopen in every major
 *   spreadsheet app and stops formula evaluation.
 *
 * Trigger characters per OWASP + CVE-2025-21394 (Excel DDE) coverage:
 *   = + - @ TAB CR NUL, plus their full-width Unicode equivalents.
 *
 * For XLSX: tab prefix alone is fragile because some viewers normalize cell
 * content. Force the cell type to text (ExcelJS `{ value, type: 's' }` or
 * worksheet.getCell(...).numFmt = '@') in addition to running the value
 * through this sanitizer.
 */

const TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r", "\0"])

// Full-width Unicode lookalikes commonly used in injection bypasses.
const FULLWIDTH_MAP: Record<string, string> = {
  "＝": "=",
  "＋": "+",
  "－": "-",
  "＠": "@",
}

function normalizeFullwidth(value: string): string {
  if (value.length === 0) return value
  const first = value[0]
  const mapped = FULLWIDTH_MAP[first]
  return mapped ? mapped + value.slice(1) : value
}

export function sanitizeForSpreadsheet(value: string): string {
  if (!value || value.length === 0) return value
  const normalized = normalizeFullwidth(value)
  const first = normalized[0]
  if (TRIGGER_CHARS.has(first)) {
    return "\t" + normalized
  }
  // If no trigger after normalization, still return the normalized form
  // when a full-width replacement happened, so the output is consistent.
  return normalized === value ? value : normalized
}

export function sanitizeCommentRowForSpreadsheet<
  T extends Record<string, unknown>,
>(row: T, stringFields: ReadonlyArray<keyof T>): T {
  const out = { ...row }
  for (const field of stringFields) {
    const v = out[field]
    if (typeof v === "string") {
      out[field] = sanitizeForSpreadsheet(v) as T[keyof T]
    }
  }
  return out
}
