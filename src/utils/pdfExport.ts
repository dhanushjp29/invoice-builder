const PDF_OPTIONS = {
  margin: [8, 10, 8, 10],
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
  jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
  pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'thead'] },
};

function getElement(): HTMLElement {
  const el = document.getElementById('invoice-print-area');
  if (!el) throw new Error('Invoice print area not found in DOM.');
  return el;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadHtml2Pdf(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('html2pdf.js') as any;
  return mod.default ?? mod;
}

/** Download PDF — triggers browser Save dialog. */
export async function downloadPdf(filename: string): Promise<void> {
  const html2pdf = await loadHtml2Pdf();
  await html2pdf()
    .set({ ...PDF_OPTIONS, filename })
    .from(getElement())
    .save();
}

/**
 * Generate a real PDF Blob. The chain must call .toPdf() before .output() —
 * .output('blob') on its own returns the canvas data, not a PDF.
 */
export async function generatePdfBlob(filename: string): Promise<Blob> {
  const html2pdf = await loadHtml2Pdf();
  const blob: Blob = await html2pdf()
    .set({ ...PDF_OPTIONS, filename })
    .from(getElement())
    .toPdf()
    .output('blob');
  return blob;
}

/**
 * Open the invoice as a clean PDF in a new tab.
 * Browser's native PDF viewer shows it — no URL, no app chrome.
 * User presses Ctrl+P in that tab for a clean print.
 * Falls back to download if popups are blocked.
 */
export async function printAsPdf(filename: string): Promise<void> {
  const blob = await generatePdfBlob(filename);
  const url = URL.createObjectURL(blob);

  const tab = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 120_000);

  if (!tab) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
}
