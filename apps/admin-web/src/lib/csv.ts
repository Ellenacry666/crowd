const FORMULA_START = /^[=+\-@\t\r]/;

/** Sel CSV aman: kutip bila perlu, dan awalan ' pada teks yang diawali karakter rumus (CSV injection di Excel). */
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (typeof v === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: (string | number | null)[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const blob = new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }); // BOM agar Excel membaca UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
