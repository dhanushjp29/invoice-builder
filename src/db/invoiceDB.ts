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
 *  Finds the highest existing sequence number for the current FY prefix, then increments.
 */
export function generateInvoiceNumber(): string {
  const prefix = getInvoicePrefix();
  const fyYear = fyStartYear(new Date());
  const stem = `${prefix}${fyYear}-`;          // e.g. "INV2026-"

  // Only count invoices with status 'saved' — drafts do not hold a sequence number.
  const collection = getCollection().filter((d) => (d.status ?? 'saved') === 'saved');
  let max = 0;
  for (const doc of collection) {
    if (doc.invoiceNumber.startsWith(stem)) {
      const seq = parseInt(doc.invoiceNumber.slice(stem.length), 10);
      if (!isNaN(seq) && seq > max) max = seq;
    }
  }
  return `${stem}${String(max + 1).padStart(4, '0')}`;
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
  const newDoc: InvoiceDocument = { ...doc, _id: uuidv4(), createdAt: now, updatedAt: now };
  const collection = getCollection();
  collection.push(newDoc);
  saveCollection(collection);
  return newDoc;
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
  collection[idx] = { ...collection[idx], ...updates, updatedAt: new Date().toISOString() };
  saveCollection(collection);
  return collection[idx];
}

export function deleteOne(id: string): boolean {
  const collection = getCollection();
  const target = collection.find((d) => d._id === id);
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
    currency: last?.currency ?? 'INR',

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
