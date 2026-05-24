/**
 * Open an attachment Blob in a new tab.
 *
 * For browser-renderable types (PDF, image, video, audio, text) we navigate
 * the new tab straight to the blob: URL — it displays inline.
 *
 * For everything else (DOCX, XLSX, PPTX, ZIP, …) browsers refuse to render
 * inline and will download the file. A naked `blob:` URL has no filename,
 * so the OS saves it as the random blob ID (e.g. `3477369c-…`). We fix that
 * by triggering the download through a hidden `<a download="real-name.docx">`
 * so the file is saved with its original name.
 */

const NATIVE_RENDERABLE_PREFIXES = ['image/', 'video/', 'audio/', 'text/'];
const NATIVE_RENDERABLE_EXACT = new Set([
  'application/pdf',
  'application/json',
  'application/xml',
  'application/javascript',
]);

function isNativelyRenderable(mime: string): boolean {
  if (NATIVE_RENDERABLE_EXACT.has(mime)) return true;
  return NATIVE_RENDERABLE_PREFIXES.some((p) => mime.startsWith(p));
}

export function openAttachmentInNewTab(blob: Blob, fileName = 'file'): boolean {
  const mime = blob.type || 'application/octet-stream';
  const url = URL.createObjectURL(blob);

  if (isNativelyRenderable(mime)) {
    // Inline preview — let the browser render it in a new tab.
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    return !!opened;
  }

  // Browser can't render this type → force a download with the real filename.
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
