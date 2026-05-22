import type { InvoiceDocument, LocationData } from '../types/invoice';
import LocationSelector from './LocationSelector';

type Field = keyof Pick<
  InvoiceDocument,
  | 'clientName' | 'clientAddress' | 'clientEmail' | 'clientPhone' | 'clientGst'
  | 'clientLocation' | 'deliverySameAsBilling' | 'siteName' | 'deliveryAddress' | 'deliveryLocation'
>;

interface Props {
  invoice: InvoiceDocument;
  onChange: (field: Field, value: string | boolean | LocationData) => void;
}

function InputField({ label, value, onChange, type = 'text', placeholder = '', required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition placeholder-gray-400"
      />
    </div>
  );
}

export default function ClientInfo({ invoice, onChange }: Props) {

  const handleSameAsBilling = (checked: boolean) => {
    onChange('deliverySameAsBilling', checked);
    if (checked) {
      onChange('deliveryAddress', invoice.clientAddress);
      onChange('deliveryLocation', invoice.clientLocation);
    }
  };

  return (
    <div className="space-y-5 mb-5">
      {/* Bill To */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ring-1 ring-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-blue-500 rounded-full" />
          <h2 className="text-sm font-bold text-blue-700 uppercase tracking-widest">Bill To (Buyer)</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <InputField
              label="Client Name"
              value={invoice.clientName}
              onChange={(v) => onChange('clientName', v)}
              placeholder="Client / Company Name"
            />
          </div>
          <div className="sm:col-span-2">
            <InputField
              label="Billing Address"
              value={invoice.clientAddress}
              onChange={(v) => onChange('clientAddress', v)}
              placeholder="Street, Area"
            />
          </div>
          <InputField
            label="GST Number"
            value={invoice.clientGst}
            onChange={(v) => onChange('clientGst', v)}
            placeholder="22AAAAA0000A1Z5"
            required
          />
          <InputField
            label="Client Email"
            value={invoice.clientEmail}
            onChange={(v) => onChange('clientEmail', v)}
            placeholder="client@email.com"
            type="email"
          />
          <InputField
            label="Client Phone"
            value={invoice.clientPhone}
            onChange={(v) => onChange('clientPhone', v)}
            placeholder="+91 98765 43210"
          />
        </div>

        <div className="mt-4">
          <LocationSelector
            label="Billing Location"
            value={invoice.clientLocation}
            onChange={(loc) => onChange('clientLocation', loc)}
          />
        </div>
      </div>

      {/* Delivery Address */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ring-1 ring-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-blue-500 rounded-full" />
            <h2 className="text-sm font-bold text-blue-700 uppercase tracking-widest">Delivery Address</h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={invoice.deliverySameAsBilling}
              onChange={(e) => handleSameAsBilling(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-xs font-semibold text-slate-600">Same as Billing Address</span>
          </label>
        </div>

        <div className="space-y-3">
          <InputField
            label="Site Name"
            value={invoice.siteName ?? ''}
            onChange={(v) => onChange('siteName', v)}
            placeholder="Site / Project Location Name (optional)"
          />
          {invoice.deliverySameAsBilling ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-0.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Copied from Billing</p>
              <p className="text-sm text-gray-700 font-medium">{invoice.clientAddress || <span className="text-slate-400 italic">No billing address entered</span>}</p>
              {[invoice.clientLocation.city, invoice.clientLocation.state, invoice.clientLocation.pincode, invoice.clientLocation.country].filter(Boolean).length > 0 && (
                <p className="text-sm text-gray-500">{[invoice.clientLocation.city, invoice.clientLocation.state, invoice.clientLocation.pincode, invoice.clientLocation.country].filter(Boolean).join(', ')}</p>
              )}
            </div>
          ) : (
            <>
              <InputField
                label="Delivery Address"
                value={invoice.deliveryAddress}
                onChange={(v) => onChange('deliveryAddress', v)}
                placeholder="Street, Area"
              />
              <LocationSelector
                label="Delivery Location"
                value={invoice.deliveryLocation}
                onChange={(loc) => onChange('deliveryLocation', loc)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
