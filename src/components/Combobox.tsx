import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ComboOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  /** Render label red and add red ring on the input (used for validation feedback) */
  error?: boolean;
  /** When true, input style matches a borderless table cell (used inside LineItemsTable) */
  variant?: 'default' | 'cell';
  /** Optional class added to wrapper */
  className?: string;
  /** Allow free-text values not in the option list (e.g. custom labels) */
  creatable?: boolean;
}

interface PopupPos {
  top: number;
  left: number;
  width: number;
}

export default function Combobox({
  value, options, onChange, placeholder, label, required = false, error = false,
  variant = 'default', className = '', creatable = false,
}: Props) {
  const selectedLabel = useMemo(() => {
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : (value ?? '');
  }, [value, options]);

  const [filterText, setFilterText] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [pos, setPos] = useState<PopupPos | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const safe = (filterText ?? '').trim();
    if (!safe) return options.slice(0, 200);
    const q = safe.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 200);
  }, [filterText, options]);

  // Compute popup position from input's bounding rect (viewport coordinates → page coordinates)
  function updatePos() {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + window.scrollY + 4,
      left: r.left + window.scrollX,
      width: r.width,
    });
  }

  useLayoutEffect(() => {
    if (open) updatePos();
  }, [open]);

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePos();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open]);

  // Outside click — must check both the wrapper AND the popup (popup is portaled outside the wrapper)
  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (popupRef.current?.contains(t)) return;
      // If creatable and user typed a non-matching value, commit it as free text on outside click
      if (open && creatable && filterText.trim()) {
        const typed = filterText.trim();
        const exact = options.find((o) => o.label.toLowerCase() === typed.toLowerCase());
        if (exact) onChange(exact.value);
        else if (typed !== selectedLabel) onChange(typed);
      }
      setOpen(false);
      setFilterText('');
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, creatable, filterText, options, selectedLabel, onChange]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  function openPopup() {
    setFilterText('');
    setHighlighted(0);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closePopup() {
    setOpen(false);
    setFilterText('');
  }

  function commit(opt: ComboOption) {
    onChange(opt.value);
    closePopup();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); openPopup(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) {
        commit(filtered[highlighted]);
      } else if (creatable && filterText.trim()) {
        // No match — accept the typed text as the new value
        onChange(filterText.trim());
        closePopup();
      }
    }
    else if (e.key === 'Escape') { e.preventDefault(); closePopup(); }
  }

  const errorRing = '';
  const baseInput =
    (variant === 'cell'
      ? 'w-full px-2 py-1.5 pr-7 rounded-lg border border-transparent bg-transparent text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white focus:border-blue-200 transition placeholder-gray-400 cursor-pointer'
      : 'w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition placeholder-gray-400 cursor-pointer') + errorRing;

  const displayValue = open ? filterText : selectedLabel;

  const popup = open && pos ? (
    <div
      ref={popupRef}
      data-combobox-popup
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000 }}
    >
      {filtered.length > 0 ? (
        <ul
          ref={listRef}
          className="bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt.value}
              onMouseDown={(e) => { e.preventDefault(); commit(opt); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                i === highlighted ? 'bg-blue-50 text-blue-700' : 'text-gray-800 hover:bg-slate-50'
              } ${opt.value === value ? 'font-semibold' : ''}`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {creatable && filterText.trim() ? (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(filterText.trim()); closePopup(); }}
              className="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 transition"
            >
              <span className="text-slate-500">Add new:</span> <span className="font-semibold">“{filterText.trim()}”</span>
            </button>
          ) : (
            <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className={`flex flex-col gap-1 relative ${className}`}>
      {label && (
        <label className={`text-xs font-semibold uppercase tracking-wide ${error ? 'text-red-500' : 'text-blue-600'}`}>
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue ?? ''}
          placeholder={open ? (selectedLabel || placeholder || 'Type to search…') : (placeholder || (label ? `Search ${label}…` : 'Search…'))}
          autoComplete="off"
          onChange={(e) => { setFilterText(e.target.value); setOpen(true); setHighlighted(0); }}
          onFocus={() => { if (!open) openPopup(); }}
          onMouseDown={(e) => {
            if (!open) { e.preventDefault(); openPopup(); }
          }}
          onKeyDown={handleKey}
          className={baseInput}
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); open ? closePopup() : openPopup(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition"
        >
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {popup && createPortal(popup, document.body)}
    </div>
  );
}
