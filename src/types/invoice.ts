export type UOM =
  | 'Pcs' | 'Nos' | 'Units' | 'Set' | 'Pair'
  | 'Kg' | 'Gms' | 'Ton' | 'MT'
  | 'Ltr' | 'ML' | 'Gallon'
  | 'Mtr' | 'Cm' | 'Ft' | 'Inch'
  | 'Sqft' | 'Sqmt'
  | 'Box' | 'Carton' | 'Pack' | 'Roll' | 'Bundle' | 'Bag'
  | 'Hours' | 'Days';

export const UOM_OPTIONS: UOM[] = [
  'Pcs', 'Nos', 'Units', 'Set', 'Pair',
  'Kg', 'Gms', 'Ton', 'MT',
  'Ltr', 'ML', 'Gallon',
  'Mtr', 'Cm', 'Ft', 'Inch',
  'Sqft', 'Sqmt',
  'Box', 'Carton', 'Pack', 'Roll', 'Bundle', 'Bag',
  'Hours', 'Days',
];

export type TaxType = 'None' | 'GST 5%' | 'GST 12%' | 'GST 18%' | 'GST 28%' | 'IGST 5%' | 'IGST 12%' | 'IGST 18%' | 'IGST 28%';

export const TAX_OPTIONS: TaxType[] = [
  'None', 'GST 5%', 'GST 12%', 'GST 18%', 'GST 28%',
  'IGST 5%', 'IGST 12%', 'IGST 18%', 'IGST 28%',
];

export const TAX_RATES: Record<TaxType, number> = {
  'None': 0, 'GST 5%': 5, 'GST 12%': 12, 'GST 18%': 18, 'GST 28%': 28,
  'IGST 5%': 5, 'IGST 12%': 12, 'IGST 18%': 18, 'IGST 28%': 28,
};

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'JPY' | 'CNY' | 'CAD' | 'AUD';

export const CURRENCY_OPTIONS: { code: Currency; symbol: string; name: string }[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

export type PaymentMethod =
  | 'Bank Transfer' | 'UPI' | 'Cash' | 'Cheque' | 'Demand Draft'
  | 'Credit Card' | 'Debit Card' | 'NEFT' | 'RTGS' | 'IMPS';

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = [
  'Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Demand Draft',
  'Credit Card', 'Debit Card', 'NEFT', 'RTGS', 'IMPS',
];

export type AdditionalChargeType =
  | 'Freight Charges' | 'Loading Charges' | 'Unloading Charges'
  | 'Weighment Charges' | 'Packing Charges' | 'Handling Charges'
  | 'Installation Charges' | 'Insurance Charges' | 'Other';

// User-facing preset list (the 'Other' marker is intentionally excluded — custom
// charges go through the creatable combobox flow with type='Other' under the hood).
export const ADDITIONAL_CHARGE_TYPES: AdditionalChargeType[] = [
  'Freight Charges', 'Loading Charges', 'Unloading Charges',
  'Weighment Charges', 'Packing Charges', 'Handling Charges',
  'Installation Charges', 'Insurance Charges',
];

export interface AdditionalCharge {
  _id: string;
  type: AdditionalChargeType;
  label: string;
  amount: number;
}

export interface LocationData {
  country: string;
  state: string;
  city: string;
  pincode: string;
}

export interface LineItem {
  _id: string;
  description: string;
  hsnCode: string;
  uom: UOM | string; // may be a preset UOM or a session-only custom unit name
  quantity: number;
  unitRate: number;
  tax: TaxType;
  taxRate: number; // total GST % the user entered (e.g. 18). Split into CGST+SGST or IGST based on intra/inter-state.
  // Derived per-item amounts (recomputed in recalculate)
  taxableAmount: number; // qty * unitRate
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  amount: number; // taxableAmount + cgst + sgst + igst
}

export type DiscountType = 'percentage' | 'amount';

export interface InvoiceDocument {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: Currency;

  // Optional header fields
  poNumber: string;
  projectName: string;
  eWayBillNumber: string;

  // Transport details
  transportName: string;
  vehicleNumber: string;

  // Discount
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number; // derived

  // Company / Seller
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  companyGst: string;
  companyLogo: string | null;
  companyLocation: LocationData;
  companySeal: string | null;
  signature: string | null;

  // Client / Buyer
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  clientGst: string;
  clientLocation: LocationData;

  // Delivery
  deliverySameAsBilling: boolean;
  siteName: string;
  deliveryAddress: string;
  deliveryLocation: LocationData;

  // Line items & charges
  lineItems: LineItem[];
  additionalCharges: AdditionalCharge[];

  // Totals
  taxRate: number; // legacy field — kept for backward compat, not used in new GST logic
  subtotal: number; // sum of taxableAmount across all line items
  discountedSubtotal: number; // subtotal - discountAmount (GST is applied on this)
  taxAmount: number; // total GST = cgst + sgst + igst (kept for backward compat / print)
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  isIntraState: boolean; // true → CGST+SGST, false → IGST (ignored when isExport)
  isExport: boolean;     // true → foreign buyer, treat as export / zero-rated supply
  additionalChargesTotal: number;
  roundOff: number;
  grandTotal: number;

  // Misc
  notes: string;
  termsAndConditions: string;
  paymentMethod: PaymentMethod | '';

  // File attachments (stored as base64 data URLs; not shown in print/preview)
  attachments: Attachment[];

  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  _id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // base64 data URL
}
