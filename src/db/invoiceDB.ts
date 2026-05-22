import { v4 as uuidv4 } from 'uuid';
import type { InvoiceDocument, LineItem, AdditionalCharge, LocationData, Attachment } from '../types/invoice';

export function createAttachment(file: File, data: string): Attachment {
  return {
    _id: uuidv4(),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    data,
  };
}

const COLLECTION_KEY = 'invoiceDB_invoices';

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
  const filtered = collection.filter((d) => d._id !== id);
  if (filtered.length === collection.length) return false;
  saveCollection(filtered);
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
    tax: 'GST 18%',
    taxRate: 18,
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

export function createBlankInvoice(): Omit<InvoiceDocument, '_id' | 'createdAt' | 'updatedAt'> {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);

  return {
    invoiceNumber: `INV-${Date.now()}`,
    invoiceDate: today.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
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

    companyName: '',
    companyAddress: '',
    companyEmail: '',
    companyPhone: '',
    companyGst: '',
    companyLogo: null,
    companyLocation: blankLocation(),
    companySeal: null,
    signature: null,

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
    discountedSubtotal: 0,
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
