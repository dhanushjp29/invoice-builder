import { useEffect, useMemo, useRef, useState } from 'react';
import Combobox from './Combobox';

interface Props {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDisplay(iso: string): string {
  const d = parseISO(iso);
  if (!d) return '';
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DatePicker({ label, value, onChange, required = false, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => parseISO(value), [value]);
  const today = useMemo(() => new Date(), []);

  // View month/year (default to selected, else today). Reset on open via openPopup().
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  function openPopup() {
    // Snap view to currently selected date (or today) every time the popup opens
    const base = selected ?? today;
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setOpen(true);
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      if (wrapRef.current?.contains(target)) return;
      // Clicks landing inside a portaled Combobox popup (e.g. the month dropdown
      // rendered to document.body) shouldn't close the date picker.
      if (target.closest?.('[data-combobox-popup]')) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const grid = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startDay = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: ({ date: Date; outside: boolean })[] = [];

    // Leading days from previous month
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
      cells.push({ date: d, outside: true });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: new Date(viewYear, viewMonth, i), outside: false });
    }
    // Trailing days
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      cells.push({ date: next, outside: true });
    }
    return cells;
  }, [viewYear, viewMonth]);

  function go(deltaMonths: number) {
    const total = viewYear * 12 + viewMonth + deltaMonths;
    setViewYear(Math.floor(total / 12));
    setViewMonth(((total % 12) + 12) % 12);
  }

  function pick(d: Date) {
    onChange(toISO(d));
    setOpen(false);
  }

  function clear() {
    onChange('');
    setOpen(false);
  }

  function pickToday() {
    pick(new Date());
  }

  return (
    <div ref={wrapRef} className="flex flex-col gap-1 relative">
      {label && (
        <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          readOnly
          value={formatDisplay(value)}
          placeholder={placeholder || 'Select date…'}
          onClick={() => (open ? setOpen(false) : openPopup())}
          onFocus={() => { if (!open) openPopup(); }}
          className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition placeholder-gray-400 cursor-pointer"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => (open ? setOpen(false) : openPopup())}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-72">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => go(-1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-32">
                <Combobox
                  value={String(viewMonth)}
                  options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
                  onChange={(v) => setViewMonth(Number(v))}
                />
              </div>
              <input
                type="number"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value) || viewYear)}
                className="w-20 text-sm font-bold text-blue-700 bg-blue-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
              />
            </div>

            <button
              type="button"
              onClick={() => go(1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headings */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map(({ date, outside }) => {
              const isSelected = selected && sameDay(selected, date);
              const isToday = sameDay(today, date);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => pick(date)}
                  className={[
                    'h-8 text-xs font-medium rounded-lg transition',
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                      : outside
                        ? 'text-slate-300 hover:bg-slate-50'
                        : isToday
                          ? 'text-blue-700 bg-blue-50 ring-1 ring-blue-200 hover:bg-blue-100'
                          : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700',
                  ].join(' ')}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={clear}
              className="text-xs font-semibold text-slate-500 hover:text-red-500 transition"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={pickToday}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
