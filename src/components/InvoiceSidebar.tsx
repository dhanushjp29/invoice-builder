import { useState } from 'react';
import type { InvoiceDocument } from '../types/invoice';

const PER_PAGE = 15;

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  invoices: InvoiceDocument[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function InvoiceSidebar({ invoices, activeId, onSelect, onNew }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const q = search.trim().toLowerCase();

  const filtered = [...invoices]
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .filter((inv) => {
      if (!q) return true;
      const d = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
      const monthName = d ? d.toLocaleString('default', { month: 'long' }).toLowerCase() : '';
      const monthShort = d ? d.toLocaleString('default', { month: 'short' }).toLowerCase() : '';
      const year = d ? String(d.getFullYear()) : '';
      const day = d ? String(d.getDate()).padStart(2, '0') : '';
      const fullDate = d ? fmtDate(inv.invoiceDate).toLowerCase() : '';
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        (inv.projectName || '').toLowerCase().includes(q) ||
        inv.status.toLowerCase().includes(q) ||
        fullDate.includes(q) ||
        monthName.includes(q) ||
        monthShort.includes(q) ||
        year.includes(q) ||
        day.includes(q)
      );
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  return (
    <aside className="w-52 shrink-0 hidden lg:block">
      <div
        className="sticky top-[4.5rem] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
        style={{ maxHeight: 'calc(100vh - 5.5rem)' }}
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-blue-100 bg-blue-50 flex items-center gap-1.5 shrink-0 rounded-t-2xl">
          <div className="w-1 h-4 bg-blue-500 rounded-full" />
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">Invoices</span>
          <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-1.5 py-0.5 leading-none">
            {invoices.length}
          </span>
          <div className="flex-1" />
          <button
            onClick={onNew}
            title="New Invoice"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 active:scale-95 text-white transition-all shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Pagination bar — always visible */}
        <div className="flex items-center justify-between px-3 py-0.5 border-b border-slate-100 bg-slate-50 shrink-0">
          <button
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200 disabled:opacity-20 disabled:cursor-not-allowed text-slate-500 transition"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-[10px] text-slate-500 font-semibold tracking-wide">
            {filtered.length === 0 ? '—' : `${currentPage} / ${totalPages}`}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200 disabled:opacity-20 disabled:cursor-not-allowed text-slate-500 transition"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-2 py-2 border-b border-slate-100 bg-white shrink-0">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by #, project, status, date…"
              className="w-full pl-7 pr-6 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition placeholder-slate-400"
            />
            <svg
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            {search && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        

        {/* List */}
        {filtered.length === 0 ? (
          <div className="px-3 py-8 flex flex-col items-center text-center gap-2">
            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-[11px] text-slate-400 leading-snug">
              {q ? 'No matches.' : 'No saved invoices yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {paginated.map((inv) => {
              const isActive = !!activeId && inv._id === activeId;
              const isDraft = inv.status === 'draft';
              return (
                <button
                  key={inv._id}
                  onClick={() => onSelect(inv._id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-100 transition
                    ${isActive
                      ? 'bg-blue-50 border-l-[3px] border-l-blue-500'
                      : 'border-l-[3px] border-l-transparent hover:bg-blue-50/40'}`}
                >
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <span className={`text-xs font-bold truncate leading-snug ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {inv.invoiceNumber || '—'}
                    </span>
                    {isDraft ? (
                      <span className="inline-flex items-center gap-0.5 shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        <span className="w-1 h-1 rounded-full bg-amber-400" />Draft
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
                        <span className="w-1 h-1 rounded-full bg-green-500" />Created
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-none mb-1">{fmtDate(inv.invoiceDate)}</p>
                  {inv.projectName && (
                    <p className="text-[10px] text-slate-500 truncate leading-snug italic">{inv.projectName}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
