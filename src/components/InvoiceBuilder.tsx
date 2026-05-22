import { useCallback, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { createBlankInvoice, createLineItem, findAll, insertOne, updateOne } from '../db/invoiceDB';
import type { AdditionalCharge, InvoiceDocument, LineItem, PaymentMethod } from '../types/invoice';
import { CURRENCY_OPTIONS, TAX_RATES } from '../types/invoice';
import AdditionalCharges from './AdditionalCharges';
import ClientInfo from './ClientInfo';
import FileAttachments from './FileAttachments';
import InvoiceHeader from './InvoiceHeader';
import InvoicePrintView from './InvoicePrintView';
import InvoiceTotals from './InvoiceTotals';
import LineItemsTable from './LineItemsTable';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Intra-state ↔ inter-state decision is driven by BILLING address state only.
// (Delivery address is intentionally ignored per GST rules.)
function computeIsIntraState(inv: InvoiceDocument): boolean {
  const companyState = inv.companyLocation?.state?.trim() ?? '';
  const billingState = inv.clientLocation?.state?.trim() ?? '';
  if (!companyState || !billingState) return true;
  return companyState === billingState;
}

// Foreign buyer? Country mismatch between company and billing address.
// When true, the invoice is treated as an export — zero GST.
function computeIsExport(inv: InvoiceDocument): boolean {
  const companyCountry = inv.companyLocation?.country?.trim() ?? '';
  const billingCountry = inv.clientLocation?.country?.trim() ?? '';
  if (!companyCountry || !billingCountry) return false;
  return companyCountry !== billingCountry;
}

function recalculate(inv: InvoiceDocument): InvoiceDocument {
  const isExport = computeIsExport(inv);
  const isIntraState = !isExport && computeIsIntraState(inv);

  // Raw subtotal (sum of qty × rate per line item, before discount)
  const subtotal = round2(inv.lineItems.reduce((s, i) => s + (i.quantity || 0) * (i.unitRate || 0), 0));

  // Discount applied on subtotal, before GST
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

export default function InvoiceBuilder() {
  const [invoice, setInvoice] = useState<InvoiceDocument>(() => {
    const blank = createBlankInvoice();
    const defaults = { ...blank, _id: '', createdAt: '', updatedAt: '' };
    const saved = findAll();
    const initial = saved.length > 0 ? { ...defaults, ...saved[saved.length - 1] } : defaults;
    // Recompute GST split for legacy saved invoices that lack the new derived fields
    return recalculate(initial);
  });

  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const currencyInfo = CURRENCY_OPTIONS.find((c) => c.code === invoice.currency) ?? CURRENCY_OPTIONS[0];

  // Generic top-level field updater
  const updateField = useCallback(
    <K extends keyof InvoiceDocument>(field: K, value: InvoiceDocument[K]) => {
      setInvoice((prev) => recalculate({ ...prev, [field]: value }));
    },
    []
  );

  // Line item handlers
  const handleAddItem = useCallback(() => {
    setInvoice((prev) =>
      recalculate({ ...prev, lineItems: [...prev.lineItems, createLineItem()] })
    );
  }, []);

  const handleUpdateItem = useCallback(
    (id: string, field: keyof Omit<LineItem, '_id' | 'amount'>, value: string | number) => {
      setInvoice((prev) => {
        const items = prev.lineItems.map((item) =>
          item._id === id ? { ...item, [field]: value } : item
        );
        return recalculate({ ...prev, lineItems: items });
      });
    },
    []
  );

  const handleDeleteItem = useCallback((id: string) => {
    setInvoice((prev) => {
      if (prev.lineItems.length === 1) return prev;
      return recalculate({ ...prev, lineItems: prev.lineItems.filter((i) => i._id !== id) });
    });
  }, []);

  // Additional charges
  const handleChargesChange = useCallback((charges: AdditionalCharge[]) => {
    setInvoice((prev) => recalculate({ ...prev, additionalCharges: charges }));
  }, []);

  // Round off
  const handleRoundOffChange = useCallback((roundOff: number) => {
    setInvoice((prev) => recalculate({ ...prev, roundOff }));
  }, []);

  // Save to localStorage
  const handleSave = async () => {
    setSaving(true);
    try {
      let saved: InvoiceDocument | null = null;
      if (invoice._id) {
        saved = updateOne(invoice._id, invoice);
      } else {
        saved = insertOne(invoice);
      }
      if (saved) {
        setInvoice(saved);
        toast.success('Invoice saved to local storage!');
      } else {
        toast.error('Save failed. Try again.');
      }
    } catch {
      toast.error('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // PDF export via html2pdf.js
  const handleExportPDF = async () => {
    setExporting(true);
    setShowPreview(true);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('invoice-print-area');
      if (!element) return;
      await html2pdf()
        .set({
          margin: 0,
          filename: `${invoice.invoiceNumber || 'invoice'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(element)
        .save();
      toast.success('PDF exported successfully!');
    } catch {
      toast.error('PDF export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    setShowPreview(true);
    setTimeout(() => window.print(), 400);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* react-hot-toast — top-right, RTL word direction */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2500,
          style: { direction: 'rtl', fontFamily: 'inherit' },
          success: { style: { background: '#22c55e', color: '#fff' } },
          error: { style: { background: '#ef4444', color: '#fff' } },
        }}
      />

      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-slate-800 font-bold text-base leading-none">Invoice Builder</h1>
              <p className="text-slate-400 text-xs mt-0.5">Professional Invoicing</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {showPreview ? 'Edit' : 'Preview'}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>

            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-600 hover:bg-slate-100 transition disabled:opacity-60"
            >
              {exporting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60 shadow-sm"
            >
              {saving ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {showPreview ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between print:hidden">
              <span className="text-sm font-semibold text-blue-700">Invoice Preview</span>
              <button
                onClick={() => setShowPreview(false)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
              >
                ← Back to Editor
              </button>
            </div>
            <InvoicePrintView invoice={invoice} currencySymbol={currencyInfo.symbol} />
          </div>
        ) : (
          <>
            <InvoiceHeader
              invoice={invoice}
              onChange={(field, value) => updateField(field, value as never)}
            />
            <ClientInfo
              invoice={invoice}
              onChange={(field, value) => updateField(field, value as never)}
            />
            <LineItemsTable
              items={invoice.lineItems}
              currencySymbol={currencyInfo.symbol}
              isExport={invoice.isExport}
              onAdd={handleAddItem}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
            <AdditionalCharges
              charges={invoice.additionalCharges}
              currency={currencyInfo.symbol}
              onChange={handleChargesChange}
            />
            <InvoiceTotals
              subtotal={invoice.subtotal}
              discountType={invoice.discountType ?? 'percentage'}
              discountValue={invoice.discountValue ?? 0}
              discountAmount={invoice.discountAmount ?? 0}
              discountedSubtotal={invoice.discountedSubtotal ?? invoice.subtotal}
              isIntraState={invoice.isIntraState}
              isExport={invoice.isExport}
              totalCGST={invoice.totalCGST}
              totalSGST={invoice.totalSGST}
              totalIGST={invoice.totalIGST}
              additionalChargesTotal={invoice.additionalChargesTotal}
              roundOff={invoice.roundOff}
              grandTotal={invoice.grandTotal}
              notes={invoice.notes}
              termsAndConditions={invoice.termsAndConditions}
              paymentMethod={invoice.paymentMethod}
              currencySymbol={currencyInfo.symbol}
              currencyCode={currencyInfo.code}
              onDiscountTypeChange={(type) => updateField('discountType', type)}
              onDiscountValueChange={(value) => updateField('discountValue', value)}
              onRoundOffChange={handleRoundOffChange}
              onNotesChange={(notes) => updateField('notes', notes)}
              onTermsChange={(terms) => updateField('termsAndConditions', terms)}
              onPaymentMethodChange={(method) => updateField('paymentMethod', method as PaymentMethod | '')}
            />
            <FileAttachments
              attachments={invoice.attachments ?? []}
              onChange={(attachments) => updateField('attachments', attachments)}
            />
          </>
        )}
      </main>

      <div className="hidden print:block">
        <InvoicePrintView invoice={invoice} currencySymbol={currencyInfo.symbol} />
      </div>
    </div>
  );
}
