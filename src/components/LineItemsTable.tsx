import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { LineItem } from '../types/invoice';
import { UOM_OPTIONS, TAX_RATES } from '../types/invoice';
import Combobox from './Combobox';
import { findAll } from '../db/invoiceDB';
// TAX_RATES used for legacy fallback on items loaded from old saves

interface Props {
  items: LineItem[];
  currencySymbol: string;
  isExport: boolean;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Omit<LineItem, '_id' | 'amount'>, value: string | number) => void;
  onDelete: (id: string) => void;
  /** Called when the user resolves a duplicate-description row by merging into its twin. */
  onMergeDuplicate: (currentId: string) => void;
}

const cellInput = "w-full px-2 py-1.5 rounded-lg border border-transparent bg-transparent text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white focus:border-blue-200 transition placeholder-gray-400";

export default function LineItemsTable({ items, currencySymbol, isExport, onAdd, onUpdate, onDelete, onMergeDuplicate }: Props) {
  // Session-only custom UOMs the user has typed. Cleared on page reload.
  const [customUoms, setCustomUoms] = useState<string[]>([]);

  // Description suggestions = every non-empty description seen across saved invoices
  // and the items currently on the page. Deduped case-insensitively. Computed once
  // per items[] change — saved invoices don't update mid-session.
  const descriptionOptions = useMemo(() => {
    const fromDB = findAll().flatMap((inv) => inv.lineItems.map((li) => li.description));
    const fromCurrent = items.map((i) => i.description);
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    [...fromDB, ...fromCurrent].forEach((d) => {
      const trimmed = (d || '').trim();
      if (!trimmed) return;
      const k = trimmed.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ value: trimmed, label: trimmed });
    });
    return out;
  }, [items]);

  // Surface any custom UOMs already present in items (e.g. saved earlier in this session)
  const uomOptions = useMemo(() => {
    const presets = UOM_OPTIONS.map((u) => ({ value: u, label: u }));
    const fromItems = items
      .map((i) => i.uom)
      .filter((u): u is string => !!u && !(UOM_OPTIONS as readonly string[]).includes(u));
    const merged = Array.from(new Set([...customUoms, ...fromItems]));
    const custom = merged.map((u) => ({ value: u, label: u }));
    return [...presets, ...custom];
  }, [customUoms, items]);

  const handleUomChange = (id: string, v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return;
    if (!(UOM_OPTIONS as readonly string[]).includes(trimmed)) {
      if (customUoms.some((u) => u.toLowerCase() === trimmed.toLowerCase())) {
        toast.error(`"${trimmed}" is already in UOM list.`);
        return;
      }
      setCustomUoms((prev) => [...prev, trimmed]);
    }
    onUpdate(id, 'uom', trimmed);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-5 overflow-hidden ring-1 ring-slate-100">
      <div className="px-6 py-4 border-b border-blue-100 bg-blue-50 flex items-center gap-2">
        <div className="w-1 h-5 bg-blue-500 rounded-full" />
        <h2 className="text-sm font-bold text-blue-700 uppercase tracking-widest">Line Items</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-225">
          <thead>
            <tr className="bg-blue-50/60 border-b border-blue-100">
              <th className="text-left px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider w-8">#</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider min-w-40">Description <span className="text-red-500">*</span></th>
              <th className="text-left px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider w-24">HSN Code</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider w-24">UOM <span className="text-red-500">*</span></th>
              <th className="text-right px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider w-20">Qty <span className="text-red-500">*</span></th>
              <th className="text-right px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider w-28">Rate ({currencySymbol}) <span className="text-red-500">*</span></th>
              {!isExport && (
                <>
                  <th className="text-left px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider w-20">Tax %</th>
                  <th className="text-right px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider w-26">Tax Amt ({currencySymbol})</th>
                </>
              )}
              <th className="text-right px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider w-28">Amount ({currencySymbol})</th>
              <th className="px-3 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              // taxRate is authoritative; fall back to TAX_RATES for legacy saved data
              const currentTaxRate = item.taxRate ?? TAX_RATES[item.tax] ?? 0;
              // Per-item tax amount = CGST + SGST + IGST. For legacy items lacking
              // the split fields, derive from taxableAmount × taxRate.
              const splitTax = (item.cgstAmount ?? 0) + (item.sgstAmount ?? 0) + (item.igstAmount ?? 0);
              const fallbackBase = item.taxableAmount ?? (item.quantity || 0) * (item.unitRate || 0);
              const taxAmtForItem = splitTax > 0 ? splitTax : (fallbackBase * currentTaxRate) / 100;

              return (
                <tr key={item._id} className="border-b border-slate-100 hover:bg-blue-50/20 transition group">
                  <td className="px-3 py-2 text-sm text-blue-400 font-semibold">{idx + 1}</td>

                  <td className="px-2 py-2">
                    {(() => {
                      const isDupDesc = !!item.description.trim() &&
                        items.some((o) => o._id !== item._id && o.description.trim().toLowerCase() === item.description.trim().toLowerCase());
                      return (
                        <div className="relative">
                          <Combobox
                            variant="cell"
                            value={item.description}
                            options={descriptionOptions}
                            onChange={(v) => onUpdate(item._id, 'description', v)}
                            placeholder="Item description…"
                            creatable
                            error={isDupDesc}
                          />
                          {isDupDesc && (
                            <div className="absolute -top-5 left-0 z-10 flex items-center gap-1 whitespace-nowrap">
                              <span className="text-[10px] text-red-500 font-semibold">Duplicate —</span>
                              <button
                                type="button"
                                onClick={() => onMergeDuplicate(item._id)}
                                title="Sum this row's quantity into the existing matching row, then delete this row"
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                              >
                                Sum into existing
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(item._id)}
                                disabled={items.length === 1}
                                title="Delete this row"
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Delete this row
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={item.hsnCode}
                      placeholder="HSN…"
                      onChange={(e) => onUpdate(item._id, 'hsnCode', e.target.value)}
                      className={cellInput}
                    />
                  </td>

                  <td className="px-2 py-2">
                    <Combobox
                      variant="cell"
                      value={item.uom}
                      options={uomOptions}
                      onChange={(v) => handleUomChange(item._id, v)}
                      placeholder="UOM…"
                      creatable
                    />
                  </td>

                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => onUpdate(item._id, 'quantity', parseFloat(e.target.value) || 0)}
                      className={`${cellInput} text-right`}
                    />
                  </td>

                  <td className="px-2 py-2">
                    <div className="relative flex items-center">
                      <span className="absolute left-2 text-[11px] text-gray-400 pointer-events-none select-none leading-none">{currencySymbol}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitRate}
                        onChange={(e) => onUpdate(item._id, 'unitRate', parseFloat(e.target.value) || 0)}
                        className={`${cellInput} text-right pl-4`}
                      />
                    </div>
                  </td>

                  {!isExport && (
                    <>
                      <td className="px-2 py-2">
                        <div className="relative flex items-center w-16">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={currentTaxRate || ''}
                            placeholder="0"
                            onChange={(e) => {
                              const rate = Math.min(parseFloat(e.target.value) || 0, 100);
                              onUpdate(item._id, 'taxRate', rate);
                            }}
                            className={`${cellInput} pr-5 text-right`}
                          />
                          <span className="absolute right-1.5 text-xs text-gray-400 pointer-events-none select-none">%</span>
                        </div>
                      </td>

                      <td className="px-3 py-2 text-right text-sm font-medium text-gray-600 whitespace-nowrap">
                        {currencySymbol}{taxAmtForItem.toFixed(2)}
                      </td>
                    </>
                  )}

                  <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800 whitespace-nowrap">
                    {currencySymbol}{item.amount.toFixed(2)}
                  </td>

                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => onDelete(item._id)}
                      disabled={items.length === 1}
                      title="Remove item"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-20 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-blue-50">
        <button
          onClick={onAdd}
          className="flex items-center gap-2 text-sm text-blue-600 font-semibold hover:text-blue-800 transition"
        >
          <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Add Line Item
        </button>
      </div>
    </div>
  );
}
