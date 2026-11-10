export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtUsd = (n: number, digits = 2) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmtPct = (r: number, digits = 1) => `${(r * 100).toFixed(digits)}%`;
export const fmtSigned = (n: number, unit = "", digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}${unit}`;
export const fmtAgo = (min: number) =>
  min < 1 ? "just now" : min < 60 ? `${min}m ago` : min < 1440 ? `${Math.round(min / 60)}h ago` : `${Math.round(min / 1440)}d ago`;
