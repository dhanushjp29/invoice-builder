import { useRef } from 'react';
import type { Attachment } from '../types/invoice';
import { createAttachment } from '../db/invoiceDB';
import { deleteAttachment, getAttachmentBlob, putAttachment } from '../db/attachmentStore';
import { openAttachmentInNewTab } from '../utils/attachmentView';

interface Props {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const type = mimeType.split('/')[0];
  const sub = mimeType.split('/')[1] ?? '';

  if (type === 'image') {
    return (
      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type === 'video') {
    return (
      <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type === 'audio') {
    return (
      <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    );
  }
  if (sub === 'pdf') {
    return (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (sub.includes('spreadsheet') || sub.includes('excel') || sub === 'csv') {
    return (
      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h18M3 14h18M10 3v18M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
      </svg>
    );
  }
  if (sub.includes('word') || sub === 'msword' || sub.includes('document')) {
    return (
      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  // Default
  return (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function mimeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-powerpoint': 'PPT',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'application/zip': 'ZIP',
    'application/x-rar-compressed': 'RAR',
    'application/json': 'JSON',
  };
  if (map[mimeType]) return map[mimeType];
  const [type, sub] = mimeType.split('/');
  if (type === 'image') return sub.toUpperCase();
  if (type === 'video') return sub.toUpperCase();
  if (type === 'audio') return sub.toUpperCase();
  return sub?.toUpperCase() ?? type.toUpperCase();
}

/** Resolve an Attachment to its actual Blob, regardless of storage layout.
 *  - New attachments: read from IndexedDB by `blobId`.
 *  - Legacy attachments (pre-migration): decode the inline base64 `data` URL. */
async function resolveBlob(att: Attachment): Promise<Blob | null> {
  if (att.blobId) return getAttachmentBlob(att.blobId);
  if (att.data) return dataUrlToBlob(att.data, att.mimeType);
  return null;
}

function dataUrlToBlob(dataUrl: string, fallbackMime: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]*)(;base64)?,(.*)$/);
  if (!match) return null;
  const mime = match[1] || fallbackMime;
  const isBase64 = !!match[2];
  const payload = match[3];
  let bytes: Uint8Array;
  if (isBase64) {
    const bin = atob(payload);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    const dec = decodeURIComponent(payload);
    bytes = new Uint8Array(dec.length);
    for (let i = 0; i < dec.length; i++) bytes[i] = dec.charCodeAt(i);
  }
  // Copy into a fresh ArrayBuffer to satisfy strict BlobPart typing.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: mime });
}

export default function FileAttachments({ attachments, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    // Persist each File to IndexedDB first, then build the metadata record
    // that goes into the invoice JSON. The Blob bytes never touch React state.
    const added = await Promise.all(
      Array.from(files).map(async (file) => {
        const blobId = await putAttachment(file);
        return createAttachment(file, blobId);
      }),
    );
    onChange([...attachments, ...added]);
  }

  async function handleView(att: Attachment) {
    const blob = await resolveBlob(att);
    if (!blob) return;
    openAttachmentInNewTab(blob, att.name);
  }

  async function handleDownload(att: Attachment) {
    const blob = await resolveBlob(att);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function handleRemove(id: string) {
    const target = attachments.find((a) => a._id === id);
    if (target?.blobId) deleteAttachment(target.blobId).catch(() => { /* best effort */ });
    onChange(attachments.filter((a) => a._id !== id));
  }

  function handleToggleIncludeInMail(id: string, checked: boolean) {
    onChange(attachments.map((a) => a._id === id ? { ...a, includeInMail: checked } : a));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    void handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-5 overflow-hidden ring-1 ring-slate-100">
      <div className="px-6 py-4 border-b border-blue-100 bg-blue-50 flex items-center gap-2">
        <div className="w-1 h-5 bg-blue-500 rounded-full" />
        <h2 className="text-sm font-bold text-blue-700 uppercase tracking-widest">File Attachments</h2>
        <span className="ml-auto text-xs text-blue-400 font-medium">Not shown in invoice preview</span>
      </div>

      {/* Drop zone */}
      <div className="px-6 pt-5 pb-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-blue-200 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition group"
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-blue-700">Click to attach files or drag & drop</p>
          <p className="text-xs text-slate-400">Supports all file types — PDF, images, documents, spreadsheets, and more</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
            onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
          />
        </div>
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="px-6 pb-5 flex flex-col gap-2">
          {attachments.map((att) => (
            <div
              key={att._id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50/30 transition group"
            >
              <FileTypeIcon mimeType={att.mimeType} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{att.name}</p>
                <p className="text-xs text-slate-400">{mimeLabel(att.mimeType)} · {formatBytes(att.size)}</p>
              </div>

              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer select-none hover:bg-blue-100/60 transition" title="Attach this file to the email">
                <input
                  type="checkbox"
                  checked={!!att.includeInMail}
                  onChange={(e) => handleToggleIncludeInMail(att._id, e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-400 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-600">Include In Mail</span>
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleView(att)}
                  title="View file"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(att)}
                  title="Download file"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(att._id)}
                  title="Remove attachment"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
