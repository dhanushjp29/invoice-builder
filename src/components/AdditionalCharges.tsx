import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { AdditionalCharge, AdditionalChargeType } from '../types/invoice';
import { ADDITIONAL_CHARGE_TYPES } from '../types/invoice';
import { createAdditionalCharge } from '../db/invoiceDB';
import Combobox from './Combobox';

// Find another charge in the list (excluding the given id) whose label matches the given label.
function findDuplicate(charges: AdditionalCharge[], label: string, excludeId?: string): AdditionalCharge | undefined {
  const key = label.trim().toLowerCase();
  if (!key) return undefined;
  return charges.find((c) => c._id !== excludeId && c.label.trim().toLowerCase() === key);
}

interface Props {
  charges: AdditionalCharge[];
  currency: string;
  onChange: (charges: AdditionalCharge[]) => void;
}

// Normalise a custom charge name like "service charge" → "Service Charge"
function toTitleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
    .join(' ');
}

export default function AdditionalCharges({ charges, currency, onChange }: Props) {
  // newType holds either a preset key OR a free-text custom label
  const [newType, setNewType] = useState<string>('Freight Charges');

  // Session-only custom labels the user has created. Cleared on page reload
  // (we deliberately don't persist these to localStorage).
  const [customLabels, setCustomLabels] = useState<string[]>([]);

  const isPresetType = (v: string): v is AdditionalChargeType =>
    (ADDITIONAL_CHARGE_TYPES as readonly string[]).includes(v);

  const rememberCustom = (label: string) => {
    if (!label || isPresetType(label)) return;
    setCustomLabels((prev) => (prev.includes(label) ? prev : [...prev, label]));
  };

  // Combined list shown in the dropdown: presets first, then session custom labels
  const typeOptions = useMemo(() => {
    const preset = ADDITIONAL_CHARGE_TYPES.map((t) => ({ value: t, label: t }));
    const custom = customLabels
      .filter((l) => !ADDITIONAL_CHARGE_TYPES.includes(l as AdditionalChargeType))
      .map((l) => ({ value: l, label: l }));
    return [...preset, ...custom];
  }, [customLabels]);

  // Add a new row. If the label already exists, the row is still created so the
  // user can enter their new amount — duplicate detection then shows inline
  // "Sum into existing / Delete this row" buttons next to the duplicate.
  const addCharge = () => {
    const trimmed = newType.trim();
    if (!trimmed) return;
    if (isPresetType(trimmed)) {
      onChange([...charges, createAdditionalCharge({ type: trimmed, label: trimmed })]);
    } else {
      const titled = toTitleCase(trimmed);
      rememberCustom(titled);
      onChange([...charges, createAdditionalCharge({ type: 'Other', label: titled })]);
      setNewType(titled);
    }
  };

  // Resolve a duplicate row by summing its amount into the existing matching row,
  // then deleting the current row.
  const mergeIntoExisting = (currentId: string) => {
    const current = charges.find((c) => c._id === currentId);
    if (!current) return;
    const target = findDuplicate(charges, current.label, currentId);
    if (!target) return;
    const next = charges
      .map((c) => c._id === target._id ? { ...c, amount: (c.amount || 0) + (current.amount || 0) } : c)
      .filter((c) => c._id !== currentId);
    onChange(next);
    toast.success(`Merged into existing "${target.label}".`);
  };

  const updateCharge = (id: string, field: keyof Omit<AdditionalCharge, '_id'>, value: string | number) => {
    onChange(charges.map((c) => c._id === id ? { ...c, [field]: value } : c));
  };

  // Setting the Type combobox on an existing row. Picking a preset sets type=preset;
  // typing a custom name sets type='Other' and uses the typed text as the label.
  const setRowType = (id: string, v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return;
    if (isPresetType(trimmed)) {
      onChange(charges.map((c) => c._id === id
        ? { ...c, type: trimmed, label: trimmed }
        : c));
    } else {
      const titled = toTitleCase(trimmed);
      rememberCustom(titled);
      onChange(charges.map((c) => c._id === id ? { ...c, type: 'Other', label: titled } : c));
    }
  };

  const removeCharge = (id: string) => {
    onChange(charges.filter((c) => c._id !== id));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-5 ring-1 ring-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-blue-100 bg-blue-50 flex items-center gap-2">
        <div className="w-1 h-5 bg-blue-500 rounded-full" />
        <h2 className="text-sm font-bold text-blue-700 uppercase tracking-widest">Additional Charges</h2>
      </div>

      <div className="p-6 space-y-3">
        {charges.length > 0 && (
          <div className="space-y-2">
            {charges.map((charge) => {
              const rowValue = charge.type === 'Other' ? (charge.label || '') : charge.type;
              const dup = findDuplicate(charges, charge.label, charge._id);
              return (
                <div key={charge._id} className={`p-3 rounded-xl bg-slate-50 border ${dup ? 'border-red-200 ring-1 ring-red-200' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Combobox
                        label="Type"
                        value={rowValue}
                        options={typeOptions}
                        onChange={(v) => setRowType(charge._id, v)}
                        placeholder="Select or type a custom name…"
                        creatable
                        error={!!dup}
                      />

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Amount ({currency})</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={charge.amount}
                          onChange={(e) => updateCharge(charge._id, 'amount', parseFloat(e.target.value) || 0)}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-right"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => removeCharge(charge._id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition shrink-0"
                      title="Remove charge"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {dup && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-red-600">
                        "{charge.label}" already exists with {currency}{dup.amount.toFixed(2)} —
                      </span>
                      <button
                        type="button"
                        onClick={() => mergeIntoExisting(charge._id)}
                        title={`Add ${currency}${charge.amount.toFixed(2)} to existing row and delete this one`}
                        className="font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                      >
                        Sum into existing ({currency}{(dup.amount + charge.amount).toFixed(2)})
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCharge(charge._id)}
                        title="Delete this row"
                        className="font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition"
                      >
                        Delete this row
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-3 pt-1">
          <div className="min-w-60">
            <Combobox
              label="Charge Type"
              value={newType}
              options={typeOptions}
              onChange={(v) => setNewType(v)}
              placeholder="Select or type a custom name…"
              creatable
            />
          </div>

          <button
            onClick={addCharge}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Charge
          </button>
        </div>
      </div>
    </div>
  );
}
