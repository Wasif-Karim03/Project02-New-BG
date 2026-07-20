"use client";

// Small client button to trigger the browser's print/Save-as-PDF dialog. Marked
// no-print so it doesn't appear in the printed output itself.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      Print / Save as PDF
    </button>
  );
}
