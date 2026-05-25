import { v4 as uuidv4 } from 'uuid';
import type { InvoiceDocument, LineItem, AdditionalCharge, LocationData, Attachment } from '../types/invoice';

/** Build an Attachment metadata record. The actual file bytes live in
 *  IndexedDB under `blobId`; this record only carries the pointer + metadata
 *  that needs to survive inside the invoice JSON. */
export function createAttachment(file: File, blobId: string): Attachment {
  return {
    _id: uuidv4(),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    blobId,
    includeInMail: false,
  };
}

const COLLECTION_KEY = 'invoiceDB_invoices';
const PREFIX_KEY = 'invoiceDB_prefix';

/** Returns the financial-year start year for a given date.
 *  India FY runs Apr 1 → Mar 31.
 *  Jan–Mar 2026  →  FY 2025  (prefix year = 2025)
 *  Apr–Dec 2026  →  FY 2026  (prefix year = 2026)
 */
function fyStartYear(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

export function getInvoicePrefix(): string {
  return localStorage.getItem(PREFIX_KEY) ?? 'INV';
}

export function setInvoicePrefix(prefix: string): void {
  localStorage.setItem(PREFIX_KEY, prefix.trim() || 'INV');
}

/** Generate the next invoice number.
 *  Format: {prefix}{FY_YEAR}-{NNNN}  e.g. INV2026-0001
 *  Finds the highest existing sequence number for the current FY prefix across
 *  ALL persisted invoices (draft, saved, mail-sent, modified) and increments.
 *
 *  We scan EVERY invoice — including drafts — so a new invoice's number can
 *  never collide with a draft that's already holding that slot. Otherwise a
 *  user could create draft 0005, then create another invoice which would also
 *  get 0005, producing two visible rows with the same number.
 */
export function generateInvoiceNumber(): string {
  const prefix = getInvoicePrefix();
  const fyYear = fyStartYear(new Date());
  const stem = `${prefix}${fyYear}-`;          // e.g. "INV2026-"

  let max = 0;
  for (const doc of getCollection()) {
    if (doc.invoiceNumber.startsWith(stem)) {
      const seq = parseInt(doc.invoiceNumber.slice(stem.length), 10);
      if (!isNaN(seq) && seq > max) max = seq;
    }
  }
  return `${stem}${String(max + 1).padStart(4, '0')}`;
}

/** True if `number` is already used by ANY other invoice (including drafts).
 *  `excludeId` skips the document being saved/updated itself. Two invoices —
 *  draft or not — can never share a number. */
export function invoiceNumberExists(number: string, excludeId?: string): boolean {
  if (!number.trim()) return false;
  const target = number.trim();
  return getCollection().some(
    (d) => d._id !== excludeId && d.invoiceNumber.trim() === target,
  );
}

/** Return the invoice with its draft number reconciled. Keeps the stored
 *  number on disk so the list view and the editor always agree. Only mints a
 *  fresh number when (a) the invoice has no number, or (b) its number is
 *  taken by another invoice — neither of which should normally happen now
 *  that dedupeInvoiceNumbers runs on app boot. */
export function reconcileDraftNumber(doc: InvoiceDocument): InvoiceDocument {
  if (doc.status !== 'draft') return doc;
  if (doc.invoiceNumber.trim() && !invoiceNumberExists(doc.invoiceNumber, doc._id)) {
    return doc; // stored number is fine — leave it alone
  }
  const fresh = generateInvoiceNumber();
  // Persist so subsequent reads see the same value (list + editor agree).
  const collection = getCollection();
  const idx = collection.findIndex((d) => d._id === doc._id);
  if (idx !== -1) {
    collection[idx] = { ...collection[idx], invoiceNumber: fresh, updatedAt: new Date().toISOString() };
    saveCollection(collection);
  }
  return { ...doc, invoiceNumber: fresh };
}

/** One-shot cleanup: scan the entire collection for duplicate invoice numbers
 *  (drafts included) and renumber the later ones. The oldest instance keeps
 *  the original number — drafts are renumbered before non-drafts when both
 *  share a number, since a draft's number is provisional anyway.
 *  Idempotent — safe to call on every app boot. Returns the renumber count. */
export function dedupeInvoiceNumbers(): number {
  const collection = getCollection();
  // Sort: non-drafts first (preserve their number), then by createdAt ascending
  // so that within each group the oldest keeps the number.
  const ordered = [...collection].sort((a, b) => {
    const aDraft = (a.status ?? 'saved') === 'draft' ? 1 : 0;
    const bDraft = (b.status ?? 'saved') === 'draft' ? 1 : 0;
    if (aDraft !== bDraft) return aDraft - bDraft;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
  const seen = new Set<string>();
  let renumbered = 0;
  let dirty = false;
  for (const doc of ordered) {
    const key = doc.invoiceNumber.trim();
    if (!key) continue;
    if (seen.has(key)) {
      const idx = collection.findIndex((d) => d._id === doc._id);
      if (idx !== -1) {
        // Persist in-progress state so generateInvoiceNumber returns a fresh
        // slot that doesn't collide with anything we've already kept.
        saveCollection(collection);
        const fresh = generateInvoiceNumber();
        collection[idx] = { ...collection[idx], invoiceNumber: fresh, updatedAt: new Date().toISOString() };
        seen.add(fresh);
        renumbered++;
        dirty = true;
      }
    } else {
      seen.add(key);
    }
  }
  if (dirty) saveCollection(collection);
  return renumbered;
}

function getCollection(): InvoiceDocument[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCollection(docs: InvoiceDocument[]): void {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(docs));
}

export function insertOne(doc: Omit<InvoiceDocument, '_id' | 'createdAt' | 'updatedAt'>): InvoiceDocument {
  const now = new Date().toISOString();
  const status = doc.status ?? 'saved';
  // Final guard: a non-draft invoice must never collide with another. If the
  // caller forgot to validate (or two tabs race) we bump the number forward
  // until it's unique. Drafts are exempt — they can share a provisional number.
  let invoiceNumber = doc.invoiceNumber;
  if (status !== 'draft' && invoiceNumberExists(invoiceNumber)) {
    invoiceNumber = generateInvoiceNumber();
  }
  const newDoc: InvoiceDocument = {
    ...doc,
    invoiceNumber,
    _id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
  const collection = getCollection();
  collection.push(newDoc);
  // If this is a non-draft invoice, kick any existing drafts that were holding
  // the same provisional number forward — a draft must never share its number
  // with a saved invoice, otherwise the user sees two "INV2026-0005" rows.
  if (status !== 'draft') {
    bumpConflictingDrafts(collection, invoiceNumber);
  }
  saveCollection(collection);
  return newDoc;
}

/** Renumber any draft invoices whose number collides with `takenNumber`.
 *  Mutates `collection` in place — caller is responsible for `saveCollection`. */
function bumpConflictingDrafts(collection: InvoiceDocument[], takenNumber: string): void {
  const target = takenNumber.trim();
  if (!target) return;
  // Save the in-progress collection so generateInvoiceNumber sees fresh state.
  saveCollection(collection);
  let bumped = false;
  for (let i = 0; i < collection.length; i++) {
    const d = collection[i];
    if ((d.status ?? 'saved') !== 'draft') continue;
    if (d.invoiceNumber.trim() !== target) continue;
    const fresh = generateInvoiceNumber();
    collection[i] = { ...d, invoiceNumber: fresh, updatedAt: new Date().toISOString() };
    saveCollection(collection); // commit so next generateInvoiceNumber sees this draft's new number
    bumped = true;
  }
  if (bumped && typeof window !== 'undefined') {
    // Tell the UI to refresh its in-memory snapshot — a draft's displayed
    // number may have just changed under it.
    window.dispatchEvent(new CustomEvent('invoiceDB:changed'));
  }
}

export function findOne(id: string): InvoiceDocument | null {
  return getCollection().find((d) => d._id === id) ?? null;
}

export function findAll(): InvoiceDocument[] {
  return getCollection();
}

export function updateOne(id: string, updates: Partial<InvoiceDocument>): InvoiceDocument | null {
  const collection = getCollection();
  const idx = collection.findIndex((d) => d._id === id);
  if (idx === -1) return null;
  // Reject the update if it would create a duplicate invoice number.
  if (updates.invoiceNumber !== undefined) {
    const nextStatus = updates.status ?? collection[idx].status ?? 'saved';
    if (nextStatus !== 'draft' && invoiceNumberExists(updates.invoiceNumber, id)) {
      return null;
    }
  }
  collection[idx] = { ...collection[idx], ...updates, updatedAt: new Date().toISOString() };
  // If this update produced a non-draft invoice, bump any drafts that were
  // still holding the same number.
  const finalStatus = collection[idx].status ?? 'saved';
  if (finalStatus !== 'draft' && collection[idx].invoiceNumber) {
    bumpConflictingDrafts(collection, collection[idx].invoiceNumber);
  }
  saveCollection(collection);
  return collection[idx];
}

export function deleteOne(id: string): boolean {
  const collection = getCollection();
  const target = collection.find((d) => d._id === id);
  if (!target) return false;
  // Sent invoices form an audit trail — never delete them. The UI also hides
  // the button, this is the last line of defence against stale code paths.
  if (target.status === 'mail-sent' || target.status === 'modified') return false;
  const filtered = collection.filter((d) => d._id !== id);
  if (filtered.length === collection.length) return false;
  saveCollection(filtered);
  // Fire-and-forget: free the file blobs that belonged to this invoice.
  // Failures are non-fatal — the worst case is an orphan blob, not data loss.
  if (target) {
    import('./attachmentStore').then(({ deleteAttachment }) => {
      for (const att of target.attachments ?? []) {
        if (att.blobId) deleteAttachment(att.blobId).catch(() => { /* ignore */ });
      }
    });
  }
  return true;
}

const blankLocation = (): LocationData => ({ country: '', state: '', city: '', pincode: '' });

export function createLineItem(overrides: Partial<LineItem> = {}): LineItem {
  return {
    _id: uuidv4(),
    description: '',
    hsnCode: '',
    uom: 'Pcs',
    quantity: 1,
    unitRate: 0,
    tax: 'None',
    taxRate: 0,
    taxableAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    amount: 0,
    ...overrides,
  };
}

export function createAdditionalCharge(overrides: Partial<AdditionalCharge> = {}): AdditionalCharge {
  return {
    _id: uuidv4(),
    type: 'Freight Charges',
    label: 'Freight Charges',
    amount: 0,
    ...overrides,
  };
}

/** Most recently saved invoice (by updatedAt), used to auto-fill company details on new invoices. */
function getLatestSavedInvoice(): InvoiceDocument | null {
  const saved = getCollection().filter((d) => (d.status ?? 'saved') === 'saved');
  if (!saved.length) return null;
  return saved.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
}

export function createBlankInvoice(): Omit<InvoiceDocument, '_id' | 'createdAt' | 'updatedAt'> {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);

  // Carry company identity over from the most recent saved invoice.
  // Client details and line items stay empty — those change per invoice.
  const last = getLatestSavedInvoice();

  return {
    invoiceNumber: generateInvoiceNumber(),
    status: 'saved',
    invoiceDate: today.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    // Always default to INR for new invoices. The user can switch the currency
    // explicitly after creating; we don't inherit from the last invoice because
    // a one-off USD export shouldn't lock subsequent domestic invoices to USD.
    currency: 'INR',

    poNumber: '',
    projectName: '',
    eWayBillNumber: '',
    transportName: '',
    vehicleNumber: '',

    discountType: 'percentage',
    discountValue: 0,
    discountAmount: 0,
    discountedSubtotal: 0,

    companyName: last?.companyName ?? '',
    companyAddress: last?.companyAddress ?? '',
    companyEmail: last?.companyEmail ?? '',
    companyPhone: last?.companyPhone ?? '',
    companyGst: last?.companyGst ?? '',
    companyLogo: last?.companyLogo ?? null,
    companyLocation: last?.companyLocation ?? blankLocation(),
    companySeal: last?.companySeal ?? null,
    signature: last?.signature ?? null,
    // Carry account details over from the last invoice — these rarely change
    // per invoice and saving the user from re-typing them every time.
    accountDetails: last?.accountDetails ?? {
      accountHolderName: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branchName: '',
    },

    clientName: '',
    clientAddress: '',
    clientEmail: '',
    clientPhone: '',
    clientGst: '',
    clientLocation: blankLocation(),

    deliverySameAsBilling: false,
    siteName: '',
    deliveryAddress: '',
    deliveryLocation: blankLocation(),

    lineItems: [createLineItem()],
    additionalCharges: [],

    taxRate: 18,
    subtotal: 0,
    taxAmount: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    isIntraState: true,
    isExport: false,
    additionalChargesTotal: 0,
    roundOff: 0,
    grandTotal: 0,

    notes: '',
    termsAndConditions: '',
    paymentMethod: '',
    attachments: [],
  };
}
