/**
 * IndexedDB-backed Blob store for invoice attachments.
 *
 * Why IndexedDB and not localStorage: localStorage stores strings only, so we
 * had to base64-encode every file. That bloats size by ~33% and breaks past a
 * few MB. IndexedDB stores raw Blobs natively, no encoding, no size penalty,
 * and has gigabytes of headroom per origin.
 *
 * Public API:
 *   - putAttachment(file) → blobId
 *   - getAttachmentBlob(blobId) → Blob | null
 *   - deleteAttachment(blobId)
 *   - getAttachmentObjectUrl(blobId) → blob:// URL (revoke when done)
 */

import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'invoiceBuilderAttachments';
const DB_VERSION = 1;
const STORE = 'files';

interface StoredAttachment {
  id: string;
  blob: Blob;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | IDBRequest): Promise<T> {
  return openDB().then((db) =>
    new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    }),
  );
}

/** Store a File/Blob and return the generated id (acts as the "path" in the DB). */
export async function putAttachment(blob: Blob): Promise<string> {
  const id = uuidv4();
  const record: StoredAttachment = { id, blob, createdAt: new Date().toISOString() };
  await tx('readwrite', (s) => s.put(record));
  return id;
}

/** Store a Blob with a caller-supplied id (used by the legacy-data migration). */
export async function putAttachmentWithId(id: string, blob: Blob): Promise<void> {
  const record: StoredAttachment = { id, blob, createdAt: new Date().toISOString() };
  await tx('readwrite', (s) => s.put(record));
}

export async function getAttachmentBlob(id: string): Promise<Blob | null> {
  const rec = await tx<StoredAttachment | undefined>('readonly', (s) => s.get(id));
  return rec?.blob ?? null;
}

export async function deleteAttachment(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

/** Returns a blob: URL for the stored file. Caller must `URL.revokeObjectURL` it. */
export async function getAttachmentObjectUrl(id: string): Promise<string | null> {
  const blob = await getAttachmentBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/** Read a Blob as base64 (no data: prefix). Used by the mail-send path. */
export async function getAttachmentBase64(id: string): Promise<string | null> {
  const blob = await getAttachmentBlob(id);
  if (!blob) return null;
  return blobToBase64(blob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
