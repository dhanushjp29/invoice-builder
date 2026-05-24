/**
 * One-shot migration: move legacy inline-base64 attachments from the invoice
 * JSON (localStorage) into IndexedDB blobs.
 *
 * Why: the storage layout changed from `attachment.data = "data:...;base64,…"`
 * to `attachment.blobId = "<idb-id>"`. Existing invoices on a user's device
 * still carry the inline payload; we rewrite them on first run after the
 * upgrade so View / Download / Mail keep working.
 *
 * Safe to run on every app start — guarded by a localStorage flag and a
 * per-attachment check.
 */

import { findAll, updateOne } from './invoiceDB';
import { putAttachmentWithId } from './attachmentStore';
import { v4 as uuidv4 } from 'uuid';

const FLAG_KEY = 'attachmentStore_migrationV1';

export async function migrateLegacyAttachments(): Promise<void> {
  if (localStorage.getItem(FLAG_KEY) === 'done') return;

  try {
    const invoices = findAll();
    for (const inv of invoices) {
      const atts = inv.attachments ?? [];
      let changed = false;
      const next = await Promise.all(
        atts.map(async (att) => {
          if (att.blobId || !att.data) return att;
          const blob = decodeDataUrl(att.data, att.mimeType);
          if (!blob) return att;
          const blobId = uuidv4();
          await putAttachmentWithId(blobId, blob);
          changed = true;
          // Strip the heavy `data` field — it's now redundant and was the
          // whole reason localStorage was bloating up.
          const { data: _data, ...rest } = att;
          return { ...rest, blobId };
        }),
      );
      if (changed) {
        updateOne(inv._id, { attachments: next });
      }
    }
    localStorage.setItem(FLAG_KEY, 'done');
  } catch (err) {
    console.error('[migrate] attachment migration failed:', err);
    // Don't set the flag — we'll retry next start.
  }
}

function decodeDataUrl(dataUrl: string, fallbackMime: string): Blob | null {
  const m = dataUrl.match(/^data:([^;,]*)(;base64)?,(.*)$/);
  if (!m) return null;
  const mime = m[1] || fallbackMime || 'application/octet-stream';
  const isBase64 = !!m[2];
  const payload = m[3];
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
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: mime });
}
