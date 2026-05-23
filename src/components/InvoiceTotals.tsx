import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { PaymentMethod } from '../types/invoice';
import { PAYMENT_METHOD_OPTIONS } from '../types/invoice';

// Normalise a custom payment method like "online wallet" → "Online Wallet"
function toTitleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
    .join(' ');
}

// Convert number to words. Indian numbering for INR (Lakhs/Crores),
// Western numbering (Thousand/Million/Billion) for everything else.
function toWords(amount: number, majorUnit: string, minorUnit: string, useIndianSystem: boolean): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (amount === 0) return `Zero ${majorUnit} Only`;

  const [intPart, decPart] = Math.abs(amount).toFixed(2).split('.');
  const n = parseInt(intPart, 10);
  const minor = parseInt(decPart, 10);

  function below1000(num: number): string {
    if (num === 0) return '';
    if (num < 20) return ones[num] + ' ';
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '') + ' ';
    return ones[Math.floor(num / 100)] + ' Hundred ' + below1000(num % 100);
  }

  function indian(num: number): string {
    if (num === 0) return '';
    if (num < 1000) return below1000(num);
    if (num < 100000) return below1000(Math.floor(num / 1000)) + 'Thousand ' + below1000(num % 1000);
    if (num < 10000000) return below1000(Math.floor(num / 100000)) + 'Lakh ' + indian(num % 100000);
    return below1000(Math.floor(num / 10000000)) + 'Crore ' + indian(num % 10000000);
  }

  function western(num: number): string {
    if (num === 0) return '';
    if (num < 1000) return below1000(num);
    if (num < 1_000_000) return below1000(Math.floor(num / 1000)) + 'Thousand ' + below1000(num % 1000);
    if (num < 1_000_000_000) return western(Math.floor(num / 1_000_000)) + 'Million ' + western(num % 1_000_000);
    return western(Math.floor(num / 1_000_000_000)) + 'Billion ' + western(num % 1_000_000_000);
  }

  const convert = useIndianSystem ? indian : western;
  let result = (amount < 0 ? 'Minus ' : '') + convert(n).trim() + ' ' + majorUnit;
  if (minor > 0) result += ' and ' + below1000(minor).trim() + ' ' + minorUnit;
  return result + ' Only';
}

// Map currency code → (major unit, minor unit, numbering system)
const CURRENCY_WORD_UNITS: Record<string, { major: string; minor: string; indian: boolean }> = {
  INR: { major: 'Rupees', minor: 'Paise', indian: true },
  USD: { major: 'Dollars', minor: 'Cents', indian: false },
  EUR: { major: 'Euros', minor: 'Cents', indian: false },
  GBP: { major: 'Pounds', minor: 'Pence', indian: false },
  AED: { major: 'Dirhams', minor: 'Fils', indian: false },
  SGD: { major: 'Singapore Dollars', minor: 'Cents', indian: false },
  JPY: { major: 'Yen', minor: 'Sen', indian: false },
  CNY: { major: 'Yuan', minor: 'Fen', indian: false },
  CAD: { major: 'Canadian Dollars', minor: 'Cents', indian: false },
  AUD: { major: 'Australian Dollars', minor: 'Cents', indian: false },
};

interface Props {
  subtotal: number;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  discountAmount: number;
  discountedSubtotal: number;
  isIntraState: boolean;
  isExport: boolean;
  isIndianSeller?: boolean;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  additionalChargesTotal: number;
  roundOff: number;
  grandTotal: number;
  notes: string;
  termsAndConditions: string;
  paymentMethod: PaymentMethod | '';
  currencySymbol: string;
  currencyCode: string;
  onDiscountTypeChange: (type: 'percentage' | 'amount') => void;
  onDiscountValueChange: (value: number) => void;
  onRoundOffChange: (val: number) => void;
  onNotesChange: (notes: string) => void;
  onTermsChange: (terms: string) => void;
  onPaymentMethodChange: (method: PaymentMethod | '') => void;
  errors?: Set<string>;
}

export default function InvoiceTotals({
  subtotal, discountType, discountValue, discountAmount, discountedSubtotal,
  isIntraState, isExport, isIndianSeller = true, totalCGST, totalSGST, totalIGST,
  additionalChargesTotal, roundOff, grandTotal,
  notes, termsAndConditions, paymentMethod, currencySymbol, currencyCode,
  onDiscountTypeChange, onDiscountValueChange,
  onRoundOffChange, onNotesChange, onTermsChange, onPaymentMethodChange,
  errors,
}: Props) {
  const hasErr = (key: string) => !!errors?.has(key);
  // Session-only custom payment methods (cleared on reload — no localStorage)
  const [customMethods, setCustomMethods] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draftMethod, setDraftMethod] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  const commitNewMethod = () => {
    const titled = toTitleCase(draftMethod);
    if (!titled) { setAdding(false); setDraftMethod(''); return; }
    const titleLower = titled.toLowerCase();
    const alreadyExists =
      PAYMENT_METHOD_OPTIONS.some((m) => m.toLowerCase() === titleLower) ||
      customMethods.some((m) => m.toLowerCase() === titleLower);
    if (alreadyExists) {
      toast.error(`"${titled}" already exists.`);
      setAdding(false);
      setDraftMethod('');
      return;
    }
    setCustomMethods((prev) => [...prev, titled]);
    onPaymentMethodChange(titled as PaymentMethod | '');
    setDraftMethod('');
    setAdding(false);
  };

  const cancelAdd = () => { setAdding(false); setDraftMethod(''); };

  const removeCustomMethod = (m: string) => {
    setCustomMethods((prev) => prev.filter((x) => x !== m));
    if (paymentMethod === m) onPaymentMethodChange('');
  };

  const units = CURRENCY_WORD_UNITS[currencyCode] ?? { major: currencyCode, minor: 'Cents', indian: false };
  const amountInWords = toWords(grandTotal, units.major, units.minor, units.indian);

  // Base total before any rounding (strip out existing roundOff so we always
  // compute the raw fractional amount — not a fraction of an already-rounded total)
  const preTotal = parseFloat((grandTotal - roundOff).toFixed(2));
  const frac = parseFloat((preTotal % 1).toFixed(2));
  // Positive frac → need to subtract to reach floor, or add to reach ceil.
  // Automatically pick whichever gives the smaller adjustment (standard rounding):
  //   frac < 0.5 → round down → roundOff is negative (-frac)
  //   frac >= 0.5 → round up  → roundOff is positive (1 - frac)
  const autoMagnitude = frac >= 0.5
    ? parseFloat((1 - frac).toFixed(2))
    : parseFloat((frac === 0 ? 0 : frac).toFixed(2));
  const autoSign: '+' | '-' = frac >= 0.5 ? '+' : '-';
  // Magnitude shown in the Auto button label (always positive)
  const displayMagnitude = autoMagnitude.toFixed(2);

  // Sign preference tracked locally so toggling +/- never forces a magnitude.
  const [signPref, setSignPref] = useState<'+' | '-'>('+');
  const currentSign: '+' | '-' = roundOff !== 0 ? (roundOff < 0 ? '-' : '+') : signPref;

  // Click Auto: pick sign automatically and apply the computed magnitude.
  const applyAutoRound = () => {
    if (autoMagnitude === 0) { onRoundOffChange(0); return; }
    onRoundOffChange(autoSign === '-' ? -autoMagnitude : autoMagnitude);
  };

  // Click + or -: only set sign preference (and flip existing value if one is already set).
  // Never injects a magnitude on its own.
  const setRoundOffSign = (sign: '+' | '-') => {
    setSignPref(sign);
    const magnitude = Math.abs(roundOff);
    if (magnitude > 0) {
      onRoundOffChange(sign === '-' ? -magnitude : magnitude);
    }
  };

  return (
    <div className="space-y-5 mb-5">
      {/* Notes + Totals row */}
      <div className="flex flex-col md:flex-row gap-5">
        {/* Notes */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ring-1 ring-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-blue-500 rounded-full" />
            <h2 className="text-sm font-bold text-blue-700 uppercase tracking-widest">Notes</h2>
          </div>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Payment terms, thank you message, or any additional notes…"
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder-gray-400 transition"
          />
        </div>

        {/* Totals Summary */}
        <div className="w-full md:w-96 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-blue-500 rounded-full" />
              <h2 className="text-sm font-bold text-blue-700 uppercase tracking-widest">Summary</h2>
            </div>
            {isExport && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 uppercase tracking-wider">
                Export Invoice
              </span>
            )}
          </div>

          {isExport && isIndianSeller && (
            <div className="mb-3 p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 font-medium">
              GST Exempt · Zero Rated Supply
            </div>
          )}

          <div className="space-y-2">
            {/* Subtotal */}
            <div className="flex justify-between items-center py-2 border-b border-blue-50">
              <span className="text-sm text-gray-500 font-medium">Subtotal</span>
              <span className="text-sm font-semibold text-gray-800">{currencySymbol}{subtotal.toFixed(2)}</span>
            </div>

            {/* Discount */}
            <div className="flex justify-between items-center py-2 border-b border-blue-50 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm text-gray-500 font-medium">Discount</span>
                <button
                  type="button"
                  onClick={() => onDiscountTypeChange('percentage')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition ${discountType === 'percentage' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700'}`}
                >%</button>
                <button
                  type="button"
                  onClick={() => onDiscountTypeChange('amount')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition ${discountType === 'amount' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700'}`}
                >{currencySymbol}</button>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max={discountType === 'percentage' ? 100 : undefined}
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => {
                    let v = Math.max(0, parseFloat(e.target.value) || 0);
                    if (discountType === 'percentage') v = Math.min(v, 100);
                    onDiscountValueChange(v);
                  }}
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 bg-white text-sm text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
                {discountAmount > 0 && (
                  <span className="text-sm font-semibold text-red-500">−{currencySymbol}{discountAmount.toFixed(2)}</span>
                )}
              </div>
            </div>

            {/* Taxable Amount (after discount) */}
            {discountAmount > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-blue-50">
                <span className="text-sm text-gray-500 font-medium">Taxable Amount</span>
                <span className="text-sm font-semibold text-gray-800">{currencySymbol}{discountedSubtotal.toFixed(2)}</span>
              </div>
            )}

            {/* Tax section. Indian sellers: CGST+SGST (intra) or IGST (inter). Non-Indian sellers: single Tax Amount row. Always shown — even when zero. */}
            {!isExport && isIndianSeller && (isIntraState ? (
              <>
                <div className="flex justify-between items-center py-2 border-b border-blue-50">
                  <span className="text-sm text-gray-500 font-medium">CGST</span>
                  <span className="text-sm font-semibold text-gray-800">{currencySymbol}{totalCGST.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-blue-50">
                  <span className="text-sm text-gray-500 font-medium">SGST</span>
                  <span className="text-sm font-semibold text-gray-800">{currencySymbol}{totalSGST.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center py-2 border-b border-blue-50">
                <span className="text-sm text-gray-500 font-medium">IGST</span>
                <span className="text-sm font-semibold text-gray-800">{currencySymbol}{totalIGST.toFixed(2)}</span>
              </div>
            ))}
            {!isExport && !isIndianSeller && (
              <div className="flex justify-between items-center py-2 border-b border-blue-50">
                <span className="text-sm text-gray-500 font-medium">Tax Amount</span>
                <span className="text-sm font-semibold text-gray-800">{currencySymbol}{(totalCGST + totalSGST + totalIGST).toFixed(2)}</span>
              </div>
            )}

            {/* Additional Charges */}
            {additionalChargesTotal > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-blue-50">
                <span className="text-sm text-gray-500 font-medium">Additional Charges</span>
                <span className="text-sm font-semibold text-gray-800">{currencySymbol}{additionalChargesTotal.toFixed(2)}</span>
              </div>
            )}

            {/* Round Off */}
            <div className="flex justify-between items-center py-2 border-b border-blue-50 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm text-gray-500 font-medium">Round Off</span>
                <button
                  type="button"
                  onClick={applyAutoRound}
                  title="Automatically apply best round off"
                  className="text-xs font-semibold px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                >
                  Auto ({autoSign}{displayMagnitude})
                </button>
                <button
                  type="button"
                  onClick={() => setRoundOffSign('+')}
                  title="Round up"
                  className={`w-6 h-6 rounded-md text-xs font-bold transition ${
                    currentSign === '+'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700'
                  }`}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setRoundOffSign('-')}
                  title="Round down"
                  className={`w-6 h-6 rounded-md text-xs font-bold transition ${
                    currentSign === '-'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700'
                  }`}
                >
                  −
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={Math.abs(roundOff)}
                onChange={(e) => {
                  const mag = parseFloat(e.target.value) || 0;
                  onRoundOffChange(currentSign === '-' ? -mag : mag);
                }}
                className="w-24 px-2 py-1 rounded-lg border border-slate-200 bg-white text-sm text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
            </div>

            {/* Grand Total */}
            <div className="flex justify-between items-center bg-blue-700 rounded-xl px-4 py-3 mt-2">
              <span className="text-sm font-bold text-white uppercase tracking-wide">Grand Total</span>
              <span className="text-lg font-extrabold text-white">{currencySymbol}{grandTotal.toFixed(2)}</span>
            </div>

            {/* Amount in Words */}
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Amount in Words</p>
              <p className="text-sm text-slate-700 font-medium leading-relaxed">{amountInWords}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ring-1 ring-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-1 h-5 rounded-full ${hasErr('paymentMethod') ? 'bg-red-500' : 'bg-blue-500'}`} />
          <h2 className={`text-sm font-bold uppercase tracking-widest ${hasErr('paymentMethod') ? 'text-red-600' : 'text-blue-700'}`}>
            Payment Method <span className="text-red-500">*</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {PAYMENT_METHOD_OPTIONS.map((method) => (
            <button
              key={method}
              onClick={() => onPaymentMethodChange(paymentMethod === method ? '' : method)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                paymentMethod === method
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {method}
            </button>
          ))}

          {customMethods.map((method) => {
            const active = paymentMethod === method;
            return (
              <span
                key={method}
                className={`group inline-flex items-center rounded-xl border text-sm font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange(active ? '' : (method as PaymentMethod | ''))}
                  className="pl-4 pr-2 py-2"
                >
                  {method}
                </button>
                <button
                  type="button"
                  onClick={() => removeCustomMethod(method)}
                  title="Remove"
                  className={`pr-2 pl-1 py-2 rounded-r-xl transition ${
                    active ? 'text-white/80 hover:text-white' : 'text-slate-300 hover:text-red-500'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            );
          })}

          {adding ? (
            <span className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2 py-1">
              <input
                ref={addInputRef}
                autoFocus
                type="text"
                value={draftMethod}
                placeholder="New method…"
                onChange={(e) => setDraftMethod(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitNewMethod(); }
                  else if (e.key === 'Escape') { e.preventDefault(); cancelAdd(); }
                }}
                className="bg-transparent text-sm text-blue-800 placeholder-blue-300 focus:outline-none w-36"
              />
              <button
                type="button"
                onClick={commitNewMethod}
                title="Add"
                className="w-6 h-6 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={cancelAdd}
                title="Cancel"
                className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-red-500 transition flex items-center justify-center"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              title="Add custom payment method"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          )}
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ring-1 ring-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-1 h-5 rounded-full ${hasErr('termsAndConditions') ? 'bg-red-500' : 'bg-blue-500'}`} />
          <h2 className={`text-sm font-bold uppercase tracking-widest ${hasErr('termsAndConditions') ? 'text-red-600' : 'text-blue-700'}`}>
            Terms &amp; Conditions <span className="text-red-500">*</span>
          </h2>
        </div>
        <textarea
          value={termsAndConditions}
          onChange={(e) => onTermsChange(e.target.value)}
          placeholder={`1. Goods once sold will not be taken back.\n2. Payment due within 30 days of invoice date.\n3. Interest @ 18% p.a. will be charged on overdue payments.`}
          rows={5}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder-gray-400 transition"
        />
      </div>
    </div>
  );
}
