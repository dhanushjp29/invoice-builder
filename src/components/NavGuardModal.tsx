/**
 * Case matrix:
 *   isNew (no _id, never saved) → Save as Draft | Save | Don't Save | ✕
 *   isDraft (has _id, status=draft) → Save as Draft | Save | Don't Save | ✕
 *   isSaved (status=saved, user edited) → Save | Don't Save | ✕
 *
 * "Don't Save" always navigates away without saving — it never deletes.
 * "✕" (top-right X) = Cancel, stays on current invoice.
 */

type InvoiceCase = 'new' | 'draft' | 'saved';

interface Props {
  invoiceCase: InvoiceCase;
  onSaveAsDraft: () => void;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}

const CONFIG: Record<InvoiceCase, { title: string; body: string; accent: string; iconColor: string }> = {
  new: {
    title: 'Unsaved Invoice',
    body: 'This invoice has not been saved yet. You can save it as a draft, save it now, or leave without saving.',
    accent: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  draft: {
    title: 'Unsaved Draft Changes',
    body: 'You have unsaved changes to this draft. Save it, save as draft, or leave without saving.',
    accent: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  saved: {
    title: 'Unsaved Changes',
    body: 'You have unsaved changes. Save them now or leave without saving.',
    accent: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
};

export default function NavGuardModal({ invoiceCase, onSaveAsDraft, onSave, onDontSave, onCancel }: Props) {
  const { title, body, accent, iconColor } = CONFIG[invoiceCase];
  const showDraft = invoiceCase === 'new' || invoiceCase === 'draft';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-96 max-w-[92vw]">

        {/* ✕ Cancel — top right */}
        <button
          onClick={onCancel}
          title="Stay on this invoice"
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 mb-5 pr-6">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${accent}`}>
            <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{body}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {showDraft && (
            <button
              onClick={onSaveAsDraft}
              className="w-full px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition"
            >
              Save as Draft
            </button>
          )}

          <button
            onClick={onSave}
            className="w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
          >
            Save
          </button>

          <button
            onClick={onDontSave}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition"
          >
            Don't Save
          </button>
        </div>
      </div>
    </div>
  );
}
