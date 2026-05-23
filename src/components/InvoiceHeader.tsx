import LogoUpload from './LogoUpload';
import LocationSelector from './LocationSelector';
import ImageUploadField from './ImageUploadField';
import Combobox from './Combobox';
import DatePicker from './DatePicker';
import type { InvoiceDocument, LocationData, Currency } from '../types/invoice';
import { CURRENCY_OPTIONS } from '../types/invoice';

type Field = keyof Pick<
  InvoiceDocument,
  | 'invoiceNumber' | 'invoiceDate' | 'dueDate' | 'currency'
  | 'companyName' | 'companyAddress' | 'companyEmail' | 'companyPhone'
  | 'companyGst' | 'companyLogo' | 'companyLocation' | 'companySeal' | 'signature'
  | 'poNumber' | 'projectName' | 'eWayBillNumber'
  | 'transportName' | 'vehicleNumber'
>;

interface Props {
  invoice: InvoiceDocument;
  errors?: Set<string>;
  onChange: (field: Field, value: string | null | LocationData | Currency) => void;
}

function InputField({ label, value, onChange, type = 'text', placeholder = '', required = false, error = false, uppercase = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; error?: boolean; uppercase?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-semibold uppercase tracking-wide ${error ? 'text-red-500' : 'text-blue-600'}`}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        className={`px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition placeholder-gray-400${uppercase ? ' uppercase' : ''}`}
      />
    </div>
  );
}


export default function InvoiceHeader({ invoice, errors, onChange }: Props) {
  const hasErr = (key: string) => !!errors?.has(key);
  const currencyInfo = CURRENCY_OPTIONS.find((c) => c.code === invoice.currency) ?? CURRENCY_OPTIONS[0];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-5 ring-1 ring-slate-100 space-y-6">
      {/* Top row: Logo + Company Info on the left, INVOICE badge on the right */}
      <div className="flex flex-col sm:flex-row gap-5">
        <LogoUpload
          logo={invoice.companyLogo}
          onChange={(val) => onChange('companyLogo', val)}
        />
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <InputField
              label="Company Name"
              value={invoice.companyName}
              onChange={(v) => onChange('companyName', v)}
              placeholder="Your Company Name"
              required
              error={hasErr('companyName')}
            />
          </div>
          <div className="sm:col-span-2">
            <InputField
              label="Company Address"
              value={invoice.companyAddress}
              onChange={(v) => onChange('companyAddress', v)}
              placeholder="123 Business Street, Area"
              required
              error={hasErr('companyAddress')}
            />
          </div>
          <InputField
            label="GST Number"
            value={invoice.companyGst}
            onChange={(v) => onChange('companyGst', v)}
            placeholder="22AAAAA0000A1Z5"
            uppercase
          />
          <InputField
            label="Email"
            value={invoice.companyEmail}
            onChange={(v) => onChange('companyEmail', v)}
            placeholder="company@email.com"
            type="email"
          />
          <div className="sm:col-span-2">
            <InputField
              label="Phone"
              value={invoice.companyPhone}
              onChange={(v) => onChange('companyPhone', v)}
              placeholder="+91 98765 43210"
            />
          </div>
        </div>
        <div className="self-start border-2 border-blue-600 text-blue-700 rounded-xl px-6 py-3 text-center">
          <span className="text-lg font-bold tracking-widest">INVOICE</span>
        </div>
      </div>

      {/* Invoice Meta + Currency — tight 3-col grid, matching other sections */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-blue-400 rounded-full" />
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Invoice Details</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <InputField
            label="Invoice Number"
            value={invoice.invoiceNumber}
            onChange={(v) => onChange('invoiceNumber', v)}
            placeholder="INV-0001"
            required
            error={hasErr('invoiceNumber')}
          />
          <DatePicker
            label="Invoice Date"
            value={invoice.invoiceDate}
            onChange={(v) => onChange('invoiceDate', v)}
            required
            error={hasErr('invoiceDate')}
          />
          <DatePicker
            label="Due Date"
            value={invoice.dueDate}
            onChange={(v) => onChange('dueDate', v)}
          />
          <InputField
            label="PO Number"
            value={invoice.poNumber}
            onChange={(v) => onChange('poNumber', v)}
            placeholder="Enter PO Number"
          />
          <InputField
            label="Project Name"
            value={invoice.projectName}
            onChange={(v) => onChange('projectName', v)}
            placeholder="Enter Project Name"
          />
          <InputField
            label="E-Way Bill Number"
            value={invoice.eWayBillNumber}
            onChange={(v) => onChange('eWayBillNumber', v)}
            placeholder="Enter E-Way Bill Number"
          />
          <div className="sm:col-span-2 lg:col-span-1">
            <Combobox
              label="Currency"
              value={invoice.currency}
              options={CURRENCY_OPTIONS.map((c) => ({ value: c.code, label: `${c.symbol} ${c.code} — ${c.name}` }))}
              onChange={(v) => onChange('currency', v as Currency)}
              placeholder="Select currency…"
            />
            <p className="text-xs text-slate-400 mt-1">Selected: {currencyInfo.symbol} ({currencyInfo.code})</p>
          </div>
        </div>
      </div>

      {/* Company Location */}
      <LocationSelector
        label="Company Location"
        value={invoice.companyLocation}
        onChange={(loc) => onChange('companyLocation', loc)}
        requiredLocation
        countryError={hasErr('companyCountry')}
        stateError={hasErr('companyState')}
        cityError={hasErr('companyCity')}
        pincodeError={hasErr('companyPincode')}
      />

      {/* Transport Details */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-blue-400 rounded-full" />
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Transport Details</span>
          <span className="text-xs text-slate-400 font-medium">(Optional)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField
            label="Transport Name"
            value={invoice.transportName}
            onChange={(v) => onChange('transportName', v)}
            placeholder="Enter Transport Name"
          />
          <InputField
            label="Vehicle Number"
            value={invoice.vehicleNumber}
            onChange={(v) => onChange('vehicleNumber', v)}
            placeholder="TN09AB1234"
          />
        </div>
      </div>

      {/* Seal & Signature */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
        <ImageUploadField
          label="Company Seal"
          value={invoice.companySeal}
          onChange={(v) => onChange('companySeal', v)}
          hint="Upload company seal image (PNG/JPG)"
        />
        <ImageUploadField
          label="Authorised Signature"
          value={invoice.signature}
          onChange={(v) => onChange('signature', v)}
          hint="Upload electronic signature image"
        />
      </div>
    </div>
  );
}
