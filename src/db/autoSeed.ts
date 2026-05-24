/**
 * Auto-seed: runs once on first app load (guarded by localStorage flag).
 * Inserts 5 demo invoices covering every status + feature.
 * INV0001 gets real attachments (logo, seal, signature, PDF) stored in IndexedDB.
 */

import { v4 as uuidv4 } from 'uuid';
import { putAttachmentWithId } from './attachmentStore';
import { findAll } from './invoiceDB';
import { recalculate } from '../utils/recalculate';
import type { InvoiceDocument } from '../types/invoice';
import { SEED_ASSETS } from './seedAssets';

const SEED_KEY = 'invoiceBuilder.autoSeeded.v4';

// Dev convenience: window.resetSeed() in the browser console to nuke and re-seed.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).resetSeed = () => {
    localStorage.removeItem(SEED_KEY);
    localStorage.removeItem('invoiceDB_invoices');
    location.reload();
  };
}

// Fixed IDs so the tour can always target INV0001 by a stable DB _id.
export const SEED_INV0001_ID = 'seed-inv-0001-fixed-id-tour-anchor';

const ATTACH_PDF_ID = 'seed-attach-pdf-id';

// Decode a base64 string into a Blob synchronously — no network, no async.
function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function makeDoc(
  overrides: Omit<InvoiceDocument, '_id' | 'createdAt' | 'updatedAt'>,
  fixedId?: string,
): void {
  const calc = recalculate({ ...overrides, _id: '', createdAt: '', updatedAt: '' } as InvoiceDocument);
  const { _id, createdAt, updatedAt, ...doc } = calc;
  void _id; void createdAt; void updatedAt; // unused
  const now = new Date().toISOString();
  const newDoc: InvoiceDocument = {
    ...doc,
    _id: fixedId ?? uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
  // Bypass insertOne so we can set the _id ourselves
  const raw = localStorage.getItem('invoiceDB_invoices');
  const collection: InvoiceDocument[] = raw ? JSON.parse(raw) : [];
  collection.push(newDoc);
  localStorage.setItem('invoiceDB_invoices', JSON.stringify(collection));
}

// In-memory lock prevents React StrictMode double-mount from running autoSeed
// concurrently — by the time the second invocation reaches here, the first is
// already in-flight (the localStorage flag isn't set until after IndexedDB
// writes complete, so a localStorage check alone won't block it).
let seedingInFlight: Promise<void> | null = null;

export function autoSeed(): Promise<void> {
  if (seedingInFlight) return seedingInFlight;
  seedingInFlight = runAutoSeed().finally(() => { seedingInFlight = null; });
  return seedingInFlight;
}

async function runAutoSeed(): Promise<void> {
  const existing = findAll();

  // If the seed flag is set AND we already have invoices, nothing to do.
  if (localStorage.getItem(SEED_KEY) === '1' && existing.length > 0) return;

  // Self-heal: flag set but DB empty → previous seed silently failed. Clear
  // flag and re-seed.
  if (localStorage.getItem(SEED_KEY) === '1' && existing.length === 0) {
    console.warn('[autoSeed] flag set but DB empty — re-seeding');
    localStorage.removeItem(SEED_KEY);
  }

  // Detect demo invoices (from any prior seed run). If ANY demo invoices exist
  // we wipe them ALL — handles the duplicate case where StrictMode previously
  // seeded twice (e.g. 10 rows, 2 of each number).
  const hasAnyDemo = existing.some((d) => /^INV2026-000[1-5]$/.test(d.invoiceNumber));
  const hasNonDemo = existing.some((d) => !/^INV2026-000[1-5]$/.test(d.invoiceNumber));

  if (hasNonDemo) {
    // User has their own data — don't touch it, just mark seeded.
    localStorage.setItem(SEED_KEY, '1');
    return;
  }
  if (hasAnyDemo) {
    // Clean slate: remove every demo invoice so this run inserts exactly 5.
    localStorage.removeItem('invoiceDB_invoices');
  }

  // ── Build data URLs synchronously (no FileReader, no async) ──────────────
  // Logo / seal / signature live on the invoice document as data URLs, so we
  // can just prefix the base64 strings directly — no FileReader needed.
  const logoDataUrl = `data:image/png;base64,${SEED_ASSETS.logo}`;
  const sealDataUrl = `data:image/png;base64,${SEED_ASSETS.seal}`;
  const sigDataUrl  = `data:image/png;base64,${SEED_ASSETS.sig}`;

  // PDF goes into IndexedDB as a Blob — only used for the mail attachment.
  const pdfBlob = base64ToBlob(SEED_ASSETS.pdf, 'application/pdf');

  // ── INV0001 — TN→TN intra-state, saved, all fields, real attachments ─────
  makeDoc({
    invoiceNumber: 'INV2026-0001',
    status: 'saved',
    invoiceDate: '2026-04-05',
    dueDate: '2026-05-05',
    currency: 'INR',
    poNumber: 'PO-2026-0042',
    projectName: 'E-Commerce Web Platform',
    eWayBillNumber: 'EWB1234567890',
    transportName: 'Blue Dart',
    vehicleNumber: 'TN01AB1234',
    companyName: 'TechSoft Solutions Pvt. Ltd.',
    companyAddress: '42, Rajiv Gandhi Salai, Sholinganallur',
    companyEmail: 'dhanushwar771@gmail.com',
    companyPhone: '+91 98400 12345',
    companyGst: '33AABCT1234F1Z5',
    companyLogo: logoDataUrl,
    companySeal: sealDataUrl,
    signature: sigDataUrl,
    companyLocation: { country: 'IN', state: 'TN', city: 'Chennai', pincode: '600119' },
    clientName: 'Nexus Retail India Pvt. Ltd.',
    clientAddress: '15, Anna Salai, Teynampet',
    clientEmail: 'dhanushwarjp@gmail.com',
    clientPhone: '+91 44 2345 6789',
    clientGst: '33AACCN5678G1ZK',
    clientLocation: { country: 'IN', state: 'TN', city: 'Chennai', pincode: '600018' },
    deliverySameAsBilling: false,
    siteName: 'Nexus Warehouse',
    deliveryAddress: 'Plot 7, SIDCO Industrial Estate, Ambattur',
    deliveryLocation: { country: 'IN', state: 'TN', city: 'Chennai', pincode: '600098' },
    lineItems: [
      { _id: uuidv4(), description: 'Website Design & Development', hsnCode: '998314', uom: 'Job',  quantity: 1,   unitRate: 85000, tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'UI/UX Wireframing',            hsnCode: '998314', uom: 'Job',  quantity: 1,   unitRate: 25000, tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'React Frontend Development',   hsnCode: '998314', uom: 'Hours',quantity: 120, unitRate: 800,   tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Node.js Backend API',          hsnCode: '998314', uom: 'Hours',quantity: 80,  unitRate: 900,   tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'SEO Optimization Package',     hsnCode: '998361', uom: 'Days', quantity: 30,  unitRate: 1200,  tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
    ],
    discountType: 'percentage',
    discountValue: 5,
    discountAmount: 0,
    discountedSubtotal: 0,
    additionalCharges: [
      { _id: uuidv4(), type: 'Freight Charges',     label: 'Freight Charges',     amount: 2500 },
      { _id: uuidv4(), type: 'Installation Charges',label: 'Installation Charges',amount: 5000 },
    ],
    taxRate: 18, subtotal: 0, taxAmount: 0,
    totalCGST: 0, totalSGST: 0, totalIGST: 0,
    isIntraState: true, isExport: false,
    additionalChargesTotal: 0, roundOff: 0, grandTotal: 0,
    notes: 'Payment due within 30 days.\nBank transfer preferred.\nThank you for your business!',
    termsAndConditions: '1. All prices in INR inclusive of GST.\n2. Work commences on receipt of 50% advance.\n3. Source code delivered on full payment.\n4. Support included for 3 months post-delivery.',
    paymentMethod: 'Bank Transfer',
    accountDetails: {
      accountHolderName: 'TechSoft Solutions Pvt. Ltd.',
      bankName: 'HDFC Bank',
      accountNumber: '50100123456789',
      ifscCode: 'HDFC0001234',
      branchName: 'Sholinganallur, Chennai',
    },
    attachments: [
      {
        _id: uuidv4(),
        name: 'Terms_and_Conditions.pdf',
        mimeType: 'application/pdf',
        size: pdfBlob.size,
        blobId: ATTACH_PDF_ID,
        includeInMail: true,
      },
    ],
  }, SEED_INV0001_ID);

  // ── INV0002 — MH→MH intra-state, mail-sent ───────────────────────────────
  makeDoc({
    invoiceNumber: 'INV2026-0002',
    status: 'mail-sent',
    cycleCount: 1,
    invoiceDate: '2026-04-12',
    dueDate: '2026-05-12',
    currency: 'INR',
    poNumber: 'PO-MH-0089',
    projectName: 'Corporate Office Interior',
    eWayBillNumber: 'EWB9876543210',
    transportName: 'DTDC',
    vehicleNumber: 'MH04AB1234',
    companyName: 'DesignCraft Interiors LLP',
    companyAddress: '7th Floor, Bandra Kurla Complex',
    companyEmail: 'invoices@designcraft.co.in',
    companyPhone: '+91 22 6789 0123',
    companyGst: '27AADFD4567H1Z3',
    companyLogo: null, companySeal: null, signature: null,
    companyLocation: { country: 'IN', state: 'MH', city: 'Mumbai', pincode: '400051' },
    clientName: 'Prestige Realty Ltd.',
    clientAddress: '3rd Floor, Nariman Point',
    clientEmail: 'finance@prestigerealty.com',
    clientPhone: '+91 22 2345 6789',
    clientGst: '27AAECP9012J1ZL',
    clientLocation: { country: 'IN', state: 'MH', city: 'Mumbai', pincode: '400021' },
    deliverySameAsBilling: false,
    siteName: 'Andheri West Office',
    deliveryAddress: 'Plot 12, MIDC, Andheri West',
    deliveryLocation: { country: 'IN', state: 'MH', city: 'Mumbai', pincode: '400053' },
    lineItems: [
      { _id: uuidv4(), description: 'Space Planning & Concept Design',  hsnCode: '998311', uom: 'Job',   quantity: 1,    unitRate: 45000, tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Modular Workstations (48 Units)',  hsnCode: '940360', uom: 'Nos',   quantity: 48,   unitRate: 18500, tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Ergonomic Office Chairs',          hsnCode: '940130', uom: 'Nos',   quantity: 60,   unitRate: 8500,  tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Electrical Works & Cabling',       hsnCode: '854442', uom: 'Job',   quantity: 1,    unitRate: 120000,tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Interior Painting (2 Coats)',      hsnCode: '320910', uom: 'Sqft',  quantity: 8000, unitRate: 18,    tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
    ],
    discountType: 'amount', discountValue: 25000, discountAmount: 0, discountedSubtotal: 0,
    additionalCharges: [
      { _id: uuidv4(), type: 'Freight Charges',     label: 'Transportation & Logistics', amount: 18000 },
      { _id: uuidv4(), type: 'Installation Charges',label: 'Installation Charges',       amount: 35000 },
    ],
    taxRate: 18, subtotal: 0, taxAmount: 0,
    totalCGST: 0, totalSGST: 0, totalIGST: 0,
    isIntraState: true, isExport: false,
    additionalChargesTotal: 0, roundOff: 0, grandTotal: 0,
    notes: 'Advance of 40% required before work commencement.',
    termsAndConditions: '1. Prices include material and labour.\n2. Warranty: 1 year on workmanship.',
    paymentMethod: 'Cheque',
    accountDetails: {
      accountHolderName: 'DesignCraft Interiors LLP',
      bankName: 'ICICI Bank',
      accountNumber: '004401567890',
      ifscCode: 'ICIC0000044',
      branchName: 'Bandra Kurla Complex, Mumbai',
    },
    attachments: [],
  });

  // ── INV0003 — Export, USD, zero GST, saved ───────────────────────────────
  makeDoc({
    invoiceNumber: 'INV2026-0003',
    status: 'saved',
    invoiceDate: '2026-04-20',
    dueDate: '2026-05-20',
    currency: 'USD',
    poNumber: 'INTL-PO-7731',
    projectName: 'Solar Panel Export — Q1',
    eWayBillNumber: '', transportName: 'Maersk Line', vehicleNumber: 'MRSK-9923',
    companyName: 'SunPower Exports Pvt. Ltd.',
    companyAddress: 'Plot 18, GIDC Industrial Estate, Vatva',
    companyEmail: 'exports@sunpowerindia.com',
    companyPhone: '+91 79 2657 3344',
    companyGst: '24AAHFS3456K1ZQ',
    companyLogo: null, companySeal: null, signature: null,
    companyLocation: { country: 'IN', state: 'GJ', city: 'Ahmedabad', pincode: '382445' },
    clientName: 'GreenGrid Energy LLC',
    clientAddress: '500 Technology Drive, Austin',
    clientEmail: 'procurement@greengrid.us',
    clientPhone: '+1 512 800 4422',
    clientGst: '',
    clientLocation: { country: 'US', state: '', city: 'Austin, TX', pincode: '78701' },
    deliverySameAsBilling: true, siteName: '', deliveryAddress: '',
    deliveryLocation: { country: '', state: '', city: '', pincode: '' },
    lineItems: [
      { _id: uuidv4(), description: 'Monocrystalline Solar Panel 400W', hsnCode: '854140', uom: 'Pcs', quantity: 500, unitRate: 95,  tax: 'None', taxRate: 0, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Solar Inverter 5kW Grid-Tie',      hsnCode: '850440', uom: 'Nos', quantity: 50,  unitRate: 420, tax: 'None', taxRate: 0, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'MPPT Charge Controller 60A',       hsnCode: '850440', uom: 'Nos', quantity: 100, unitRate: 180, tax: 'None', taxRate: 0, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Mounting Structure (Rooftop)',      hsnCode: '730820', uom: 'Set', quantity: 80,  unitRate: 210, tax: 'None', taxRate: 0, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
    ],
    discountType: 'percentage', discountValue: 3, discountAmount: 0, discountedSubtotal: 0,
    additionalCharges: [
      { _id: uuidv4(), type: 'Freight Charges',  label: 'Sea Freight (CIF Austin)',     amount: 4800 },
      { _id: uuidv4(), type: 'Packing Charges',  label: 'Export Packing & Labelling',   amount: 1200 },
    ],
    taxRate: 0, subtotal: 0, taxAmount: 0,
    totalCGST: 0, totalSGST: 0, totalIGST: 0,
    isIntraState: false, isExport: true,
    additionalChargesTotal: 0, roundOff: 0, grandTotal: 0,
    notes: 'Payment by LC within 45 days.',
    termsAndConditions: '1. Prices are CIF Austin, TX.\n2. All disputes subject to ICC Arbitration, Geneva.',
    paymentMethod: 'Bank Transfer',
    accountDetails: {
      accountHolderName: 'SunPower Exports Pvt. Ltd.',
      bankName: 'State Bank of India',
      accountNumber: '33215678901',
      ifscCode: 'SBIN0003321',
      branchName: 'GIDC Vatva, Ahmedabad',
    },
    attachments: [],
  });

  // ── INV0004 — DL→DL intra-state, modified (cycleCount 2) ─────────────────
  makeDoc({
    invoiceNumber: 'INV2026-0004',
    status: 'modified',
    cycleCount: 2,
    invoiceDate: '2026-05-02',
    dueDate: '2026-05-17',
    currency: 'INR',
    poNumber: 'PO-DL-5512',
    projectName: 'Pharma Distribution Q2',
    eWayBillNumber: '', transportName: '', vehicleNumber: '',
    companyName: 'MedSupply Distributors Pvt. Ltd.',
    companyAddress: '22, Patparganj Industrial Area',
    companyEmail: 'billing@medsupply.in',
    companyPhone: '+91 11 4321 9876',
    companyGst: '07AABCM7890D1ZE',
    companyLogo: null, companySeal: null, signature: null,
    companyLocation: { country: 'IN', state: 'DL', city: 'New Delhi', pincode: '110092' },
    clientName: 'Apollo Pharmacy — Rohini',
    clientAddress: 'Shop 4, Sector 9, Rohini',
    clientEmail: 'purchase.rohini@apollopharmacy.in',
    clientPhone: '+91 11 2778 4400',
    clientGst: '07AABCA1234P1ZR',
    clientLocation: { country: 'IN', state: 'DL', city: 'New Delhi', pincode: '110085' },
    deliverySameAsBilling: true, siteName: '', deliveryAddress: '',
    deliveryLocation: { country: '', state: '', city: '', pincode: '' },
    lineItems: [
      { _id: uuidv4(), description: 'Paracetamol 500mg Strip (10 Tabs)',    hsnCode: '300490', uom: 'Pack',  quantity: 2000, unitRate: 18,  tax: 'GST 12%', taxRate: 12, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Amoxicillin 500mg Capsules (10)',      hsnCode: '300490', uom: 'Pack',  quantity: 500,  unitRate: 45,  tax: 'GST 12%', taxRate: 12, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'ORS Sachets (Box of 20)',              hsnCode: '300490', uom: 'Box',   quantity: 300,  unitRate: 120, tax: 'GST 12%', taxRate: 12, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Surgical Gloves (Box of 100)',         hsnCode: '401511', uom: 'Box',   quantity: 150,  unitRate: 320, tax: 'GST 12%', taxRate: 12, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'N95 Masks (Box of 20)',                hsnCode: '630790', uom: 'Box',   quantity: 100,  unitRate: 450, tax: 'GST 5%',  taxRate: 5,  taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
    ],
    discountType: 'amount', discountValue: 5000, discountAmount: 0, discountedSubtotal: 0,
    additionalCharges: [],
    taxRate: 12, subtotal: 0, taxAmount: 0,
    totalCGST: 0, totalSGST: 0, totalIGST: 0,
    isIntraState: true, isExport: false,
    additionalChargesTotal: 0, roundOff: 0, grandTotal: 0,
    notes: 'Cold-chain items stored at 2–8°C.',
    termsAndConditions: '1. Returns accepted within 7 days for damaged goods only.',
    paymentMethod: 'UPI',
    accountDetails: {
      accountHolderName: 'MedSupply Distributors Pvt. Ltd.',
      bankName: 'Axis Bank',
      accountNumber: '912010055667788',
      ifscCode: 'UTIB0000123',
      branchName: 'Patparganj, New Delhi',
    },
    attachments: [],
  });

  // ── INV0005 — draft ───────────────────────────────────────────────────────
  makeDoc({
    invoiceNumber: 'INV2026-0005',
    status: 'draft',
    invoiceDate: '2026-05-15',
    dueDate: '2026-06-14',
    currency: 'INR',
    poNumber: '',
    projectName: 'ERP Implementation — Phase 2',
    eWayBillNumber: '', transportName: '', vehicleNumber: '',
    companyName: 'Axiom Consulting Services',
    companyAddress: '8th Floor, Cyber City Tower B',
    companyEmail: 'accounts@axiomconsult.in',
    companyPhone: '+91 124 456 7890',
    companyGst: '06AABCA5678B1ZF',
    companyLogo: null, companySeal: null, signature: null,
    companyLocation: { country: 'IN', state: 'HR', city: 'Gurugram', pincode: '122002' },
    clientName: 'Bharat Agro Industries Ltd.',
    clientAddress: 'Industrial Estate, Kanpur Road',
    clientEmail: 'cfo@bharatagro.co.in',
    clientPhone: '+91 512 234 5678',
    clientGst: '09AABCB2345C1ZP',
    clientLocation: { country: 'IN', state: 'UP', city: 'Lucknow', pincode: '226012' },
    deliverySameAsBilling: false, siteName: '', deliveryAddress: '',
    deliveryLocation: { country: '', state: '', city: '', pincode: '' },
    lineItems: [
      { _id: uuidv4(), description: 'ERP Requirement Analysis',    hsnCode: '998314', uom: 'Job',  quantity: 1,   unitRate: 60000, tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'SAP S/4HANA Configuration',   hsnCode: '998314', uom: 'Hours',quantity: 200, unitRate: 2500,  tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
      { _id: uuidv4(), description: 'Data Migration & Cleansing',  hsnCode: '998314', uom: 'Job',  quantity: 1,   unitRate: 75000, tax: 'GST 18%', taxRate: 18, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 0 },
    ],
    discountType: 'percentage', discountValue: 0, discountAmount: 0, discountedSubtotal: 0,
    additionalCharges: [
      { _id: uuidv4(), type: 'Other', label: 'Travel & Accommodation', amount: 22000 },
    ],
    taxRate: 18, subtotal: 0, taxAmount: 0,
    totalCGST: 0, totalSGST: 0, totalIGST: 0,
    isIntraState: false, isExport: false,
    additionalChargesTotal: 0, roundOff: 0, grandTotal: 0,
    notes: 'Draft invoice — pending client PO confirmation.',
    termsAndConditions: '1. Billing in monthly milestones.',
    paymentMethod: 'Bank Transfer',
    accountDetails: {
      accountHolderName: 'Axiom Consulting Services',
      bankName: 'Kotak Mahindra Bank',
      accountNumber: '7654321098',
      ifscCode: 'KKBK0000765',
      branchName: 'Cyber City, Gurugram',
    },
    attachments: [],
  });

  // Bump the seed key so existing users get re-seeded with accountDetails.
  localStorage.setItem(SEED_KEY, '1');

  // Notify the rest of the app that the local DB just changed — components
  // that hold an in-memory snapshot (InvoiceBuilder's `allInvoices` state) can
  // refresh from storage. This avoids the "empty list" race where the UI
  // mounted before autoSeed had finished writing.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('invoiceDB:seeded'));
  }

  // ── Fire-and-forget IndexedDB blob writes (PDF attachment for INV0001) ───
  // Done last so the synchronous localStorage seed is already live by the time
  // the list mounts — the PDF only matters when the user reaches the mail step.
  Promise.all([
    putAttachmentWithId(ATTACH_PDF_ID, pdfBlob),
  ]).catch((err) => console.warn('[autoSeed] IndexedDB blob write failed:', err));
}
