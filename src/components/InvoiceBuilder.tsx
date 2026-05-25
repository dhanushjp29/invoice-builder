import { useCallback, useEffect, useState } from 'react';
import { useNavigate as useRouterNavigate, useLocation } from 'react-router-dom';
import { notify } from '../utils/notify';
import { createBlankInvoice, createLineItem, deleteOne, findAll, findOne, insertOne, invoiceNumberExists, reconcileDraftNumber, updateOne } from '../db/invoiceDB';
import type { AdditionalCharge, InvoiceDocument, LineItem, PaymentMethod } from '../types/invoice';
import { CURRENCY_OPTIONS } from '../types/invoice';
import { recalculate } from '../utils/recalculate';
import { downloadPdf, printAsPdf } from '../utils/pdfExport';
import AccountDetails from './AccountDetails';
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

function parseIdFromPath(path: string): string | null {
  return path.match(/^\/invoice\/([^/]+?)(?:\/preview)?$/)?.[1] ?? null;
}

export default function InvoiceBuilder() {
  const routerNavigate = useRouterNavigate();
  const location = useLocation();
  const isListMode = location.pathname === '/';
  const isPreviewMode = /\/preview$/.test(location.pathname);

  const [invoice, setInvoiceRaw] = useState<InvoiceDocument>(() => {
    // Read the id from the *current* URL each time we mount. We used to read
    // a module-level snapshot, which meant returning here from /mail still
    // showed whatever was open at app start instead of the requested invoice.
    const idFromUrl = parseIdFromPath(window.location.pathname);
    if (idFromUrl && idFromUrl !== 'new') {
      const found = findOne(idFromUrl);
      if (found) {
        return recalculate(reconcileDraftNumber(found));
      }
    }
    const blank = createBlankInvoice();
    return recalculate({ ...blank, _id: '', createdAt: '', updatedAt: '' });
  });

  const [allInvoices, setAllInvoices] = useState<InvoiceDocument[]>(() => findAll());

  // autoSeed runs asynchronously on app boot — if the list mounts before it
  // finishes writing, the user sees an empty list. autoSeed fires
  // 'invoiceDB:seeded' when done; reload the snapshot then.
  useEffect(() => {
    const refresh = () => {
      setAllInvoices(findAll());
      // If the currently-loaded invoice changed under us (e.g. seeder finished,
      // or a draft we have open just got auto-renumbered), refresh its state.
      const idFromUrl = parseIdFromPath(window.location.pathname);
      if (idFromUrl && idFromUrl !== 'new') {
        const found = findOne(idFromUrl);
        if (found) setInvoiceRaw(recalculate(found));
      }
    };
    window.addEventListener('invoiceDB:seeded', refresh);
    window.addEventListener('invoiceDB:changed', refresh);
    return () => {
      window.removeEventListener('invoiceDB:seeded', refresh);
      window.removeEventListener('invoiceDB:changed', refresh);
    };
  }, []);
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
      case 'deliveryAddress': return ['deliveryAddress'];
      case 'deliveryLocation': {
        const loc = value as { country?: string; state?: string; city?: string; pincode?: string } | undefined;
        const out: string[] = [];
        if (loc?.country?.trim()) out.push('deliveryCountry');
        if (loc?.state?.trim()) out.push('deliveryState');
        if (loc?.city?.trim()) out.push('deliveryCity');
        return out;
      }
      case 'deliverySameAsBilling': return ['deliveryAddress', 'deliveryCountry', 'deliveryState', 'deliveryCity'];
      case 'invoiceNumber': return ['invoiceNumber'];
      case 'invoiceDate': return ['invoiceDate'];
      case 'paymentMethod': return ['paymentMethod'];
      case 'termsAndConditions': return ['termsAndConditions'];
      case 'accountDetails': {
        const ad = value as { accountHolderName?: string; bankName?: string; accountNumber?: string; ifscCode?: string } | undefined;
        const out: string[] = [];
        if (ad?.accountHolderName?.trim()) out.push('accountHolderName');
        if (ad?.bankName?.trim())          out.push('bankName');
        if (ad?.accountNumber?.trim())     out.push('accountNumber');
        if (ad?.ifscCode?.trim())          out.push('ifscCode');
        return out;
      }
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

  /**
   * Wrapped state setter for edits. If the invoice's previous status was
   * 'mail-sent', flip it to 'modified' so the badge updates the moment the
   * user touches a field. Loaders (handleSelectInvoice, handleNew) call
   * setInvoiceRaw directly to skip this transition.
   */
  const setInvoice = useCallback((updater: (prev: InvoiceDocument) => InvoiceDocument) => {
    setInvoiceRaw((prev) => {
      const next = updater(prev);
      if (prev.status === 'mail-sent' && next === prev) return next;
      if (prev.status === 'mail-sent') {
        return { ...next, status: 'modified' };
      }
      return next;
    });
  }, []);

  // Generic top-level field updater. Also clears any validation error for that field.
  const updateField = useCallback(
    <K extends keyof InvoiceDocument>(field: K, value: InvoiceDocument[K]) => {
      setInvoice((prev) => recalculate({ ...prev, [field]: value }));
      clearErrors(errorKeysFor(field, value));
      setIsDirty(true);
    },
    [setInvoice]
  );

  // Line item handlers
  const handleAddItem = useCallback(() => {
    setInvoice((prev) =>
      recalculate({ ...prev, lineItems: [...prev.lineItems, createLineItem()] })
    );
    setIsDirty(true);
  }, [setInvoice]);

  const handleUpdateItem = useCallback(
    (id: string, field: keyof Omit<LineItem, '_id' | 'amount'>, value: string | number) => {
      setInvoice((prev) => {
        const items = prev.lineItems.map((item) =>
          item._id === id ? { ...item, [field]: value } : item
        );
        return recalculate({ ...prev, lineItems: items });
      });
    },
    [setInvoice]
  );

  const handleDeleteItem = useCallback((id: string) => {
    setInvoice((prev) => {
      if (prev.lineItems.length === 1) return prev;
      return recalculate({ ...prev, lineItems: prev.lineItems.filter((i) => i._id !== id) });
    });
  }, [setInvoice]);

  // Resolve a duplicate-description row: sum its quantity into the OTHER row that
  // shares the same description (case-insensitive), then delete the current row.
  // The toast must live OUTSIDE the setInvoice updater because React's Strict
  // Mode runs updaters twice in dev for purity checks — a notify.success()
  // inside the updater would fire the toast twice.
  const handleMergeDuplicateItem = useCallback((id: string) => {
    const current = invoice.lineItems.find((i) => i._id === id);
    if (!current) return;
    const key = current.description.trim().toLowerCase();
    if (!key) return;
    const target = invoice.lineItems.find((i) => i._id !== id && i.description.trim().toLowerCase() === key);
    if (!target) return;
    setInvoice((prev) => {
      const nextItems = prev.lineItems
        .map((i) => i._id === target._id ? { ...i, quantity: (i.quantity || 0) + (current.quantity || 0) } : i)
        .filter((i) => i._id !== id);
      return recalculate({ ...prev, lineItems: nextItems });
    });
    notify.success(`Merged into existing "${target.description}".`);
  }, [invoice.lineItems, setInvoice]);

  // Additional charges
  const handleChargesChange = useCallback((charges: AdditionalCharge[]) => {
    setInvoice((prev) => recalculate({ ...prev, additionalCharges: charges }));
  }, [setInvoice]);

  // Round off
  const handleRoundOffChange = useCallback((roundOff: number) => {
    setInvoice((prev) => recalculate({ ...prev, roundOff }));
  }, [setInvoice]);

  // List-view navigation. Loaders use setInvoiceRaw so the status-flip
  // wrapper doesn't mistake the load for an edit.
  const handleNew = () => {
    const blank = createBlankInvoice();
    setInvoiceRaw(recalculate({ ...blank, _id: '', createdAt: '', updatedAt: '' }));
    setErrors(new Set());
    setIsDirty(false);
    routerNavigate('/invoice/new');
  };

  const handleSelectInvoice = (id: string) => {
    const found = findOne(id);
    if (!found) return;
    const loaded = reconcileDraftNumber(found);
    setInvoiceRaw(recalculate(loaded));
    setErrors(new Set());
    setIsDirty(false);
    // Stay in preview mode if currently previewing, but only for saved/mail-sent/modified invoices
    const stayPreview = isPreviewMode && found.status !== 'draft';
    routerNavigate(stayPreview ? `/invoice/${id}/preview` : `/invoice/${id}`);
  };

  // Guard helper: pendingNavId is either an invoice _id, '__list__', '__new__', or '__preview__:<id>'.
  const doNav = (target: string) => {
    if (target === '__list__') { routerNavigate('/'); return; }
    if (target === '__new__') { handleNew(); return; }
    if (target.startsWith('__preview__:')) {
      const id = target.slice('__preview__:'.length);
      routerNavigate(`/invoice/${id}/preview`);
      return;
    }
    handleSelectInvoice(target);
  };

  // Called by sidebar item click — guards if dirty
  const handleSidebarClick = (id: string) => {
    if (isDirty && invoice._id !== id) setPendingNavId(id);
    else handleSelectInvoice(id);
  };

  // Sidebar "+" — start a new invoice, guarding if there are unsaved changes
  const handleSidebarNew = () => {
    if (isDirty) setPendingNavId('__new__');
    else handleNew();
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
      notify.success('Saved as draft.');
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
    if (!saved) { notify.error('Save failed.'); return; }
    setAllInvoices(findAll());
    setIsDirty(false);
    notify.success('Invoice saved!');
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

    // Delivery Address — only required when it isn't a copy of the billing address.
    if (!invoice.deliverySameAsBilling) {
      if (!invoice.deliveryAddress.trim()) { found.add('deliveryAddress'); missingLabels.push('Delivery Address'); }
      if (!invoice.deliveryLocation?.country?.trim()) { found.add('deliveryCountry'); missingLabels.push('Delivery Country'); }
      if (!invoice.deliveryLocation?.state?.trim()) { found.add('deliveryState'); missingLabels.push('Delivery State'); }
      if (!invoice.deliveryLocation?.city?.trim()) { found.add('deliveryCity'); missingLabels.push('Delivery City'); }
    }

    if (!invoice.invoiceNumber.trim()) {
      found.add('invoiceNumber'); missingLabels.push('Invoice Number');
    } else if (invoiceNumberExists(invoice.invoiceNumber, invoice._id || undefined)) {
      // Duplicate against another non-draft invoice — block the save so two
      // invoices never share the same number.
      found.add('invoiceNumber');
      missingLabels.push(`Invoice Number "${invoice.invoiceNumber}" already exists`);
    }
    if (!invoice.invoiceDate.trim()) { found.add('invoiceDate'); missingLabels.push('Invoice Date'); }
    if (!invoice.paymentMethod.trim()) { found.add('paymentMethod'); missingLabels.push('Payment Method'); }
    if (!invoice.termsAndConditions.trim()) { found.add('termsAndConditions'); missingLabels.push('Terms & Conditions'); }

    // Account Details — branchName is the only optional field.
    const ad = invoice.accountDetails;
    if (!ad?.accountHolderName?.trim()) { found.add('accountHolderName'); missingLabels.push('Account Holder Name'); }
    if (!ad?.bankName?.trim())          { found.add('bankName');          missingLabels.push('Bank Name'); }
    if (!ad?.accountNumber?.trim())     { found.add('accountNumber');     missingLabels.push('Account Number'); }
    if (!ad?.ifscCode?.trim())          { found.add('ifscCode');          missingLabels.push('IFSC Code'); }

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
    notify.error(`Please fill required fields: ${preview}${more}`);
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
        setInvoiceRaw(saved);
        setAllInvoices(findAll());
        setIsDirty(false);
        notify.success('Invoice saved!');
      } else {
        notify.error('Save failed. Try again.');
      }
    } catch {
      notify.error('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const pdfFilename = `${invoice.invoiceNumber || 'invoice'}.pdf`;

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      await notify.promise(downloadPdf(pdfFilename), {
        loading: 'Generating PDF…',
        success: 'PDF exported successfully!',
        error: 'PDF export failed.',
      });
    } catch (err) {
      console.error('PDF export failed:', err);
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
      notify.error('Could not generate PDF. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  // Mail — navigate to the in-app mail composer (same tab, react-router).
  // If there are unsaved changes (e.g. toggling "Include In Mail" on an attachment),
  // persist them first so MailPreview reads the fresh state from storage.
  const handleMail = () => {
    if (!invoice._id) {
      notify.error('Save the invoice before sending.');
      return;
    }
    if (!invoice.clientEmail.trim()) {
      notify.error('Add a client email before sending.');
      return;
    }
    if (isDirty) {
      const saved = updateOne(invoice._id, invoice);
      if (!saved) { notify.error('Could not save changes before opening mail.'); return; }
      setInvoiceRaw(saved);
      setAllInvoices(findAll());
      setIsDirty(false);
    }
    routerNavigate(`/invoice/${invoice._id}/mail`);
  };

  // Ctrl+P / Cmd+P — print as PDF if saved, toast if not
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (invoice.status !== 'draft' && invoice._id) {
          handlePrint();
        } else {
          notify.error('Save the invoice before printing.');
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
      // Going from preview back to editor — never dirty here.
      routerNavigate(`/invoice/${id}`);
      return;
    }
    // Editor → Preview. If the user has unsaved changes, surface the same
    // save-or-discard modal used for sidebar nav so the preview reflects the
    // saved state.
    if (isDirty) {
      if (!invoice._id) {
        // New (never persisted) invoice — must validate before saving as anything.
        if (!validate()) return;
      }
      setPendingNavId(`__preview__:${id}`);
      return;
    }
    if (!validate()) return;
    routerNavigate(`/invoice/${id}/preview`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toaster is mounted once globally in App.tsx — see notify util. */}

      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3" data-tour="brand">
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
                data-tour="new-invoice"
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
              data-tour="preview-btn"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-emerald-700 bg-linear-to-b from-emerald-200/70 to-emerald-300/60 hover:from-emerald-300/80 hover:to-emerald-400/70 border border-emerald-300/70 backdrop-blur-sm shadow-sm shadow-emerald-500/20 ring-1 ring-white/40 transition"
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
              data-tour="save-btn"
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

      <main className={`mx-auto px-4 sm:px-6 py-6 ${isListMode ? 'max-w-370' : 'max-w-7xl'}`}>
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
              onNew={handleSidebarNew}
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
                  <AccountDetails
                    value={invoice.accountDetails}
                    errors={errors}
                    onChange={(next) => updateField('accountDetails' as never, next as never)}
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
          invoiceCase={!invoice._id ? 'new' : invoice.status === 'draft' ? 'draft' : 'saved' /* mail-sent + modified treated as 'saved' for the modal */}
          onSaveAsDraft={handleSaveAsDraft}
          onSave={handleSaveAndNavigate}
          onDontSave={handleDiscardAndNavigate}
          onCancel={handleCancelNav}
        />
      )}
    </div>
  );
}
