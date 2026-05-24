import type { InvoiceDocument } from '../types/invoice';

export type InvoiceStatus = InvoiceDocument['status'];

/** Human-readable badge text, including the cycle counter when ≥ 2. */
export function statusLabel(inv: Pick<InvoiceDocument, 'status' | 'cycleCount'>): string {
  const c = inv.cycleCount ?? 0;
  switch (inv.status) {
    case 'draft':     return 'Draft';
    case 'saved':     return 'Created';
    case 'mail-sent': return c >= 2 ? `Mail Sent (${c})` : 'Mail Sent';
    case 'modified':  return c >= 2 ? `Modified (${c})` : 'Modified';
  }
}

/** Tailwind colour token bundle for each status, used by the list table,
 *  sidebar pill, and any future badges. Centralised so the palette can be
 *  tweaked in one place. */
export function statusColors(status: InvoiceStatus): { bg: string; text: string; border: string; dot: string } {
  switch (status) {
    case 'draft':     return { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400' };
    case 'mail-sent': return { bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500' };
    case 'modified':  return { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500' };
    case 'saved':
    default:          return { bg: 'bg-green-50',    text: 'text-green-700',   border: 'border-green-200',   dot: 'bg-green-500' };
  }
}
