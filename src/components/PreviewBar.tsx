interface Props {
  invoiceId: string;
  exportingPdf: boolean;
  printing: boolean;
  onMail: () => void;
  onPrint: () => void;
  onExportPDF: () => void;
  onBackToEditor: () => void;
}

export default function PreviewBar({ exportingPdf, printing, onMail, onPrint, onExportPDF, onBackToEditor }: Props) {
  const busy = exportingPdf || printing;

  return (
    <div data-tour="preview-bar" className="bg-blue-50 border-b border-blue-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-2 flex-wrap print:hidden">
      <span className="hidden sm:inline text-sm font-semibold text-blue-700">Invoice Preview</span>
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">

        <button
          onClick={onMail}
          disabled={busy}
          data-tour="mail-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition disabled:opacity-60"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Mail
        </button>

        <button
          onClick={onPrint}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-60"
        >
          {printing ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          )}
          {printing ? 'Preparing…' : 'Print'}
        </button>

        <button
          onClick={onExportPDF}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition disabled:opacity-60"
        >
          {exportingPdf ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          {exportingPdf ? 'Exporting…' : 'Export PDF'}
        </button>

        <button
          onClick={onBackToEditor}
          className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
        >
          ← Back to Editor
        </button>
      </div>
    </div>
  );
}
