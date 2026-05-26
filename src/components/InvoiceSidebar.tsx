import { useState } from 'react';
import type { InvoiceDocument } from '../types/invoice';
import { statusColors, statusLabel } from '../utils/invoiceStatus';

// Desktop sidebar shows 15 rows per page (the original behaviour). Mobile
// strip shows fewer cards per page since each card is wider than a row.
const PER_PAGE_DESKTOP = 15;
const PER_PAGE_MOBILE = 10;

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
  // Single search + page state shared between desktop and mobile layouts.
  // CSS responsively shows one or the other — never both at once.
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

  // Two paginations driven by the same `page` state but different page sizes —
  // since CSS only ever shows one layout at a time, only one matters at a time.
  // We re-derive the visible slice per layout below.

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  // ── Desktop (lg+) sidebar — unchanged from before ──
  const desktopTotalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE_DESKTOP));
  const desktopPage = Math.min(page, desktopTotalPages);
  const desktopPaginated = filtered.slice((desktopPage - 1) * PER_PAGE_DESKTOP, desktopPage * PER_PAGE_DESKTOP);

  // ── Mobile (< lg) horizontal strip ──
  const mobileTotalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE_MOBILE));
  const mobilePage = Math.min(page, mobileTotalPages);
  const mobilePaginated = filtered.slice((mobilePage - 1) * PER_PAGE_MOBILE, mobilePage * PER_PAGE_MOBILE);

  return (
    <>
      {/* ═════════════════════════════════════════════════════════════════
          MOBILE: horizontal strip between the top nav and the editor.
          Hidden at lg+ where the desktop sidebar takes over.
          ═════════════════════════════════════════════════════════════════ */}
      <aside data-tour="sidebar-list-mobile" className="lg:hidden w-full mb-3">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header row: title + count + search + new */}
          <div className="px-3 py-2 border-b border-blue-100 bg-blue-50 flex items-center gap-2 flex-wrap">
            <div className="w-1 h-4 bg-blue-500 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">Invoices</span>
            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-1.5 py-0.5 leading-none">
              {invoices.length}
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search…"
                  className="pl-7 pr-6 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-32 placeholder-slate-400"
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

              {/* New */}
              <button
                onClick={onNew}
                title="New Invoice"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 active:scale-95 text-white transition-all shadow-sm shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Horizontal card strip */}
          {filtered.length === 0 ? (
            <div className="px-3 py-6 flex flex-col items-center text-center gap-2">
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[11px] text-slate-400 leading-snug">
                {q ? 'No matches.' : 'No saved invoices yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex gap-2 px-3 py-3 snap-x snap-mandatory">
                {mobilePaginated.map((inv) => {
                  const isActive = !!activeId && inv._id === activeId;
                  const colors = statusColors(inv.status);
                  return (
                    <button
                      key={inv._id}
                      onClick={() => onSelect(inv._id)}
                      className={`shrink-0 snap-start w-44 text-left p-2.5 rounded-xl border transition
                        ${isActive
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className={`text-xs font-bold truncate leading-snug ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                          {inv.invoiceNumber || '—'}
                        </span>
                        <span className={`inline-flex items-center gap-0.5 shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${colors.bg} ${colors.text}`}>
                          <span className={`w-1 h-1 rounded-full ${colors.dot}`} />
                          {statusLabel(inv)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate leading-snug font-medium">
                        {inv.clientName || '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-none mt-1">
                        {fmtDate(inv.invoiceDate)}
                      </p>
                      {inv.projectName && (
                        <p className="text-[10px] text-slate-500 truncate leading-snug italic mt-0.5">
                          {inv.projectName}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagination — only shown when more than one page */}
          {filtered.length > 0 && mobileTotalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50">
              <button
                disabled={mobilePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 disabled:opacity-20 disabled:cursor-not-allowed text-slate-500 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[11px] text-slate-500 font-semibold tracking-wide">
                {mobilePage} / {mobileTotalPages} · {filtered.length} invoices
              </span>
              <button
                disabled={mobilePage >= mobileTotalPages}
                onClick={() => setPage((p) => p + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 disabled:opacity-20 disabled:cursor-not-allowed text-slate-500 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ═════════════════════════════════════════════════════════════════
          DESKTOP: vertical sidebar, hidden under lg. Unchanged layout.
          ═════════════════════════════════════════════════════════════════ */}
      <aside data-tour="sidebar-list-desktop" className="w-52 shrink-0 hidden lg:block">
        <div
          className="sticky top-18 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
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
              disabled={desktopPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200 disabled:opacity-20 disabled:cursor-not-allowed text-slate-500 transition"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[10px] text-slate-500 font-semibold tracking-wide">
              {filtered.length === 0 ? '—' : `${desktopPage} / ${desktopTotalPages}`}
            </span>
            <button
              disabled={desktopPage >= desktopTotalPages}
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
              {desktopPaginated.map((inv) => {
                const isActive = !!activeId && inv._id === activeId;
                const colors = statusColors(inv.status);
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
                      <span className={`inline-flex items-center gap-0.5 shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${colors.bg} ${colors.text}`}>
                        <span className={`w-1 h-1 rounded-full ${colors.dot}`} />
                        {statusLabel(inv)}
                      </span>
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
    </>
  );
}
