import { useCallback, useEffect, useState } from 'react';
import { useNavigate as useRouterNavigate, useLocation } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { createBlankInvoice, createLineItem, deleteOne, findAll, findOne, generateInvoiceNumber, insertOne, updateOne } from '../db/invoiceDB';
import type { AdditionalCharge, InvoiceDocument, LineItem, PaymentMethod } from '../types/invoice';
import { CURRENCY_OPTIONS } from '../types/invoice';
import { recalculate } from '../utils/recalculate';
import { downloadPdf, printAsPdf } from '../utils/pdfExport';
import AdditionalCharges from './AdditionalCharges';
import ClientInfo from './ClientInfo';
import FileAttachments from './FileAttachments';
import InvoiceHeader from './InvoiceHeader';
import InvoiceList from './InvoiceList';
import InvoicePrintView from './InvoicePrintView';
import InvoiceSidebar from './InvoiceSidebar';
import InvoiceTotals from './InvoiceTotals';
import LineItemsTable from './LineItemsTable';
import NavGuardModal from './NavGuardModal';
import PreviewBar from './PreviewBar';

const initialIdFromUrl = window.location.pathname.match(/^\/invoice\/([^/]+?)(?:\/preview)?$/)?.[1] ?? null;

export default function InvoiceBuilder() {
  const routerNavigate = useRouterNavigate();
  const location = useLocation();
  const isListMode = location.pathname === '/';
  const isPreviewMode = /\/preview$/.test(location.pathname);

  const [invoice, setInvoice] = useState<InvoiceDocument>(() => {
    const idFromUrl = initialIdFromUrl;
    if (idFromUrl && idFromUrl !== 'new') {
      const found = findOne(idFromUrl);
      if (found) {
        const loaded = found.status === 'draft'
          ? { ...found, invoiceNumber: generateInvoiceNumber() }
          : found;
        return recalculate(loaded);
      }
    }
    const blank = createBlankInvoice();
    return recalculate({ ...blank, _id: '', createdAt: '', updatedAt: '' });
  });

  const [allInvoices, setAllInvoices] = useState<InvoiceDocument[]>(() => findAll());
  // isDirty: true whenever the user has modified the current invoice since last save/load
  const [isDirty, setIsDirty] = useState(false);
  // When navigation is blocked by unsaved changes, store the target invoice id here
  const [pendingNavId, setPendingNavId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);
  // Field-level validation errors. Keys: 'companyName', 'companyAddress', 'companyCountry',
  // 'clientName', 'clientAddress', 'clientCountry', 'invoiceNumber', 'invoiceDate'.
  // Line-item issues are reported via toast only (not per-field).
  const [errors, setErrors] = useState<Set<string>>(new Set());

  // Map a top-level invoice field to the error keys it should clear when edited.
  function errorKeysFor(field: keyof InvoiceDocument, value: unknown): string[] {
    switch (field) {
      case 'companyName': return ['companyName'];
      case 'companyAddress': return ['companyAddress'];
      case 'companyLocation': {
        const loc = value as { country?: string; state?: string; city?: string; pincode?: string } | undefined;
        const out: string[] = [];
        if (loc?.country?.trim()) out.push('companyCountry');
        if (loc?.state?.trim()) out.push('companyState');
        if (loc?.city?.trim()) out.push('companyCity');
        if (loc?.pincode?.trim()) out.push('companyPincode');
        return out;
      }
      case 'clientName': return ['clientName'];
      case 'clientAddress': return ['clientAddress'];
      case 'clientLocation': {
        const loc = value as { country?: string; state?: string; city?: string; pincode?: string } | undefined;
        const out: string[] = [];
        if (loc?.country?.trim()) out.push('clientCountry');
        if (loc?.state?.trim()) out.push('clientState');
        if (loc?.city?.trim()) out.push('clientCity');
        if (loc?.pincode?.trim()) out.push('clientPincode');
        return out;
      }
      case 'invoiceNumber': return ['invoiceNumber'];
      case 'invoiceDate': return ['invoiceDate'];
      case 'paymentMethod': return ['paymentMethod'];
      case 'termsAndConditions': return ['termsAndConditions'];
      default: return [];
    }
  }

  function clearErrors(keys: string[]) {
    if (!keys.length) return;
    setErrors((prev) => {
      if (!keys.some((k) => prev.has(k))) return prev;
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
  }

  const currencyInfo = CURRENCY_OPTIONS.find((c) => c.code === invoice.currency) ?? CURRENCY_OPTIONS[0];

  // Generic top-level field updater. Also clears any validation error for that field.
  const updateField = useCallback(
    <K extends keyof InvoiceDocument>(field: K, value: InvoiceDocument[K]) => {
      setInvoice((prev) => recalculate({ ...prev, [field]: value }));
      clearErrors(errorKeysFor(field, value));
      setIsDirty(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Line item handlers
  const handleAddItem = useCallback(() => {
    setInvoice((prev) =>
      recalculate({ ...prev, lineItems: [...prev.lineItems, createLineItem()] })
    );
    setIsDirty(true);
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

  // Resolve a duplicate-description row: sum its quantity into the OTHER row that
  // shares the same description (case-insensitive), then delete the current row.
  const handleMergeDuplicateItem = useCallback((id: string) => {
    setInvoice((prev) => {
      const current = prev.lineItems.find((i) => i._id === id);
      if (!current) return prev;
      const key = current.description.trim().toLowerCase();
      if (!key) return prev;
      const target = prev.lineItems.find((i) => i._id !== id && i.description.trim().toLowerCase() === key);
      if (!target) return prev;
      const nextItems = prev.lineItems
        .map((i) => i._id === target._id ? { ...i, quantity: (i.quantity || 0) + (current.quantity || 0) } : i)
        .filter((i) => i._id !== id);
      toast.success(`Merged into existing "${target.description}".`);
      return recalculate({ ...prev, lineItems: nextItems });
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

  // List-view navigation
  const handleNew = () => {
    const blank = createBlankInvoice();
    setInvoice(recalculate({ ...blank, _id: '', createdAt: '', updatedAt: '' }));
    setErrors(new Set());
    setIsDirty(false);
    routerNavigate('/invoice/new');
  };

  const handleSelectInvoice = (id: string) => {
    const found = findOne(id);
    if (!found) return;
    const loaded = found.status === 'draft'
      ? { ...found, invoiceNumber: generateInvoiceNumber() }
      : found;
    setInvoice(recalculate(loaded));
    setErrors(new Set());
    setIsDirty(false);
    // Stay in preview mode if currently previewing, but only for saved invoices
    const stayPreview = isPreviewMode && found.status === 'saved';
    routerNavigate(stayPreview ? `/invoice/${id}/preview` : `/invoice/${id}`);
  };

  // Guard helper: pendingNavId is either an invoice _id OR the sentinel '__list__'
  const doNav = (target: string) => {
    if (target === '__list__') { routerNavigate('/'); return; }
    handleSelectInvoice(target);
  };

  // Called by sidebar item click — guards if dirty
  const handleSidebarClick = (id: string) => {
    if (isDirty && invoice._id !== id) setPendingNavId(id);
    else handleSelectInvoice(id);
  };

  // Called by "← All Invoices" nav button — guards if dirty
  const handleBackToList = () => {
    if (isDirty) setPendingNavId('__list__');
    else routerNavigate('/');
  };

  // ── Nav-guard modal actions ──

  // Save as Draft then navigate (available for new + draft invoices only)
  const handleSaveAsDraft = () => {
    const draftDoc = { ...invoice, status: 'draft' as const };
    const saved = draftDoc._id
      ? updateOne(draftDoc._id, draftDoc)
      : insertOne(draftDoc);
    if (saved) {
      setAllInvoices(findAll());
      toast.success('Saved as draft.');
    }
    const target = pendingNavId!;
    setPendingNavId(null);
    setIsDirty(false);
    doNav(target);
  };

  // Full save (validated) then navigate
  const handleSaveAndNavigate = () => {
    if (!validate()) return; // keep modal open, errors highlighted
    const docToSave = { ...invoice, status: 'saved' as const };
    const saved = docToSave._id
      ? updateOne(docToSave._id, docToSave)
      : insertOne(docToSave);
    if (!saved) { toast.error('Save failed.'); return; }
    setAllInvoices(findAll());
    setIsDirty(false);
    toast.success('Invoice saved!');
    const target = pendingNavId!;
    setPendingNavId(null);
    doNav(target);
  };

  // Don't Save — for new (no _id) invoices: delete the unsaved work; for draft/saved: just navigate away without saving
  const handleDiscardAndNavigate = () => {
    if (!invoice._id) {
      // truly new invoice that was never persisted — nothing to delete
    }
    const target = pendingNavId!;
    setPendingNavId(null);
    setIsDirty(false);
    doNav(target);
  };

  const handleCancelNav = () => setPendingNavId(null);

  const handleDeleteInvoice = (id: string) => {
    deleteOne(id);
    setAllInvoices(findAll());
  };

  // Validate all mandatory fields. Returns true if OK; otherwise sets errors and toasts.
  const validate = (): boolean => {
    const found = new Set<string>();
    const missingLabels: string[] = [];
    if (!invoice.companyName.trim()) { found.add('companyName'); missingLabels.push('Company Name'); }
    if (!invoice.companyAddress.trim()) { found.add('companyAddress'); missingLabels.push('Company Address'); }
    if (!invoice.companyLocation?.country?.trim()) { found.add('companyCountry'); missingLabels.push('Company Country'); }
    if (!invoice.companyLocation?.state?.trim()) { found.add('companyState'); missingLabels.push('Company State'); }
    if (!invoice.companyLocation?.city?.trim()) { found.add('companyCity'); missingLabels.push('Company City'); }
    if (!invoice.companyLocation?.pincode?.trim()) { found.add('companyPincode'); missingLabels.push('Company Pincode'); }
    if (!invoice.clientName.trim()) { found.add('clientName'); missingLabels.push('Client Name'); }
    if (!invoice.clientAddress.trim()) { found.add('clientAddress'); missingLabels.push('Billing Address'); }
    if (!invoice.clientLocation?.country?.trim()) { found.add('clientCountry'); missingLabels.push('Client Country'); }
    if (!invoice.clientLocation?.state?.trim()) { found.add('clientState'); missingLabels.push('Client State'); }
    if (!invoice.clientLocation?.city?.trim()) { found.add('clientCity'); missingLabels.push('Client City'); }
    if (!invoice.clientLocation?.pincode?.trim()) { found.add('clientPincode'); missingLabels.push('Client Pincode'); }
    if (!invoice.invoiceNumber.trim()) { found.add('invoiceNumber'); missingLabels.push('Invoice Number'); }
    if (!invoice.invoiceDate.trim()) { found.add('invoiceDate'); missingLabels.push('Invoice Date'); }
    if (!invoice.paymentMethod.trim()) { found.add('paymentMethod'); missingLabels.push('Payment Method'); }
    if (!invoice.termsAndConditions.trim()) { found.add('termsAndConditions'); missingLabels.push('Terms & Conditions'); }

    // Line-item sanity: every item needs description, qty > 0, rate > 0, UOM. Tax is OPTIONAL.
    const badItems: number[] = [];
    invoice.lineItems.forEach((it, idx) => {
      const ok = it.description.trim() && (it.quantity || 0) > 0 && (it.unitRate || 0) > 0 && it.uom.trim();
      if (!ok) badItems.push(idx + 1);
    });
    if (badItems.length) {
      missingLabels.push(`Line item${badItems.length > 1 ? 's' : ''} #${badItems.join(', #')} (description, qty, rate, UOM)`);
    }

    setErrors(found);
    if (missingLabels.length === 0) return true;
    const preview = missingLabels.slice(0, 4).join(', ');
    const more = missingLabels.length > 4 ? ` +${missingLabels.length - 4} more` : '';
    toast.error(`Please fill required fields: ${preview}${more}`);
    return false;
  };

  // Save to localStorage
  const handleSave = async () => {
    if (!validate()) return;
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
        setAllInvoices(findAll());
        setIsDirty(false);
        toast.success('Invoice saved!');
      } else {
        toast.error('Save failed. Try again.');
      }
    } catch {
      toast.error('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const pdfFilename = `${invoice.invoiceNumber || 'invoice'}.pdf`;

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      await downloadPdf(pdfFilename);
      toast.success('PDF exported successfully!');
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('PDF export failed.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printAsPdf(pdfFilename);
    } catch (err) {
      console.error('Print failed:', err);
      toast.error('Could not generate PDF. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  // Mail — open user's default mail client with prefilled subject/body
  const handleMail = () => {
    if (!invoice._id) {
      toast.error('Save the invoice before sending.');
      return;
    }
    window.open(`/invoice/${invoice._id}/mail`, '_blank');
  };

  // Ctrl+P / Cmd+P — print as PDF if saved, toast if not
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (invoice.status === 'saved' && invoice._id) {
          handlePrint();
        } else {
          toast.error('Save the invoice before printing.');
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.status, invoice._id]);

  const handlePreviewToggle = () => {
    const id = invoice._id || 'new';
    if (isPreviewMode) {
      routerNavigate(`/invoice/${id}`);
    } else {
      if (!validate()) return;
      routerNavigate(`/invoice/${id}/preview`);
    }
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
            {!isListMode && (
              <button
                onClick={handleBackToList}
                className="flex items-center gap-1 ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                All Invoices
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isListMode && (
              <button
                onClick={handleNew}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                New Invoice
              </button>
            )}
            {!isListMode && (<>
            <button
              onClick={handlePreviewToggle}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {isPreviewMode ? 'Edit' : 'Preview'}
            </button>
            {!isPreviewMode && (
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
            )}
            </>)}
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 sm:px-6 py-6 ${isListMode ? 'max-w-[1480px]' : 'max-w-7xl'}`}>
        {isListMode ? (
          <InvoiceList
            invoices={allInvoices}
            onSelect={handleSelectInvoice}
            onDelete={handleDeleteInvoice}
          />
        ) : (
          <div className="flex gap-4 items-start">

            <InvoiceSidebar
              invoices={allInvoices}
              activeId={invoice._id}
              onSelect={handleSidebarClick}
              onNew={handleNew}
            />

            {/* ── Right panel: editor or preview ── */}
            <div className="flex-1 min-w-0">
              {isPreviewMode ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <PreviewBar
                    invoiceId={invoice._id || 'new'}
                    exportingPdf={exportingPdf}
                    printing={printing}
                    onMail={handleMail}
                    onPrint={handlePrint}
                    onExportPDF={handleExportPDF}
                    onBackToEditor={() => routerNavigate(`/invoice/${invoice._id || 'new'}`)}
                  />
                  <InvoicePrintView invoice={invoice} currencySymbol={currencyInfo.symbol} />
                </div>
              ) : (
                <>
                  <InvoiceHeader
                    invoice={invoice}
                    errors={errors}
                    onChange={(field, value) => updateField(field, value as never)}
                  />
                  <ClientInfo
                    invoice={invoice}
                    errors={errors}
                    onChange={(field, value) => updateField(field, value as never)}
                  />
                  <LineItemsTable
                    items={invoice.lineItems}
                    currencySymbol={currencyInfo.symbol}
                    isExport={invoice.isExport}
                    onAdd={handleAddItem}
                    onUpdate={handleUpdateItem}
                    onDelete={handleDeleteItem}
                    onMergeDuplicate={handleMergeDuplicateItem}
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
                    isIndianSeller={(invoice.companyLocation?.country ?? '').trim().toUpperCase() === 'IN'}
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
                    errors={errors}
                  />
                  <FileAttachments
                    attachments={invoice.attachments ?? []}
                    onChange={(attachments) => updateField('attachments', attachments)}
                  />
                </>
              )}
            </div>

          </div>
        )}
      </main>

      <div className="hidden print:block">
        <InvoicePrintView invoice={invoice} currencySymbol={currencyInfo.symbol} />
      </div>

      {pendingNavId !== null && (
        <NavGuardModal
          invoiceCase={!invoice._id ? 'new' : invoice.status === 'draft' ? 'draft' : 'saved'}
          onSaveAsDraft={handleSaveAsDraft}
          onSave={handleSaveAndNavigate}
          onDontSave={handleDiscardAndNavigate}
          onCancel={handleCancelNav}
        />
      )}
    </div>
  );
}
