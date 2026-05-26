import type ExcelJS from 'exceljs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// `exceljs` (~900 KB) and `file-saver` are only needed when the user actually
// clicks Export — keep them out of the initial bundle.
async function loadExcelDeps() {
  const [exceljsMod, fileSaverMod] = await Promise.all([
    import('exceljs'),
    import('file-saver'),
  ]);
  return {
    ExcelJS: exceljsMod.default,
    saveAs: fileSaverMod.saveAs,
  };
}
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { usePersistentState } from '../hooks/usePersistentState';
import type { InvoiceDocument } from '../types/invoice';
import { CURRENCY_OPTIONS } from '../types/invoice';
import { statusColors, statusLabel } from '../utils/invoiceStatus';
import { notify } from '../utils/notify';
import DatePicker from './DatePicker';
import InvoicePrintView from './InvoicePrintView';
import LottieLoader from './LottieLoader';

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZES = [10, 15, 25, 50];

// ── Shared helpers ────────────────────────────────────────────────────────────
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sym(code: string) { return CURRENCY_OPTIONS.find(c => c.code === code)?.symbol ?? code; }
function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
function n(v?: number | null) { return v ?? 0; }
function s_(v?: string | null) { return v?.trim() || '(Blank)'; }
type SortDir = 'asc' | 'desc';

function colLetter(col: number): string {
  let r = '';
  while (col > 0) { const rem = (col - 1) % 26; r = String.fromCharCode(65 + rem) + r; col = Math.floor((col - 1) / 26); }
  return r;
}

// ── SortIcon ──────────────────────────────────────────────────────────────────
function SortIcon({ field, active, dir, color = 'text-blue-700' }: { field: string; active: string; dir: SortDir; color?: string }) {
  const on = active === field;
  return (
    <span className="inline-flex flex-col items-center ml-0.5 gap-0 leading-none shrink-0">
      <svg className={`w-2 h-2 ${on && dir === 'asc' ? color : 'text-slate-300'}`} viewBox="0 0 6 4" fill="currentColor"><polygon points="3,0 6,4 0,4" /></svg>
      <svg className={`w-2 h-2 ${on && dir === 'desc' ? color : 'text-slate-300'}`} viewBox="0 0 6 4" fill="currentColor"><polygon points="0,0 6,0 3,4" /></svg>
    </span>
  );
}

// ── FunnelIcon ────────────────────────────────────────────────────────────────
function FunnelIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-3 h-3 shrink-0 transition-colors ${active ? 'text-blue-600' : 'text-slate-300'}`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4-2A1 1 0 018 15V10.414L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
    </svg>
  );
}

// ── DropdownSelect — custom portal dropdown, always opens downward ────────────
function DropdownSelect({ value, onChange, options }: {
  value: number;
  onChange: (v: number) => void;
  options: number[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => open ? setOpen(false) : openMenu()}
        className="flex items-center gap-1 pl-3 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 hover:border-blue-300 transition cursor-pointer min-w-16">
        <span className="flex-1 text-left text-sm">{value}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} style={{ position: 'absolute', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 10000 }}
          className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full px-3 py-2 text-sm text-left cursor-pointer transition-colors ${opt === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-800 hover:bg-slate-50'}`}>
              {opt}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── ExcelFilterMenu ───────────────────────────────────────────────────────────
interface FilterMenuProps {
  allVals: string[];
  active: string[] | undefined;
  pos: { top: number; left: number };
  onApply: (vals: string[] | null) => void;
  onClose: () => void;
}
function ExcelFilterMenu({ allVals, active, pos, onApply, onClose }: FilterMenuProps) {
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(() =>
    active ? new Set(active) : new Set(allVals)
  );
  const menuRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => allVals.filter(v => v.toLowerCase().includes(search.toLowerCase())),
    [allVals, search]
  );
  const allVisChecked = visible.length > 0 && visible.every(v => checked.has(v));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  function toggleAll() {
    setChecked(prev => {
      const next = new Set(prev);
      if (allVisChecked) visible.forEach(v => next.delete(v));
      else visible.forEach(v => next.add(v));
      return next;
    });
  }
  function toggle(v: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  }
  function apply() {
    const selected = allVals.filter(v => checked.has(v));
    onApply(selected.length === allVals.length ? null : selected);
  }

  const left = Math.min(pos.left, window.innerWidth - 240);
  const top = pos.top + window.scrollY;

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'absolute', top, left, zIndex: 100000 }}
      className="w-56 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
        <input
          autoFocus
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
          placeholder="Search values…"
          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        />
      </div>
      <div className="max-h-52 overflow-y-auto py-1">
        <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50">
          <input type="checkbox" checked={allVisChecked} onChange={toggleAll} className="accent-blue-600 cursor-pointer" />
          <span className="text-xs font-semibold text-slate-700">(Select All)</span>
        </label>
        {visible.map(v => (
          <label key={v} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-blue-50">
            <input type="checkbox" checked={checked.has(v)} onChange={() => toggle(v)} className="accent-blue-600 cursor-pointer" />
            <span className="text-xs text-slate-700">{v}</span>
          </label>
        ))}
        {visible.length === 0 && (
          <p className="px-3 py-3 text-xs text-slate-400 text-center">No matches</p>
        )}
      </div>
      <div className="flex justify-end gap-2 px-3 py-2 border-t border-slate-100 bg-slate-50">
        <button onClick={() => onApply(null)} className="px-3 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-100 transition font-medium text-slate-600">Clear</button>
        <button onClick={apply} className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition font-medium">OK</button>
      </div>
    </div>,
    document.body
  );
}

// ── Excel shared ──────────────────────────────────────────────────────────────
function xlHeader(row: ExcelJS.Row, count: number) {
  row.height = 22;
  for (let c = 1; c <= count; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: 'FF1E3A5F' }, size: 11, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } } as ExcelJS.Fill;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      bottom: { style: 'medium', color: { argb: 'FF2563EB' } },
      right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    };
  }
}

function xlDataRow(row: ExcelJS.Row, alt: boolean, numCols: Set<number>, pctCols: Set<number> = new Set()) {
  row.height = 18;
  row.eachCell({ includeEmpty: true }, (cell, c) => {
    if (alt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } as ExcelJS.Fill;
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFEFF6FF' } },
      right: { style: 'thin', color: { argb: 'FFEFF6FF' } },
    };
    if (numCols.has(c)) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' }; }
    if (pctCols.has(c)) { cell.numFmt = '0.00'; cell.alignment = { horizontal: 'center' }; }
  });
}

// ── XLSX: All Invoices ────────────────────────────────────────────────────────
async function exportAllXlsx(invoices: InvoiceDocument[]) {
  const { ExcelJS, saveAs } = await loadExcelDeps();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Invoice Builder'; wb.created = new Date();
  const ws = wb.addWorksheet('All Invoices', { pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' } });

  const cols: Partial<ExcelJS.Column>[] = [
    { header: 'Invoice #',       key: 'no',       width: 18 },
    { header: 'Invoice Date',    key: 'idate',    width: 14 },
    { header: 'Due Date',        key: 'ddate',    width: 14 },
    { header: 'Client',          key: 'client',   width: 28 },
    { header: 'Client GST',      key: 'cGst',     width: 18 },
    { header: 'Client Email',    key: 'cEmail',   width: 26 },
    { header: 'Company',         key: 'company',  width: 28 },
    { header: 'Company GST',     key: 'coGst',    width: 18 },
    { header: 'Project',         key: 'project',  width: 22 },
    { header: 'PO Number',       key: 'po',       width: 16 },
    { header: 'E-Way Bill',      key: 'eway',     width: 16 },
    { header: 'Currency',        key: 'curr',     width: 10 },
    { header: 'Status',          key: 'status',   width: 10 },
    { header: 'Subtotal',        key: 'sub',      width: 14 },
    { header: 'Discount Amt',    key: 'disc',     width: 14 },
    { header: 'Discounted Sub',  key: 'discSub',  width: 16 },
    { header: 'Total CGST',      key: 'cgst',     width: 13 },
    { header: 'Total SGST',      key: 'sgst',     width: 13 },
    { header: 'Total IGST',      key: 'igst',     width: 13 },
    { header: 'Total Tax',       key: 'tax',      width: 12 },
    { header: 'Add. Charges',    key: 'addCh',    width: 14 },
    { header: 'Round Off',       key: 'rnd',      width: 11 },
    { header: 'Grand Total',     key: 'grand',    width: 14 },
    { header: 'Payment Method',  key: 'pay',      width: 18 },
    { header: 'Transport',       key: 'transport',width: 18 },
    { header: 'Vehicle No',      key: 'vehicle',  width: 14 },
    { header: 'Notes',           key: 'notes',    width: 32 },
  ];
  ws.columns = cols;
  xlHeader(ws.getRow(1), cols.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = `A1:${colLetter(cols.length)}1`;

  const numCols = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

  invoices.forEach((inv, i) => {
    const row = ws.addRow({
      no: inv.invoiceNumber, idate: inv.invoiceDate, ddate: inv.dueDate,
      client: inv.clientName, cGst: inv.clientGst, cEmail: inv.clientEmail,
      company: inv.companyName, coGst: inv.companyGst,
      project: inv.projectName ?? '', po: inv.poNumber ?? '', eway: inv.eWayBillNumber ?? '',
      curr: inv.currency, status: statusLabel(inv),
      sub: n(inv.subtotal), disc: n(inv.discountAmount), discSub: n(inv.discountedSubtotal),
      cgst: n(inv.totalCGST), sgst: n(inv.totalSGST), igst: n(inv.totalIGST), tax: n(inv.taxAmount),
      addCh: n(inv.additionalChargesTotal), rnd: n(inv.roundOff), grand: n(inv.grandTotal),
      pay: inv.paymentMethod ?? '', transport: inv.transportName ?? '', vehicle: inv.vehicleNumber ?? '',
      notes: inv.notes ?? '',
    });
    xlDataRow(row, i % 2 === 1, numCols);
    const sc = row.getCell('status');
    // Colour by status: draft=amber, mail-sent=blue, modified=orange, saved=green.
    const statusArgb =
      inv.status === 'draft'     ? 'FFB45309'
      : inv.status === 'mail-sent' ? 'FF1D4ED8'
      : inv.status === 'modified'  ? 'FFC2410C'
      : 'FF15803D';
    sc.font = { bold: true, color: { argb: statusArgb } };
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'all-invoices.xlsx');
}

// ── XLSX: Detailed Invoice ────────────────────────────────────────────────────
async function exportDetailedXlsx(invoices: InvoiceDocument[]) {
  const { ExcelJS, saveAs } = await loadExcelDeps();
  // Export EVERY invoice the user is seeing — no longer status-filtered. The
  // caller already strips drafts before passing the list in, so this matches
  // what's on screen (Created / Mail Sent / Modified).
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Invoice Builder'; wb.created = new Date();
  const ws = wb.addWorksheet('Detailed Invoice', { pageSetup: { fitToPage: true, orientation: 'landscape' } });

  const cols: Partial<ExcelJS.Column>[] = [
    { header: 'Invoice #',      key: 'no',      width: 18 },
    { header: 'Invoice Date',   key: 'idate',   width: 13 },
    { header: 'Due Date',       key: 'ddate',   width: 13 },
    { header: 'Client',         key: 'client',  width: 26 },
    { header: 'Client GST',     key: 'cGst',    width: 18 },
    { header: 'Company',        key: 'company', width: 26 },
    { header: 'Project',        key: 'project', width: 20 },
    { header: 'Currency',       key: 'curr',    width: 10 },
    { header: 'Status',         key: 'status',  width: 12 },
    { header: 'Item #',         key: 'itemNo',  width: 7  },
    { header: 'Description',    key: 'desc',    width: 30 },
    { header: 'HSN',            key: 'hsn',     width: 12 },
    { header: 'UOM',            key: 'uom',     width: 8  },
    { header: 'Qty',            key: 'qty',     width: 8  },
    { header: 'Unit Rate',      key: 'rate',    width: 12 },
    { header: 'Tax Type',       key: 'taxType', width: 12 },
    { header: 'Tax %',          key: 'taxPct',  width: 8  },
    { header: 'Taxable Amt',    key: 'taxable', width: 13 },
    { header: 'CGST %',         key: 'cgstP',   width: 9  },
    { header: 'CGST Amt',       key: 'cgstA',   width: 12 },
    { header: 'SGST %',         key: 'sgstP',   width: 9  },
    { header: 'SGST Amt',       key: 'sgstA',   width: 12 },
    { header: 'IGST %',         key: 'igstP',   width: 9  },
    { header: 'IGST Amt',       key: 'igstA',   width: 12 },
    { header: 'Tax Amt',        key: 'taxAmt',  width: 12 },
    { header: 'Item Amount',    key: 'itemAmt', width: 14 },
    { header: 'Inv. Subtotal',  key: 'sub',     width: 14 },
    { header: 'Inv. Discount',  key: 'disc',    width: 14 },
    { header: 'Inv. Taxable',   key: 'discSub', width: 14 },
    { header: 'Inv. CGST',      key: 'invCgst', width: 12 },
    { header: 'Inv. SGST',      key: 'invSgst', width: 12 },
    { header: 'Inv. IGST',      key: 'invIgst', width: 12 },
    { header: 'Add. Charges',   key: 'addCh',   width: 14 },
    { header: 'Round Off',      key: 'rnd',     width: 11 },
    { header: 'Grand Total',    key: 'grand',   width: 14 },
  ];
  ws.columns = cols;
  // Force HSN column to text so numeric-looking codes don't trigger Excel warning
  ws.getColumn('hsn').numFmt = '0';
  xlHeader(ws.getRow(1), cols.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = `A1:${colLetter(cols.length)}1`;

  // Column indices shifted by +1 after inserting the Status column at index 9.
  const numCols = new Set([14, 15, 18, 20, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]);
  const pctCols = new Set([17, 19, 21, 23]);

  let rowIdx = 0;
  for (const inv of invoices) {
    inv.lineItems.forEach((item, idx) => {
      const isFirst = idx === 0;
      const isGST = item.tax.startsWith('GST');
      const halfPct = isGST ? (item.taxRate ?? 0) / 2 : 0;
      const igstPct = !isGST && item.tax !== 'None' ? (item.taxRate ?? 0) : 0;

      const row = ws.addRow({
        no: isFirst ? inv.invoiceNumber : '',
        idate: isFirst ? inv.invoiceDate : '',
        ddate: isFirst ? inv.dueDate : '',
        client: isFirst ? inv.clientName : '',
        cGst: isFirst ? inv.clientGst : '',
        company: isFirst ? inv.companyName : '',
        project: isFirst ? (inv.projectName ?? '') : '',
        curr: isFirst ? inv.currency : '',
        status: isFirst ? statusLabel(inv) : '',
        itemNo: idx + 1,
        desc: item.description,
        hsn: item.hsnCode ? (isNaN(Number(item.hsnCode)) ? item.hsnCode : Number(item.hsnCode)) : '',
        uom: item.uom,
        qty: item.quantity,
        rate: item.unitRate,
        taxType: item.tax,
        taxPct: item.taxRate ?? 0,
        taxable: item.taxableAmount,
        cgstP: halfPct,
        cgstA: item.cgstAmount,
        sgstP: halfPct,
        sgstA: item.sgstAmount,
        igstP: igstPct,
        igstA: item.igstAmount,
        taxAmt: +(item.cgstAmount + item.sgstAmount + item.igstAmount).toFixed(2),
        itemAmt: item.amount,
        sub: isFirst ? n(inv.subtotal) : '',
        disc: isFirst ? n(inv.discountAmount) : '',
        discSub: isFirst ? n(inv.discountedSubtotal) : '',
        invCgst: isFirst ? n(inv.totalCGST) : '',
        invSgst: isFirst ? n(inv.totalSGST) : '',
        invIgst: isFirst ? n(inv.totalIGST) : '',
        addCh: isFirst ? n(inv.additionalChargesTotal) : '',
        rnd: isFirst ? n(inv.roundOff) : '',
        grand: isFirst ? n(inv.grandTotal) : '',
      });
      xlDataRow(row, rowIdx % 2 === 1, numCols, pctCols);

      // Colour the status cell to match the badge (only on the first row of
      // each invoice — subsequent line items leave the cell empty).
      if (isFirst) {
        const sc = row.getCell('status');
        const statusArgb =
          inv.status === 'draft'       ? 'FFB45309'
          : inv.status === 'mail-sent' ? 'FF1D4ED8'
          : inv.status === 'modified'  ? 'FFC2410C'
          : 'FF15803D';
        sc.font = { bold: true, color: { argb: statusArgb } };
      }

      if (isFirst && rowIdx > 0) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = { ...cell.border, top: { style: 'medium', color: { argb: 'FFBFDBFE' } } };
        });
      }
      rowIdx++;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'detailed-invoice.xlsx');
}

// ── PDF download ──────────────────────────────────────────────────────────────
async function downloadPDF(inv: InvoiceDocument) {
  const s = CURRENCY_OPTIONS.find(c => c.code === inv.currency)?.symbol ?? inv.currency;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;background:#fff';
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<InvoicePrintView invoice={inv} currencySymbol={s} />);
  await new Promise(r => setTimeout(r, 300));
  try {
    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: `${inv.invoiceNumber || 'invoice'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(container.firstElementChild as HTMLElement).save();
  } finally { root.unmount(); document.body.removeChild(container); }
}

// ── Pagination ────────────────────────────────────────────────────────────────
interface PagProps { total: number; page: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void; label?: string; theme?: 'blue' | 'violet'; }

function NavBtn({ target, label, disabled, onPage }: { target: number; label: string; disabled: boolean; onPage: (p: number) => void }) {
  return (
    <button
      onClick={() => onPage(target)}
      disabled={disabled}
      className="w-7 h-7 rounded-md flex items-center justify-center text-sm text-slate-500 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition font-medium select-none"
    >
      {label}
    </button>
  );
}

function Pagination({ total, page, pageSize, onPage, onPageSize, label = 'Rows', theme = 'blue' }: PagProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const accent = theme === 'violet' ? 'text-violet-600' : 'text-blue-600';
  const border = theme === 'violet' ? 'border-violet-100 bg-violet-50/30' : 'border-slate-100 bg-slate-50/60';

  return (
    <div className={`flex items-center justify-between flex-wrap gap-x-4 gap-y-2 px-4 sm:px-5 py-3 border-t ${border}`}>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-slate-500 whitespace-nowrap">{label} per page</span>
        <DropdownSelect value={pageSize} onChange={v => { onPageSize(v); onPage(1); }} options={PAGE_SIZES} />
      </div>
      <div className="flex items-center gap-0.5 ml-auto">
        <span className={`text-xs font-medium ${accent} mr-2 whitespace-nowrap`}>{from}–{to} of {total}</span>
        <NavBtn target={1} label="«" disabled={page <= 1} onPage={onPage} />
        <NavBtn target={page - 1} label="‹" disabled={page <= 1} onPage={onPage} />
        <span className="text-xs font-semibold text-slate-700 px-2 min-w-12 text-center select-none">{page}/{totalPages}</span>
        <NavBtn target={page + 1} label="›" disabled={page >= totalPages} onPage={onPage} />
        <NavBtn target={totalPages} label="»" disabled={page >= totalPages} onPage={onPage} />
      </div>
    </div>
  );
}

// ── Date filter strip ─────────────────────────────────────────────────────────
interface DateStripProps { fromDate: string; toDate: string; onFrom: (v: string) => void; onTo: (v: string) => void; onApply: () => void; onClear: () => void; applied: boolean; extraClear?: React.ReactNode; total: number; filtered: number; }
function DateFilterStrip({ fromDate, toDate, onFrom, onTo, onApply, onClear, applied, extraClear, total, filtered }: DateStripProps) {
  return (
    <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-blue-50/30 flex items-end gap-2 sm:gap-3 flex-wrap">
      <DatePicker label="From Date" value={fromDate} onChange={onFrom} placeholder="From date…" />
      <DatePicker label="To Date" value={toDate} onChange={onTo} placeholder="To date…" />
      <button
        onClick={onApply}
        disabled={!fromDate.trim() || !toDate.trim()}
        title={!fromDate.trim() || !toDate.trim() ? 'Pick both From Date and To Date' : 'Apply date filter'}
        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
      >
        Show
      </button>
      {applied && <button onClick={onClear} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition">Clear</button>}
      {extraClear}
      <span className="ml-auto text-xs text-blue-600 font-semibold">
        {filtered === total ? `${total} record${total !== 1 ? 's' : ''}` : `Showing ${filtered} of ${total}`}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALL INVOICES VIEW
// ═══════════════════════════════════════════════════════════════════════════════
type ExportRunner = (kind: 'all' | 'detailed', work: () => Promise<void>) => Promise<void>;
type OverlayRunner = (work: () => Promise<void>) => Promise<void>;
interface AllProps { invoices: InvoiceDocument[]; onSelect: (id: string) => void; onDelete: (id: string) => void; onExport: ExportRunner; onOverlay: OverlayRunner; }
type AllSortField = 'invoiceNumber' | 'clientName' | 'companyName' | 'invoiceDate' | 'dueDate' | 'status' | 'grandTotal';

function allDispVal(inv: InvoiceDocument, key: string): string {
  switch (key) {
    case 'invoiceNumber': return inv.invoiceNumber || '(Blank)';
    case 'clientName': return inv.clientName || '(Blank)';
    case 'companyName': return inv.companyName || '(Blank)';
    case 'invoiceDate': return fmtDate(inv.invoiceDate);
    case 'dueDate': return fmtDate(inv.dueDate ?? '');
    case 'status': return statusLabel(inv);
    default: return '';
  }
}

function AllInvoicesView({ invoices, onSelect, onDelete, onExport, onOverlay }: AllProps) {
  // Persisted across navigation — see usePersistentState. Ephemeral UI state
  // (popover, confirm dialog, in-flight download) stays as plain useState so
  // it doesn't reopen when the user returns.
  const [search, setSearch] = usePersistentState('invoiceList.all.search', '');
  const [fromDate, setFromDate] = usePersistentState('invoiceList.all.fromDate', todayISO);
  const [toDate, setToDate] = usePersistentState('invoiceList.all.toDate', todayISO);
  const [appliedFrom, setAppliedFrom] = usePersistentState('invoiceList.all.appliedFrom', '');
  const [appliedTo, setAppliedTo] = usePersistentState('invoiceList.all.appliedTo', '');
  const [colFilters, setColFilters] = usePersistentState<Record<string, string[]>>('invoiceList.all.colFilters', {});
  const [filterMenu, setFilterMenu] = useState<{ key: string; pos: { top: number; left: number } } | null>(null);
  const [sortField, setSortField] = usePersistentState<AllSortField | 'updatedAt'>('invoiceList.all.sortField', 'updatedAt');
  const [sortDir, setSortDir] = usePersistentState<SortDir>('invoiceList.all.sortDir', 'desc');
  const [page, setPage] = usePersistentState('invoiceList.all.page', 1);
  const [pageSize, setPageSize] = usePersistentState('invoiceList.all.pageSize', 15);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dlId, setDlId] = useState<string | null>(null);

  const hasColFilter = Object.keys(colFilters).length > 0;
  const applyDate = () => { setAppliedFrom(fromDate); setAppliedTo(toDate); };
  const clearDate = () => { setFromDate(''); setToDate(''); setAppliedFrom(''); setAppliedTo(''); };
  const clearCf = () => setColFilters({});
  function toggleSort(f: AllSortField) { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('asc'); } }

  // Base filter (search + date) — used for cascade unique-value calculation
  function baseFilter(inv: InvoiceDocument): boolean {
    const q = search.trim().toLowerCase();
    if (q && !inv.invoiceNumber.toLowerCase().includes(q) && !inv.clientName.toLowerCase().includes(q) && !inv.companyName.toLowerCase().includes(q)) return false;
    if (appliedFrom && inv.invoiceDate < appliedFrom) return false;
    if (appliedTo && inv.invoiceDate > appliedTo) return false;
    return true;
  }

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (!baseFilter(inv)) return false;
      for (const [key, vals] of Object.entries(colFilters)) {
        if (!vals.length) continue;
        if (!vals.includes(allDispVal(inv, key))) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, search, appliedFrom, appliedTo, colFilters]);

  // Get unique values for a column with cascade (all other filters applied)
  function getUniqueVals(colKey: string): string[] {
    const vals = new Set<string>();
    invoices.filter(inv => {
      if (!baseFilter(inv)) return false;
      for (const [k, v] of Object.entries(colFilters)) {
        if (k === colKey) continue;
        if (v.length && !v.includes(allDispVal(inv, k))) return false;
      }
      return true;
    }).forEach(inv => vals.add(allDispVal(inv, colKey)));
    return [...vals].sort();
  }

  function openFilter(e: React.MouseEvent, key: string) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFilterMenu({ key, pos: { top: r.bottom + 4, left: r.left } });
  }

  function applyFilter(key: string, vals: string[] | null) {
    setColFilters(prev => {
      const next = { ...prev };
      if (!vals || !vals.length) delete next[key];
      else next[key] = vals;
      return next;
    });
    setFilterMenu(null);
  }

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortField) {
        case 'grandTotal': va = n(a.grandTotal); vb = n(b.grandTotal); break;
        case 'status': va = statusLabel(a); vb = statusLabel(b); break;
        case 'updatedAt': va = a.updatedAt || ''; vb = b.updatedAt || ''; break;
        default: va = (a[sortField as keyof InvoiceDocument] as string) || ''; vb = (b[sortField as keyof InvoiceDocument] as string) || '';
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  useEffect(() => { setPage(1); }, [search, appliedFrom, appliedTo, colFilters, sortField, sortDir, setPage]);

  const paginated = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize]);

  const handleDl = async (e: React.MouseEvent, inv: InvoiceDocument) => {
    e.stopPropagation();
    setDlId(inv._id);
    try {
      await onOverlay(async () => {
        try {
          await downloadPDF(inv);
        } catch (err) {
          console.error('PDF download failed:', err);
          notify.error('PDF download failed.');
          throw err;
        }
      });
    } finally { setDlId(null); }
  };

  // [field, label, className, filterable]
  const COLS: [AllSortField, string, string, boolean][] = [
    ['invoiceNumber', 'Invoice #', 'text-left', true],
    ['clientName', 'Client', 'text-left', true],
    ['companyName', 'Company', 'text-left hidden lg:table-cell', true],
    ['invoiceDate', 'Date', 'text-left', true],
    ['dueDate', 'Due', 'text-left', true],
    ['status', 'Status', 'text-left', true],
    ['grandTotal', 'Total', 'text-right', false],
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-blue-100 bg-blue-50 flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="w-1 h-5 bg-blue-500 rounded-full" />
        <h2 className="text-sm font-bold text-blue-700 uppercase tracking-widest">All Invoices</h2>
        <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">{invoices.length}</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="relative" data-tour="search">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-32 sm:w-44" />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          </div>
          <button onClick={() => void onExport('all', () => exportAllXlsx(sorted))} disabled={sorted.length === 0}
            data-tour="export-xlsx"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export XLSX
          </button>
        </div>
      </div>

      {/* Date filter */}
      <div data-tour="date-filter">
      <DateFilterStrip fromDate={fromDate} toDate={toDate} onFrom={setFromDate} onTo={setToDate}
        onApply={applyDate} onClear={clearDate} applied={!!(appliedFrom || appliedTo)}
        total={invoices.length} filtered={sorted.length}
        extraClear={hasColFilter ? (
          <button onClick={clearCf} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition">
            Clear Column Filters
          </button>
        ) : undefined}
      />
      </div>

      {/* Empty */}
      {sorted.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-center" data-tour="invoice-table">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">{invoices.length === 0 ? 'No invoices yet' : 'No matches'}</p>
          <p className="text-xs text-slate-400 mt-1">{invoices.length === 0 ? 'Click "New Invoice" to get started.' : 'Try different search terms or clear filters.'}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto" data-tour="invoice-table">
            <table className="w-full min-w-205">
              <thead>
                <tr className="bg-blue-50/50 border-b border-blue-100">
                  {COLS.map(([field, label, cls, filterable]) => (
                    <th key={field} className={`px-4 py-3 ${cls}`}>
                      <div className={`flex items-center gap-1 text-xs font-bold text-blue-600 uppercase tracking-wider ${cls.includes('right') ? 'justify-end' : ''}`}>
                        <button onClick={() => toggleSort(field)} className="flex items-center gap-0.5 cursor-pointer select-none hover:text-blue-800 transition-colors">
                          {label}<SortIcon field={field} active={sortField} dir={sortDir} />
                        </button>
                        {filterable && (
                          <button
                            onClick={e => openFilter(e, field)}
                            className="ml-1 p-0.5 rounded hover:bg-blue-100 transition"
                            title={`Filter ${label}`}
                          >
                            <FunnelIcon active={!!colFilters[field]?.length} />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(inv => {
                  const s = sym(inv.currency);
                  const isSaved = inv.status !== 'draft';
                  const isDl = dlId === inv._id;
                  const isConf = confirmId === inv._id;
                  return (
                    <tr key={inv._id} onClick={() => onSelect(inv._id)}
                      data-tour-row={inv.invoiceNumber}
                      className="border-b border-slate-100 hover:bg-blue-50/30 transition cursor-pointer group">
                      <td className="px-4 py-3.5 text-sm font-semibold text-blue-700">{inv.invoiceNumber || '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-800">{inv.clientName || <span className="text-slate-400 italic">No client</span>}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-600 hidden lg:table-cell">{inv.companyName || '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{fmtDate(inv.dueDate)}</td>
                      <td className="px-4 py-3.5">
                        {(() => {
                          const c = statusColors(inv.status);
                          return (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border ${c.bg} ${c.text} ${c.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                              {statusLabel(inv)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-900 text-right whitespace-nowrap">{s}{n(inv.grandTotal).toFixed(2)}</td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={e => handleDl(e, inv)} disabled={!isSaved || isDl} title={isSaved ? 'Download PDF' : 'Save to download'}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-30">
                            {isDl
                              ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                            PDF
                          </button>
                          {(() => {
                            // Invoices that have been mailed (or modified after mail)
                            // cannot be deleted — they're part of an audit trail.
                            const locked = inv.status === 'mail-sent' || inv.status === 'modified';
                            if (locked) {
                              return (
                                <button disabled title="Sent invoices cannot be deleted"
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                  Locked
                                </button>
                              );
                            }
                            return isConf ? (
                              <div className="inline-flex gap-1">
                                <button onClick={() => { onDelete(inv._id); setConfirmId(null); }} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-500 text-white hover:bg-red-600 transition">Yes</button>
                                <button onClick={() => setConfirmId(null)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmId(inv._id)} title="Delete"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 hover:text-red-700 transition">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                                Delete
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination total={sorted.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
        </>
      )}

      {/* Excel filter popup */}
      {filterMenu && (
        <ExcelFilterMenu
          allVals={getUniqueVals(filterMenu.key)}
          active={colFilters[filterMenu.key]}
          pos={filterMenu.pos}
          onApply={vals => applyFilter(filterMenu.key, vals)}
          onClose={() => setFilterMenu(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAILED INVOICE VIEW — column definitions
// ═══════════════════════════════════════════════════════════════════════════════
type DetColDef = {
  label: string;
  sortFn: (inv: InvoiceDocument) => string | number;
  colVals: (inv: InvoiceDocument) => string[];
  matches: (inv: InvoiceDocument, allowed: string[]) => boolean;
  alignRight?: boolean;
};

const DET_COLS: DetColDef[] = [
  // ── Invoice-level ──────────────────────────────────────────────────────────
  {
    label: 'Invoice #',
    sortFn: inv => inv.invoiceNumber || '',
    colVals: inv => [s_(inv.invoiceNumber)],
    matches: (inv, a) => a.includes(s_(inv.invoiceNumber)),
  },
  {
    label: 'Date',
    sortFn: inv => inv.invoiceDate || '',
    colVals: inv => [fmtDate(inv.invoiceDate)],
    matches: (inv, a) => a.includes(fmtDate(inv.invoiceDate)),
  },
  {
    label: 'Due Date',
    sortFn: inv => inv.dueDate || '',
    colVals: inv => [fmtDate(inv.dueDate ?? '')],
    matches: (inv, a) => a.includes(fmtDate(inv.dueDate ?? '')),
  },
  {
    label: 'Client',
    sortFn: inv => inv.clientName || '',
    colVals: inv => [s_(inv.clientName)],
    matches: (inv, a) => a.includes(s_(inv.clientName)),
  },
  {
    label: 'Company',
    sortFn: inv => inv.companyName || '',
    colVals: inv => [s_(inv.companyName)],
    matches: (inv, a) => a.includes(s_(inv.companyName)),
  },
  {
    label: 'Project',
    sortFn: inv => inv.projectName || '',
    colVals: inv => [s_(inv.projectName)],
    matches: (inv, a) => a.includes(s_(inv.projectName)),
  },
  {
    label: 'Currency',
    sortFn: inv => inv.currency || '',
    colVals: inv => [s_(inv.currency)],
    matches: (inv, a) => a.includes(s_(inv.currency)),
  },
  {
    label: 'Status',
    sortFn: inv => statusLabel(inv),
    colVals: inv => [statusLabel(inv)],
    matches: (inv, a) => a.includes(statusLabel(inv)),
  },
  // ── Item-level ─────────────────────────────────────────────────────────────
  {
    label: '#',
    sortFn: inv => inv.lineItems.length,
    colVals: inv => [...new Set(inv.lineItems.map((_, i) => String(i + 1)))],
    matches: (inv, a) => inv.lineItems.some((_, i) => a.includes(String(i + 1))),
    alignRight: true,
  },
  {
    label: 'Description',
    sortFn: inv => inv.lineItems[0]?.description || '',
    colVals: inv => [...new Set(inv.lineItems.map(it => s_(it.description)))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(s_(it.description))),
  },
  {
    label: 'HSN',
    sortFn: inv => inv.lineItems[0]?.hsnCode || '',
    colVals: inv => [...new Set(inv.lineItems.map(it => it.hsnCode || '—'))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(it.hsnCode || '—')),
  },
  {
    label: 'UOM',
    sortFn: inv => inv.lineItems[0]?.uom || '',
    colVals: inv => [...new Set(inv.lineItems.map(it => s_(it.uom)))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(s_(it.uom))),
  },
  {
    label: 'Qty',
    sortFn: inv => inv.lineItems[0]?.quantity ?? 0,
    colVals: inv => [...new Set(inv.lineItems.map(it => String(it.quantity ?? 0)))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(String(it.quantity ?? 0))),
    alignRight: true,
  },
  {
    label: 'Unit Rate',
    sortFn: inv => inv.lineItems[0]?.unitRate ?? 0,
    colVals: inv => [...new Set(inv.lineItems.map(it => it.unitRate.toFixed(2)))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(it.unitRate.toFixed(2))),
    alignRight: true,
  },
  {
    label: 'Tax Type',
    sortFn: inv => inv.lineItems[0]?.tax || '',
    colVals: inv => [...new Set(inv.lineItems.map(it => s_(it.tax)))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(s_(it.tax))),
  },
  {
    label: 'Tax %',
    sortFn: inv => inv.lineItems[0]?.taxRate ?? 0,
    colVals: inv => [...new Set(inv.lineItems.map(it => `${it.taxRate ?? 0}%`))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(`${it.taxRate ?? 0}%`)),
    alignRight: true,
  },
  {
    label: 'Taxable',
    sortFn: inv => inv.lineItems[0]?.taxableAmount ?? 0,
    colVals: inv => [...new Set(inv.lineItems.map(it => it.taxableAmount.toFixed(2)))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(it.taxableAmount.toFixed(2))),
    alignRight: true,
  },
  {
    label: 'CGST %',
    sortFn: inv => { const it = inv.lineItems[0]; return it?.tax.startsWith('GST') ? (it.taxRate ?? 0) / 2 : 0; },
    colVals: inv => [...new Set(inv.lineItems.map(it => it.tax.startsWith('GST') ? `${(it.taxRate ?? 0) / 2}%` : '—'))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(it.tax.startsWith('GST') ? `${(it.taxRate ?? 0) / 2}%` : '—')),
    alignRight: true,
  },
  {
    label: 'CGST Amt',
    sortFn: inv => inv.lineItems[0]?.cgstAmount ?? 0,
    colVals: inv => [...new Set(inv.lineItems.map(it => it.cgstAmount > 0 ? it.cgstAmount.toFixed(2) : '—'))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(it.cgstAmount > 0 ? it.cgstAmount.toFixed(2) : '—')),
    alignRight: true,
  },
  {
    label: 'SGST %',
    sortFn: inv => { const it = inv.lineItems[0]; return it?.tax.startsWith('GST') ? (it.taxRate ?? 0) / 2 : 0; },
    colVals: inv => [...new Set(inv.lineItems.map(it => it.tax.startsWith('GST') ? `${(it.taxRate ?? 0) / 2}%` : '—'))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(it.tax.startsWith('GST') ? `${(it.taxRate ?? 0) / 2}%` : '—')),
    alignRight: true,
  },
  {
    label: 'SGST Amt',
    sortFn: inv => inv.lineItems[0]?.sgstAmount ?? 0,
    colVals: inv => [...new Set(inv.lineItems.map(it => it.sgstAmount > 0 ? it.sgstAmount.toFixed(2) : '—'))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(it.sgstAmount > 0 ? it.sgstAmount.toFixed(2) : '—')),
    alignRight: true,
  },
  {
    label: 'IGST %',
    sortFn: inv => { const it = inv.lineItems[0]; return (!it?.tax.startsWith('GST') && it?.tax !== 'None') ? (it?.taxRate ?? 0) : 0; },
    colVals: inv => [...new Set(inv.lineItems.map(it => (!it.tax.startsWith('GST') && it.tax !== 'None') ? `${it.taxRate ?? 0}%` : '—'))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes((!it.tax.startsWith('GST') && it.tax !== 'None') ? `${it.taxRate ?? 0}%` : '—')),
    alignRight: true,
  },
  {
    label: 'IGST Amt',
    sortFn: inv => inv.lineItems[0]?.igstAmount ?? 0,
    colVals: inv => [...new Set(inv.lineItems.map(it => it.igstAmount > 0 ? it.igstAmount.toFixed(2) : '—'))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(it.igstAmount > 0 ? it.igstAmount.toFixed(2) : '—')),
    alignRight: true,
  },
  {
    label: 'Tax Amt',
    sortFn: inv => +(((inv.lineItems[0]?.cgstAmount ?? 0) + (inv.lineItems[0]?.sgstAmount ?? 0) + (inv.lineItems[0]?.igstAmount ?? 0)).toFixed(2)),
    colVals: inv => [...new Set(inv.lineItems.map(it => { const t = +(it.cgstAmount + it.sgstAmount + it.igstAmount).toFixed(2); return t > 0 ? t.toFixed(2) : '—'; }))],
    matches: (inv, a) => inv.lineItems.some(it => { const t = +(it.cgstAmount + it.sgstAmount + it.igstAmount).toFixed(2); return a.includes(t > 0 ? t.toFixed(2) : '—'); }),
    alignRight: true,
  },
  {
    label: 'Item Amt',
    sortFn: inv => inv.lineItems[0]?.amount ?? 0,
    colVals: inv => [...new Set(inv.lineItems.map(it => it.amount.toFixed(2)))],
    matches: (inv, a) => inv.lineItems.some(it => a.includes(it.amount.toFixed(2))),
    alignRight: true,
  },
  // ── Invoice totals ─────────────────────────────────────────────────────────
  {
    label: 'Subtotal',
    sortFn: inv => n(inv.subtotal),
    colVals: inv => [n(inv.subtotal).toFixed(2)],
    matches: (inv, a) => a.includes(n(inv.subtotal).toFixed(2)),
    alignRight: true,
  },
  {
    label: 'Discount',
    sortFn: inv => n(inv.discountAmount),
    colVals: inv => [n(inv.discountAmount) ? n(inv.discountAmount).toFixed(2) : '—'],
    matches: (inv, a) => a.includes(n(inv.discountAmount) ? n(inv.discountAmount).toFixed(2) : '—'),
    alignRight: true,
  },
  {
    label: 'Disc. Sub',
    sortFn: inv => n(inv.discountedSubtotal),
    colVals: inv => [n(inv.discountedSubtotal).toFixed(2)],
    matches: (inv, a) => a.includes(n(inv.discountedSubtotal).toFixed(2)),
    alignRight: true,
  },
  {
    label: 'Inv CGST',
    sortFn: inv => n(inv.totalCGST),
    colVals: inv => [n(inv.totalCGST) ? n(inv.totalCGST).toFixed(2) : '—'],
    matches: (inv, a) => a.includes(n(inv.totalCGST) ? n(inv.totalCGST).toFixed(2) : '—'),
    alignRight: true,
  },
  {
    label: 'Inv SGST',
    sortFn: inv => n(inv.totalSGST),
    colVals: inv => [n(inv.totalSGST) ? n(inv.totalSGST).toFixed(2) : '—'],
    matches: (inv, a) => a.includes(n(inv.totalSGST) ? n(inv.totalSGST).toFixed(2) : '—'),
    alignRight: true,
  },
  {
    label: 'Inv IGST',
    sortFn: inv => n(inv.totalIGST),
    colVals: inv => [n(inv.totalIGST) ? n(inv.totalIGST).toFixed(2) : '—'],
    matches: (inv, a) => a.includes(n(inv.totalIGST) ? n(inv.totalIGST).toFixed(2) : '—'),
    alignRight: true,
  },
  {
    label: 'Add. Ch.',
    sortFn: inv => n(inv.additionalChargesTotal),
    colVals: inv => [n(inv.additionalChargesTotal) ? n(inv.additionalChargesTotal).toFixed(2) : '—'],
    matches: (inv, a) => a.includes(n(inv.additionalChargesTotal) ? n(inv.additionalChargesTotal).toFixed(2) : '—'),
    alignRight: true,
  },
  {
    label: 'Rnd Off',
    sortFn: inv => n(inv.roundOff),
    colVals: inv => [`${n(inv.roundOff) >= 0 ? '+' : ''}${n(inv.roundOff).toFixed(2)}`],
    matches: (inv, a) => a.includes(`${n(inv.roundOff) >= 0 ? '+' : ''}${n(inv.roundOff).toFixed(2)}`),
    alignRight: true,
  },
  {
    label: 'Grand Total',
    sortFn: inv => n(inv.grandTotal),
    colVals: inv => [n(inv.grandTotal).toFixed(2)],
    matches: (inv, a) => a.includes(n(inv.grandTotal).toFixed(2)),
    alignRight: true,
  },
];

function DetailedInvoiceView({ invoices, onExport }: { invoices: InvoiceDocument[]; onExport: ExportRunner }) {
  const created = useMemo(() => invoices.filter(inv => inv.status !== 'draft'), [invoices]);
  // Persisted across navigation. Popover state stays ephemeral.
  const [search, setSearch] = usePersistentState('invoiceList.detailed.search', '');
  const [fromDate, setFromDate] = usePersistentState('invoiceList.detailed.fromDate', todayISO);
  const [toDate, setToDate] = usePersistentState('invoiceList.detailed.toDate', todayISO);
  const [appliedFrom, setAppliedFrom] = usePersistentState('invoiceList.detailed.appliedFrom', '');
  const [appliedTo, setAppliedTo] = usePersistentState('invoiceList.detailed.appliedTo', '');
  const [colFilters, setColFilters] = usePersistentState<Record<string, string[]>>('invoiceList.detailed.colFilters', {});
  const [filterMenu, setFilterMenu] = useState<{ key: string; pos: { top: number; left: number } } | null>(null);
  const [sortField, setSortField] = usePersistentState<string>('invoiceList.detailed.sortField', 'Date');
  const [sortDir, setSortDir] = usePersistentState<SortDir>('invoiceList.detailed.sortDir', 'desc');
  const [page, setPage] = usePersistentState('invoiceList.detailed.page', 1);
  const [pageSize, setPageSize] = usePersistentState('invoiceList.detailed.pageSize', 10);

  const hasColFilter = Object.keys(colFilters).length > 0;
  const applyDate = () => { setAppliedFrom(fromDate); setAppliedTo(toDate); };
  const clearDate = () => { setFromDate(''); setToDate(''); setAppliedFrom(''); setAppliedTo(''); };
  const clearCf = () => setColFilters({});
  function toggleSort(label: string) { if (sortField === label) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(label); setSortDir('asc'); } }

  function baseFilter(inv: InvoiceDocument): boolean {
    const q = search.trim().toLowerCase();
    if (q && !inv.invoiceNumber.toLowerCase().includes(q) && !inv.clientName.toLowerCase().includes(q) && !inv.companyName.toLowerCase().includes(q)) return false;
    if (appliedFrom && inv.invoiceDate < appliedFrom) return false;
    if (appliedTo && inv.invoiceDate > appliedTo) return false;
    return true;
  }

  const filtered = useMemo(() => {
    return created.filter(inv => {
      if (!baseFilter(inv)) return false;
      for (const [label, vals] of Object.entries(colFilters)) {
        if (!vals.length) continue;
        const col = DET_COLS.find(c => c.label === label);
        if (!col) continue;
        if (!col.matches(inv, vals)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created, search, appliedFrom, appliedTo, colFilters]);

  function getUniqueVals(colLabel: string): string[] {
    const col = DET_COLS.find(c => c.label === colLabel);
    if (!col) return [];
    const vals = new Set<string>();
    created.filter(inv => {
      if (!baseFilter(inv)) return false;
      for (const [k, v] of Object.entries(colFilters)) {
        if (k === colLabel) continue;
        const c = DET_COLS.find(cc => cc.label === k);
        if (!c || !v.length) continue;
        if (!c.matches(inv, v)) return false;
      }
      return true;
    }).forEach(inv => col.colVals(inv).forEach(v => vals.add(v)));
    return [...vals].sort();
  }

  function openFilter(e: React.MouseEvent, label: string) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFilterMenu({ key: label, pos: { top: r.bottom + 4, left: r.left } });
  }

  function applyFilter(label: string, vals: string[] | null) {
    setColFilters(prev => {
      const next = { ...prev };
      if (!vals || !vals.length) delete next[label];
      else next[label] = vals;
      return next;
    });
    setFilterMenu(null);
  }

  const sorted = useMemo(() => {
    const col = DET_COLS.find(c => c.label === sortField);
    if (!col) return [...filtered];
    return [...filtered].sort((a, b) => {
      const va = col.sortFn(a);
      const vb = col.sortFn(b);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  useEffect(() => { setPage(1); }, [search, appliedFrom, appliedTo, colFilters, sortField, sortDir, setPage]);

  const paginatedInvoices = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-violet-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-violet-100 bg-violet-50 flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="w-1 h-5 bg-violet-500 rounded-full" />
        <h2 className="text-sm font-bold text-violet-700 uppercase tracking-widest">Detailed Invoice</h2>
        <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">{created.length} invoices</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-violet-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition w-32 sm:w-44" />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          </div>
          <button onClick={() => void onExport('detailed', () => exportDetailedXlsx(sorted))} disabled={sorted.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition shadow-sm disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export XLSX
          </button>
        </div>
      </div>

      {/* Date filter */}
      <DateFilterStrip fromDate={fromDate} toDate={toDate} onFrom={setFromDate} onTo={setToDate}
        onApply={applyDate} onClear={clearDate} applied={!!(appliedFrom || appliedTo)}
        total={created.length} filtered={sorted.length}
        extraClear={hasColFilter ? (
          <button onClick={clearCf} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition">
            Clear Column Filters
          </button>
        ) : undefined}
      />

      {/* Empty */}
      {created.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-sm font-semibold text-slate-600">No created invoices</p>
          <p className="text-xs text-slate-400 mt-1">Save an invoice to see its line-item details here.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-center">
          <p className="text-sm font-semibold text-slate-600">No matches</p>
          <p className="text-xs text-slate-400 mt-1">Try different filters.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full min-w-275">
              <thead className="sticky top-0 z-10">
                <tr className="bg-violet-50 border-b border-violet-100">
                  {DET_COLS.map((col, i) => (
                    <th key={i} className={`px-3 py-3 whitespace-nowrap ${col.alignRight ? 'text-right' : 'text-left'}`}>
                      <div className={`flex items-center gap-1 text-[10px] font-bold text-violet-700 uppercase tracking-wider ${col.alignRight ? 'justify-end' : ''}`}>
                        <button onClick={() => toggleSort(col.label)} className="flex items-center gap-0.5 cursor-pointer select-none hover:text-violet-900 transition-colors">
                          {col.label}<SortIcon field={col.label} active={sortField} dir={sortDir} color="text-violet-700" />
                        </button>
                        <button onClick={e => openFilter(e, col.label)} className="ml-0.5 p-0.5 rounded hover:bg-violet-100 transition" title={`Filter ${col.label}`}>
                          <FunnelIcon active={!!colFilters[col.label]?.length} />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map((inv, invIdx) => {
                  const s = sym(inv.currency);
                  return inv.lineItems.map((item, itemIdx) => {
                    const isFirst = itemIdx === 0;
                    const isGST = item.tax.startsWith('GST');
                    const halfPct = isGST ? (item.taxRate ?? 0) / 2 : 0;
                    const igstPct = !isGST && item.tax !== 'None' ? (item.taxRate ?? 0) : 0;
                    const taxAmt = +(item.cgstAmount + item.sgstAmount + item.igstAmount).toFixed(2);
                    const alt = invIdx % 2 === 1;
                    const groupTop = isFirst && invIdx > 0 ? 'border-t-2 border-violet-200' : 'border-b border-slate-100';

                    return (
                      <tr key={`${inv._id}-${itemIdx}`} className={`${alt ? 'bg-violet-50/20' : 'bg-white'} ${groupTop}`}>
                        <td className="px-3 py-2.5 text-[11px] font-semibold text-violet-700 whitespace-nowrap">{isFirst ? (inv.invoiceNumber || '—') : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 whitespace-nowrap">{isFirst ? fmtDate(inv.invoiceDate) : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 whitespace-nowrap">{isFirst ? fmtDate(inv.dueDate) : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-800 max-w-25 truncate whitespace-nowrap" title={isFirst ? inv.clientName : ''}>{isFirst ? inv.clientName : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 max-w-22 truncate whitespace-nowrap" title={isFirst ? inv.companyName : ''}>{isFirst ? inv.companyName : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-500 max-w-20 truncate whitespace-nowrap">{isFirst ? (inv.projectName || '—') : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">{isFirst ? inv.currency : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] whitespace-nowrap">
                          {isFirst ? (() => {
                            const c = statusColors(inv.status);
                            return (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
                                <span className={`w-1 h-1 rounded-full ${c.dot}`} />
                                {statusLabel(inv)}
                              </span>
                            );
                          })() : ''}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-400 text-center">{itemIdx + 1}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-800 max-w-32.5 truncate" title={item.description}>{item.description}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-500">{item.hsnCode || '—'}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-500">{item.uom}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-700 text-right">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-700 text-right whitespace-nowrap">{s}{item.unitRate.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 whitespace-nowrap">{item.tax}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 text-right">{item.taxRate ?? 0}%</td>
                        <td className="px-3 py-2.5 text-[11px] font-medium text-gray-800 text-right whitespace-nowrap">{s}{item.taxableAmount.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-500 text-right">{halfPct > 0 ? `${halfPct}%` : '—'}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-700 text-right whitespace-nowrap">{item.cgstAmount > 0 ? `${s}${item.cgstAmount.toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-500 text-right">{halfPct > 0 ? `${halfPct}%` : '—'}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-700 text-right whitespace-nowrap">{item.sgstAmount > 0 ? `${s}${item.sgstAmount.toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-500 text-right">{igstPct > 0 ? `${igstPct}%` : '—'}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-700 text-right whitespace-nowrap">{item.igstAmount > 0 ? `${s}${item.igstAmount.toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2.5 text-[11px] font-semibold text-gray-800 text-right whitespace-nowrap">{taxAmt > 0 ? `${s}${taxAmt.toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2.5 text-[11px] font-semibold text-blue-700 text-right whitespace-nowrap">{s}{item.amount.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 text-right whitespace-nowrap bg-slate-50/60">{isFirst ? `${s}${n(inv.subtotal).toFixed(2)}` : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 text-right whitespace-nowrap bg-slate-50/60">{isFirst && n(inv.discountAmount) ? `${s}${n(inv.discountAmount).toFixed(2)}` : (isFirst ? '—' : '')}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 text-right whitespace-nowrap bg-slate-50/60">{isFirst ? `${s}${n(inv.discountedSubtotal).toFixed(2)}` : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 text-right whitespace-nowrap bg-slate-50/60">{isFirst && n(inv.totalCGST) ? `${s}${n(inv.totalCGST).toFixed(2)}` : (isFirst ? '—' : '')}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 text-right whitespace-nowrap bg-slate-50/60">{isFirst && n(inv.totalSGST) ? `${s}${n(inv.totalSGST).toFixed(2)}` : (isFirst ? '—' : '')}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 text-right whitespace-nowrap bg-slate-50/60">{isFirst && n(inv.totalIGST) ? `${s}${n(inv.totalIGST).toFixed(2)}` : (isFirst ? '—' : '')}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 text-right whitespace-nowrap bg-slate-50/60">{isFirst && n(inv.additionalChargesTotal) ? `${s}${n(inv.additionalChargesTotal).toFixed(2)}` : (isFirst ? '—' : '')}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-600 text-right whitespace-nowrap bg-slate-50/60">{isFirst ? `${n(inv.roundOff) >= 0 ? '+' : ''}${n(inv.roundOff).toFixed(2)}` : ''}</td>
                        <td className="px-3 py-2.5 text-[11px] font-bold text-violet-700 text-right whitespace-nowrap bg-violet-50/40">{isFirst ? `${s}${n(inv.grandTotal).toFixed(2)}` : ''}</td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
          <Pagination total={sorted.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} label="Invoices" theme="violet" />
        </>
      )}

      {/* Excel filter popup */}
      {filterMenu && (
        <ExcelFilterMenu
          allVals={getUniqueVals(filterMenu.key)}
          active={colFilters[filterMenu.key]}
          pos={filterMenu.pos}
          onApply={vals => applyFilter(filterMenu.key, vals)}
          onClose={() => setFilterMenu(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE LIST (main — with sidebar nav)
// ═══════════════════════════════════════════════════════════════════════════════
interface Props { invoices: InvoiceDocument[]; onSelect: (id: string) => void; onDelete: (id: string) => void; }
type View = 'all' | 'detailed';

export default function InvoiceList({ invoices, onSelect, onDelete }: Props) {
  // Persisted so coming back from /invoice/:id lands on the same All/Detailed tab.
  const [view, setView] = usePersistentState<View>('invoiceList.view', 'all');
  // Centralised export loading state — both child views call `runExport` so the
  // Lottie overlay + toast are managed in one place. Workbook generation
  // (string building + buffer encode) blocks the main thread, so showing the
  // overlay gives the user feedback that the click registered.
  const [exporting, setExporting] = useState<null | 'all' | 'detailed'>(null);
  // Separate flag for long-running per-row work (PDF download, attachment
  // view). Shares the same LottieLoader so the user always sees the same
  // overlay regardless of which heavy operation they triggered.
  const [overlayBusy, setOverlayBusy] = useState(false);
  const runExport = useCallback(async (kind: 'all' | 'detailed', work: () => Promise<void>) => {
    setExporting(kind);
    const startedAt = performance.now();
    // Minimum overlay display time. Small exports finish in <100ms which makes
    // the loader flash and feel broken — hold it for at least this long so the
    // animation actually registers as feedback.
    const MIN_VISIBLE_MS = 1000;
    try {
      await notify.promise(work(), {
        loading: 'Generating Excel file…',
        success: 'Excel file downloaded.',
        error: 'Excel export failed.',
      });
    } finally {
      const elapsed = performance.now() - startedAt;
      const remaining = MIN_VISIBLE_MS - elapsed;
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setExporting(null);
    }
  }, []);

  /** Wraps any long-running per-row operation with the shared Lottie overlay.
   *  PDF download and attachment view both call through this so the user gets
   *  consistent visual feedback. The caller is responsible for the toast. */
  const runOverlay = useCallback(async (work: () => Promise<void>) => {
    setOverlayBusy(true);
    const startedAt = performance.now();
    const MIN_VISIBLE_MS = 1000;
    try {
      await work();
    } finally {
      const elapsed = performance.now() - startedAt;
      const remaining = MIN_VISIBLE_MS - elapsed;
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setOverlayBusy(false);
    }
  }, []);

  const navItems: { id: View; label: string; icon: React.ReactNode; count: number; theme: string }[] = [
    {
      id: 'all', label: 'All Invoices', count: invoices.length, theme: 'blue',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
      id: 'detailed', label: 'Detailed Invoice', count: invoices.filter(i => i.status !== 'draft').length, theme: 'violet',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-3 md:gap-5 items-stretch md:items-start">
      {/* ── Sidebar nav — full-width pill bar on mobile, vertical sidebar on tablet+ ── */}
      <aside className="w-full md:w-48 md:shrink-0 md:sticky md:top-18" data-tour="views-nav">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="hidden md:block px-4 py-3 border-b border-blue-100 bg-blue-50">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">Invoice Views</span>
          </div>
          <nav className="p-2 flex flex-row md:flex-col gap-1 md:gap-1 md:space-y-1">
            {navItems.map(({ id, label, icon, count, theme }) => {
              const active = view === id;
              const styles = {
                blue: active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700',
                violet: active
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700',
              }[theme];
              const countStyle = active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500';
              return (
                <button key={id} onClick={() => setView(id)}
                  className={`flex-1 md:flex-none w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${styles}`}>
                  {icon}
                  <span className="flex-1 text-left leading-tight text-[12px]">{label}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${countStyle}`}>{count}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 w-full">
        {view === 'all'
          ? <AllInvoicesView invoices={invoices} onSelect={onSelect} onDelete={onDelete} onExport={runExport} onOverlay={runOverlay} />
          : <DetailedInvoiceView invoices={invoices} onExport={runExport} />}
      </div>

      <LottieLoader open={exporting !== null || overlayBusy} variant="common" />
    </div>
  );
}
