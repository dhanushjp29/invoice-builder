import type { InvoiceDocument } from '../types/invoice';
import { TAX_RATES } from '../types/invoice';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeIsIntraState(inv: InvoiceDocument): boolean {
  const companyState = inv.companyLocation?.state?.trim() ?? '';
  const billingState = inv.clientLocation?.state?.trim() ?? '';
  if (!companyState || !billingState) return true;
  return companyState === billingState;
}

function computeIsExport(inv: InvoiceDocument): boolean {
  const companyCountry = inv.companyLocation?.country?.trim().toUpperCase() ?? '';
  const billingCountry = inv.clientLocation?.country?.trim().toUpperCase() ?? '';
  if (companyCountry !== 'IN') return false;
  if (!billingCountry) return false;
  return companyCountry !== billingCountry;
}

export function recalculate(inv: InvoiceDocument): InvoiceDocument {
  const isExport = computeIsExport(inv);
  const isIntraState = !isExport && computeIsIntraState(inv);

  const subtotal = round2(inv.lineItems.reduce((s, i) => s + (i.quantity || 0) * (i.unitRate || 0), 0));

  const discountType = inv.discountType ?? 'percentage';
  const discountValue = Math.max(0, inv.discountValue ?? 0);
  const rawDiscount = discountType === 'percentage'
    ? round2(subtotal * discountValue / 100)
    : round2(discountValue);
  const discountAmount = Math.min(rawDiscount, subtotal);
  const discountedSubtotal = round2(subtotal - discountAmount);

  const lineItems = inv.lineItems.map((item) => {
    const rawTaxable = round2((item.quantity || 0) * (item.unitRate || 0));
    const weight = subtotal > 0 ? rawTaxable / subtotal : 0;
    const taxableAmount = round2(rawTaxable - discountAmount * weight);

    const rate = isExport ? 0 : (item.taxRate ?? TAX_RATES[item.tax] ?? 0);
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (!isExport) {
      if (isIntraState) {
        const half = rate / 2;
        cgstAmount = round2((taxableAmount * half) / 100);
        sgstAmount = round2((taxableAmount * half) / 100);
      } else {
        igstAmount = round2((taxableAmount * rate) / 100);
      }
    }

    const amount = round2(taxableAmount + cgstAmount + sgstAmount + igstAmount);
    return { ...item, taxableAmount, cgstAmount, sgstAmount, igstAmount, amount };
  });

  const totalCGST = round2(lineItems.reduce((s, i) => s + i.cgstAmount, 0));
  const totalSGST = round2(lineItems.reduce((s, i) => s + i.sgstAmount, 0));
  const totalIGST = round2(lineItems.reduce((s, i) => s + i.igstAmount, 0));
  const taxAmount = round2(totalCGST + totalSGST + totalIGST);

  const additionalChargesTotal = round2(inv.additionalCharges.reduce((s, c) => s + (c.amount || 0), 0));

  const grandTotal = round2(
    discountedSubtotal + totalCGST + totalSGST + totalIGST + additionalChargesTotal + (inv.roundOff || 0)
  );

  return {
    ...inv,
    lineItems,
    isIntraState,
    isExport,
    subtotal,
    discountAmount,
    discountedSubtotal,
    totalCGST,
    totalSGST,
    totalIGST,
    taxAmount,
    additionalChargesTotal,
    grandTotal,
  };
}
