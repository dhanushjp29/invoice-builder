# Invoice Builder

A modern, fully client-side Invoice Builder built with React 19, TypeScript, and Vite 8. Create, manage, preview, and send professional GST-aware invoices — all from the browser, with no backend account required. Gmail sending is handled by lightweight Netlify Functions; everything else lives in the browser (localStorage + IndexedDB).

Deployed on Netlify with code-split bundles for fast first paint.

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Application flow](#application-flow)
5. [Data model](#data-model)
6. [Storage layer](#storage-layer)
7. [GST + tax logic](#gst--tax-logic)
8. [Components — file by file](#components--file-by-file)
9. [Utilities — file by file](#utilities--file-by-file)
10. [Database layer — file by file](#database-layer--file-by-file)
11. [Netlify Functions](#netlify-functions)
12. [Gmail OAuth + send flow](#gmail-oauth--send-flow)
13. [PDF generation pipeline](#pdf-generation-pipeline)
14. [Mobile-responsive email HTML](#mobile-responsive-email-html)
15. [Code-splitting + bundle strategy](#code-splitting--bundle-strategy)
16. [Local development](#local-development)
17. [Deployment to Netlify](#deployment-to-netlify)
18. [Environment variables](#environment-variables)

---

## Features

- **No-account invoicing** — every invoice is stored locally in the user's browser (localStorage + IndexedDB). No login wall, no cloud database.
- **GST-aware totals** — automatic CGST/SGST split for intra-state, IGST for inter-state, zero-rated for exports. India-only logic disabled gracefully for non-Indian sellers.
- **Auto-generated invoice numbers** — financial-year-aware (April–March), per-prefix sequence, with built-in dedupe and draft-renumbering.
- **Two invoice list views** — "All Invoices" summary table and "Detailed Invoice" line-item breakdown — each with Excel-style multi-column filters, cascade unique-value pickers, sorting, and pagination.
- **PDF export + print** — html2pdf-based generation, lazy-loaded so first-load is fast.
- **Excel export** — both summary and detailed workbooks via ExcelJS (also lazy-loaded).
- **Inbuilt Gmail sender** — connect a Gmail account via Google OAuth (server-side exchange in a Netlify Function); send the invoice as HTML + PDF + optional extra attachments, using `gmail.users.messages.send`.
- **File attachments per invoice** — stored as native Blobs in IndexedDB (no base64 bloat). Files can be marked "Include In Mail" to ride along with the email.
- **Onboarding tour** — 15-step react-joyride walkthrough that triggers once per browser, auto-pauses on route changes and resumes when the right page mounts.
- **Splash + Lottie loaders** — pure-CSS splash and WebM-based loader (off the main thread, never freezes during PDF generation).
- **Auto-seeded demo data** — 5 demo invoices covering every status (draft / saved / mail-sent / modified) on first load.
- **Status badges with cycle counter** — `Mail Sent`, `Modified`, `Mail Sent (2)` etc. once the same invoice has been sent + edited multiple times.
- **Mobile-responsive email** — the sent HTML uses a `@media (max-width: 600px)` rule so phones render the message cleanly while desktop stays at 780 px.

---

## Tech stack

### Runtime

| Layer | Tech |
|---|---|
| UI framework | **React 19.2** with `StrictMode` |
| Language | **TypeScript ~6.0** (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`) |
| Bundler | **Vite 8.0** (rolldown-based) |
| Styling | **Tailwind CSS 4.3** via `@tailwindcss/vite` |
| Routing | **react-router-dom 7.15** (`BrowserRouter`) |
| Notifications | **react-hot-toast 2.6** |
| Onboarding | **react-joyride 3.1** |
| Local storage | `localStorage` (JSON) + `IndexedDB` (raw Blobs) |
| PDF | **html2pdf.js 0.14** (jsPDF + html2canvas under the hood) |
| Excel | **ExcelJS 4.4** |
| File download | **file-saver 2.0** |
| Geography | **country-state-city 3.2** |
| IDs | **uuid 14** |
| Splash + loader animation | Pure CSS keyframes + `<video>` WebM |

### Backend (Netlify Functions)

| Layer | Tech |
|---|---|
| Runtime | Node 18 on Netlify Functions, ESBuild bundler |
| OAuth | **googleapis 172** (`google.auth.OAuth2`, `google.gmail`) |
| Email transport | **Gmail API** (`gmail.users.messages.send`) — no SMTP |
| Wire format | Raw RFC 2822 message, base64url-encoded |

### Tooling

| Tool | Purpose |
|---|---|
| `netlify-cli` 26 | Local dev (`netlify dev`), Functions emulator |
| `@vitejs/plugin-react` 6 | React Fast Refresh |
| `eslint` 10 + `typescript-eslint` 8 | Linting |
| `eslint-plugin-react-hooks` 7 | Hook rules |

---

## Project structure

```
invoice-builder/
├── netlify.toml                    # Netlify build + dev + redirects config
├── netlify/
│   └── functions/
│       ├── google-auth.ts          # Step 1 — kick off OAuth, redirect to Google
│       ├── google-callback.ts      # Step 2 — exchange code → refresh_token, redirect back
│       └── send-email.ts           # Step 3 — build RFC 2822 message, send via Gmail API
├── public/
│   ├── favicon.ico                 # Plus other PWA icons
│   ├── site.webmanifest
│   └── lottie/
│       ├── loader-common.webm      # Loader video (used for export/save spinners)
│       └── loader-email.webm       # Loader video (used during send-email)
├── src/
│   ├── main.tsx                    # Entry; bouncer 5173 → 8888 in dev
│   ├── App.tsx                     # Routes, splash, toaster, OnboardingTour, boot side-effects
│   ├── index.css                   # Tailwind layer imports
│   ├── App.css                     # Legacy global styles
│   │
│   ├── components/                 # 24 UI components (see file-by-file section)
│   │
│   ├── db/                         # Persistence layer
│   │   ├── invoiceDB.ts            # localStorage CRUD, numbering, dedupe
│   │   ├── attachmentStore.ts      # IndexedDB blob store for attachments
│   │   ├── autoSeed.ts             # First-run demo invoices (5 records)
│   │   ├── seedAssets.ts           # Base64-embedded demo logo/seal/sig/PDF
│   │   └── migrateAttachments.ts   # One-shot legacy data:URL → IndexedDB migration
│   │
│   ├── hooks/
│   │   └── usePersistentState.ts   # useState mirrored into sessionStorage
│   │
│   ├── types/
│   │   ├── invoice.ts              # InvoiceDocument, LineItem, enums (currency, tax, UOM, …)
│   │   └── html2pdf.d.ts           # Type shim for html2pdf.js
│   │
│   ├── utils/
│   │   ├── recalculate.ts          # Pure totals + tax recomputation
│   │   ├── pdfExport.ts            # html2pdf wrappers (lazy-loaded)
│   │   ├── pdfBase64.ts            # Blob → base64 helper for mail
│   │   ├── gmailClient.ts          # Frontend OAuth client + sender
│   │   ├── attachmentView.ts       # Open Blob in new tab / force-download
│   │   ├── invoiceStatus.ts        # Status labels + Tailwind color tokens
│   │   └── notify.ts               # react-hot-toast wrapper (single style source)
│   │
│   └── assets/                     # Static images shipped with the bundle
│
├── tsconfig.json                   # Project references (app + node)
├── tsconfig.app.json               # Browser bundle: ES2023, react-jsx, bundler resolution
├── tsconfig.node.json              # Vite config bundle
├── vite.config.ts                  # React + Tailwind plugins, dev open:false
└── package.json
```

---

## Application flow

```
                            ┌─────────────────┐
                            │   main.tsx      │
                            │ (boot, port-    │
                            │  bouncer)       │
                            └────────┬────────┘
                                     │ renders
                            ┌────────▼────────┐
                            │     App.tsx     │
                            │  - Splash       │ once per tab
                            │  - autoSeed     │ first run
                            │  - migrate      │ idempotent
                            │  - OAuth capt.  │ if hash present
                            │  - <Toaster>    │
                            │  - <Tour>       │ first run
                            └────────┬────────┘
                                     │ <Routes>
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
   /invoice/:id/mail            /*  (everything else)
   ┌─────────────┐            ┌────────────────────┐
   │ MailPreview │            │   InvoiceBuilder   │
   │   - OAuth   │            │  ┌──────────────┐  │
   │     connect │            │  │ Top nav      │  │
   │   - compose │            │  ├──────────────┤  │
   │   - send    │            │  │ /            │──┼──> InvoiceList
   │   - PDF gen │            │  │ /invoice/:id │──┼──> Sidebar + Editor
   │   - mark    │            │  │ ../preview   │──┼──> Sidebar + PrintView
   │     mail-   │            │  └──────────────┘  │
   │     sent    │            └────────────────────┘
   └─────────────┘
```

### Boot sequence (App.tsx, in order, on every mount)

1. **`captureOAuthRedirect()`** — if the URL hash is `#gmail-connected?refresh_token=…&email=…`, parse and save to `localStorage`, then strip the hash.
2. **`migrateLegacyAttachments()`** — one-shot: scan invoices for inline base64 `data:` attachments, move them into IndexedDB, rewrite the invoice with a `blobId`. Guarded by `localStorage.attachmentStore_migrationV1 = 'done'`.
3. **`autoSeed()`** — on first run only, insert 5 demo invoices (`INV2026-0001` through `INV2026-0005`) covering every status. Has a `seedingInFlight` lock so StrictMode double-mount in dev can't seed twice. Self-heals if the flag is set but the DB is empty.
4. **`dedupeInvoiceNumbers()`** — scans the collection and renumbers any duplicate invoice numbers (drafts first). Idempotent.
5. **`preloadLottieAssets()`** — `fetch(url, { cache: 'force-cache' })` for both loader videos to warm the HTTP cache.

After splash fades, `OnboardingTour` mounts (`React.lazy()`-loaded). It self-gates on `localStorage.invoiceBuilder.tour.v4 === '1'` and only runs on the list route.

### Invoice editing flow

```
List → click row → /invoice/:id (editor)
                       │
                       │  edits trigger setInvoice → recalculate(...)
                       │  → isDirty=true
                       │
                  Click Save ─── validate() ─┬─ ok    → updateOne/insertOne, status='saved'
                                             └─ fail  → toast + highlight bad fields
                       │
                  Click Preview ── if dirty → NavGuardModal (Save / Don't Save / Cancel)
                       │
                  /invoice/:id/preview ── PrintView + PreviewBar (Mail / Print / PDF / Edit)
                       │
                  Click Mail ── auto-save dirty → /invoice/:id/mail
                                                     │
                                                     ▼
                                               MailPreview
                                                     │
                                  Connect Gmail (OAuth round-trip)
                                                     │
                                              Compose + Send
                                                     │
                                  Mark invoice mail-sent, cycleCount++
```

### Status state machine

| Status | When | Editable | Deletable | Badge color |
|---|---|---|---|---|
| `draft` | Manual "Save as draft" | yes | yes | amber |
| `saved` | After `Save` (validated) | yes | yes | green |
| `mail-sent` | After successful email send | yes (→ `modified`) | **no** (audit trail) | blue |
| `modified` | Edit a `mail-sent` invoice | yes | **no** (audit trail) | orange |

Editing a `mail-sent` invoice automatically flips it to `modified` (handled in `setInvoice` wrapper, [InvoiceBuilder.tsx](src/components/InvoiceBuilder.tsx#L152-L161)). Sending again bumps `cycleCount` and flips back to `mail-sent`. The badge then shows `Mail Sent (2)`, `Modified (2)`, etc.

---

## Data model

The entire app revolves around one document type: **`InvoiceDocument`** ([src/types/invoice.ts](src/types/invoice.ts)).

```ts
interface InvoiceDocument {
  _id: string;                    // uuid
  invoiceNumber: string;          // e.g. "INV2026-0001"
  invoiceDate: string;            // YYYY-MM-DD
  dueDate: string;
  currency: Currency;             // INR | USD | EUR | GBP | AED | SGD | JPY | CNY | CAD | AUD

  // Optional header
  poNumber: string;
  projectName: string;
  eWayBillNumber: string;
  transportName: string;
  vehicleNumber: string;

  // Discount
  discountType: 'percentage' | 'amount';
  discountValue: number;
  discountAmount: number;         // derived

  // Seller (company)
  companyName / Address / Email / Phone / Gst: string;
  companyLogo: string | null;     // data URL
  companyLocation: LocationData;  // { country, state, city, pincode }
  companySeal / signature: string | null;
  accountDetails?: AccountDetails; // bank account for payment instructions

  // Buyer (client)
  clientName / Address / Email / Phone / Gst: string;
  clientLocation: LocationData;

  // Delivery
  deliverySameAsBilling: boolean;
  siteName: string;
  deliveryAddress: string;
  deliveryLocation: LocationData;

  lineItems: LineItem[];
  additionalCharges: AdditionalCharge[];

  // Derived totals (set by recalculate())
  subtotal: number;
  discountedSubtotal: number;
  taxAmount: number;
  totalCGST / totalSGST / totalIGST: number;
  isIntraState: boolean;          // company.state === client.state
  isExport: boolean;              // India seller + foreign buyer
  additionalChargesTotal: number;
  roundOff: number;
  grandTotal: number;

  notes: string;
  termsAndConditions: string;
  paymentMethod: PaymentMethod | '';
  status: 'draft' | 'saved' | 'mail-sent' | 'modified';
  cycleCount?: number;            // bumped on each successful send

  attachments: Attachment[];      // metadata only; bytes in IndexedDB
  createdAt: string;
  updatedAt: string;
}
```

### Line item

```ts
interface LineItem {
  _id: string;
  description: string;
  hsnCode: string;
  uom: UOM | string;              // preset or custom
  quantity: number;
  unitRate: number;
  tax: TaxType;                   // 'None' | 'GST 5/12/18/28%' | 'IGST 5/12/18/28%'
  taxRate: number;                // numeric % (e.g. 18)

  // Derived (recalculate)
  taxableAmount: number;          // qty * unitRate − discount weight
  cgstAmount / sgstAmount / igstAmount: number;
  amount: number;                 // taxable + all taxes
}
```

### Attachment

```ts
interface Attachment {
  _id: string;
  name: string;
  mimeType: string;
  size: number;
  blobId?: string;                // → IndexedDB key (new path)
  data?: string;                  // legacy: inline data: URL (pre-migration)
  includeInMail?: boolean;        // user-tickable on the editor
}
```

The invoice document itself is plain JSON in localStorage. Only file *bytes* live in IndexedDB — the JSON carries a `blobId` pointer.

---

## Storage layer

| Where | What | Why |
|---|---|---|
| `localStorage` `invoiceDB_invoices` | The whole `InvoiceDocument[]` as JSON | Synchronous, simple, ~5 MB ceiling — plenty for hundreds of invoices |
| `localStorage` `invoiceDB_prefix` | User's custom invoice prefix (e.g. `"INV"`) | Persists across sessions, used by every new number |
| `localStorage` `invoiceBuilder.autoSeeded.v4` | Boolean flag — has demo data been seeded? | Prevents reseeding |
| `localStorage` `attachmentStore_migrationV1` | Boolean — has the legacy inline-base64 migration run? | One-shot guard |
| `localStorage` `invoiceBuilder.tour.v4` | Boolean — has the user completed the tour? | First-run gate |
| `localStorage` `gmail_refresh_token` + `gmail_connected_email` | OAuth credentials | Single-user, single-device tool — fine to keep in localStorage |
| `sessionStorage` `invoiceList.all.*` etc. | List view search/filter/sort/pagination | Persists across navigation, wipes on tab close |
| `IndexedDB` db `invoiceBuilderAttachments`, store `files` | `{ id, blob, createdAt }` per attachment | Raw `Blob` storage — no base64 bloat, gigabytes of headroom |

### Why two storage backends?

LocalStorage stores strings only, so attaching a 5 MB PDF means base64-encoding it to ~6.7 MB and parking it inside the invoice JSON. That bloated the invoice list query (every load reparses the whole collection), pushed multiple invoices over the 5 MB origin limit, and made `JSON.stringify` painfully slow.

IndexedDB stores native `Blob` objects with no encoding. Each attachment is a separate record keyed by UUID; the invoice JSON only carries the UUID. Save and read are O(1) regardless of file size.

---

## GST + tax logic

Computed in [src/utils/recalculate.ts](src/utils/recalculate.ts) — pure function, no side effects.

### Step 1 — Classify the invoice

```ts
isExport      = companyCountry === 'IN' && billingCountry && billingCountry !== 'IN'
isIntraState  = !isExport && companyState === billingState
```

- **Export** → all taxes set to 0, "zero-rated supply" badge in PDF.
- **Intra-state** → tax rate split 50/50 into CGST + SGST.
- **Inter-state** → full rate goes to IGST.

### Step 2 — Apply discount

Discount is applied at the **invoice level** before tax. A line item's share of the discount is proportional to its share of the pre-discount subtotal:

```ts
weight        = (qty * rate) / subtotal
taxableAmount = (qty * rate) − discountAmount * weight
```

This means a 10 % invoice discount reduces every line's taxable amount by 10 %, so the GST is computed on the post-discount value.

### Step 3 — Compute tax per line

```ts
if (isExport) {
  cgst = sgst = igst = 0;
} else if (isIntraState) {
  cgst = taxableAmount * (rate / 2) / 100;
  sgst = taxableAmount * (rate / 2) / 100;
} else {
  igst = taxableAmount * rate / 100;
}
amount = taxableAmount + cgst + sgst + igst;
```

### Step 4 — Roll up to invoice totals

```ts
grandTotal = discountedSubtotal
           + totalCGST + totalSGST + totalIGST
           + additionalChargesTotal
           + roundOff;
```

All values are rounded to 2 decimal places via `round2()`.

### Non-Indian sellers

If `companyLocation.country !== 'IN'`, GST/IGST is hidden entirely from the totals UI ([InvoiceTotals.tsx](src/components/InvoiceTotals.tsx)) and the print view ([InvoicePrintView.tsx](src/components/InvoicePrintView.tsx)) shows a single "Tax Amount" row.

---

## Components — file by file

| File | Purpose |
|---|---|
| [App.tsx](src/App.tsx) | Root routes, splash gate, global Toaster, lazy `OnboardingTour`, boot effects (OAuth capture, migrate, autoSeed, dedupe, lottie preload). |
| [main.tsx](src/main.tsx) | React entry. Bounces port `:5173` → `:8888` in dev so Netlify Functions are reachable. |
| [InvoiceBuilder.tsx](src/components/InvoiceBuilder.tsx) | Top-level editor: parses ID from URL, loads/creates invoice, renders header + sidebar + form sections (or preview), wires Save / Preview / Print / PDF / Mail buttons, manages `isDirty`, validation errors, nav-guard modal. |
| [InvoiceList.tsx](src/components/InvoiceList.tsx) | List screen with two tabs: **All Invoices** (summary table) and **Detailed Invoice** (line-item breakdown). Excel-style multi-column filters with cascade unique values, server-side-style sorting + pagination, per-row PDF download, delete-with-confirm, XLSX export. ExcelJS + file-saver are lazy-loaded inside the export functions. |
| [InvoiceSidebar.tsx](src/components/InvoiceSidebar.tsx) | Persistent left rail on editor/preview screens — searchable, paginated invoice picker. Search matches number, client, project, status, and parsed date components (day, month name, year). |
| [InvoiceHeader.tsx](src/components/InvoiceHeader.tsx) | Top form section: company logo + name + GST + email + phone, editable invoice-number prefix (with year + 4-digit seq locked), invoice/due dates, PO / project / e-way bill, currency selector, company location, transport details, seal + signature uploads. |
| [InvoicePrintView.tsx](src/components/InvoicePrintView.tsx) | Print-ready invoice rendered as a table-based layout (so it survives Gmail/Outlook MIME inlining). Used in: preview screen, hidden `print:block` clone, and the source DOM for both PDF generation and the mail HTML body. |
| [InvoiceTotals.tsx](src/components/InvoiceTotals.tsx) | Subtotal → discount → CGST/SGST/IGST (or single Tax row for non-IN) → additional charges → round-off → grand total panel, plus notes / terms / payment-method fields. |
| [LineItemsTable.tsx](src/components/LineItemsTable.tsx) | Editable line items table. Description is an autocomplete-creatable combobox seeded from every saved invoice's items; UOM combobox supports custom units kept in session state; per-row delete; merge-into-twin button when a duplicate description is detected. |
| [AdditionalCharges.tsx](src/components/AdditionalCharges.tsx) | Repeatable list of named non-tax charges (freight, installation, etc.) — type-creatable combobox + amount field. |
| [ClientInfo.tsx](src/components/ClientInfo.tsx) | Client name / address / GST / email / phone, client location, optional separate delivery address with "Same as billing" toggle. |
| [AccountDetails.tsx](src/components/AccountDetails.tsx) | Bank account fields for payment instructions on the invoice. |
| [FileAttachments.tsx](src/components/FileAttachments.tsx) | Drag-and-drop / file-picker for invoice attachments. Each file goes straight to IndexedDB via `putAttachment()`; the invoice carries metadata + `blobId`. Per-file "Include In Mail" checkbox decides what rides along with the email. |
| [LocationSelector.tsx](src/components/LocationSelector.tsx) | Country / State / City / Pincode group. `country-state-city` is dynamic-imported on mount, so 8.7 MB of geographic JSON never blocks first paint. |
| [Combobox.tsx](src/components/Combobox.tsx) | Generic searchable dropdown with portal-rendered popup, keyboard nav, optional `creatable` mode for free-text values. |
| [DatePicker.tsx](src/components/DatePicker.tsx) | Custom YYYY-MM-DD picker. Calendar grid with month/year jump, no native browser styling. |
| [LogoUpload.tsx](src/components/LogoUpload.tsx) | Company logo uploader with preview + clear button. Stores as `data:` URL on the invoice document (small images only). |
| [ImageUploadField.tsx](src/components/ImageUploadField.tsx) | Generic image uploader used for company seal + authorised signature. |
| [PreviewBar.tsx](src/components/PreviewBar.tsx) | Action bar shown above `InvoicePrintView` on the preview route — Mail / Print / Download PDF / Back-to-editor. |
| [NavGuardModal.tsx](src/components/NavGuardModal.tsx) | Three-button modal shown when navigating away from a dirty editor: **Save as Draft** / **Save** / **Don't Save** / **Cancel**. Buttons available depend on the invoice's current status (new vs draft vs saved). |
| [SplashScreen.tsx](src/components/SplashScreen.tsx) | Boot splash — pure CSS animation, inline SVG mark, gradient background, character-by-character title reveal. No assets, no network. Plays once per tab (gated by `sessionStorage.splashShown`). |
| [LottieLoader.tsx](src/components/LottieLoader.tsx) | Fullscreen blurred overlay with a `<video>` WebM player. Off the main thread so it never freezes during PDF generation. 1-second minimum visible time so sub-second operations don't flash. **Renders the video at its native intrinsic dimensions** (no upscaling) — `size` prop only acts as an optional max-cap. |
| [lottieAssets.ts](src/components/lottieAssets.ts) | URLs for the WebM loaders + `preloadLottieAssets()` HTTP-cache warmer. |
| [MailPreview.tsx](src/components/MailPreview.tsx) | Email composer screen. Compose To / Subject / Message; PDF generated from `#invoice-print-area`; sends via `gmailClient.sendInvoiceEmail()` to the Netlify Function; on success, flips the invoice to `mail-sent` and bumps `cycleCount`. Includes mobile-responsive HTML email template (see below). |
| [OnboardingTour.tsx](src/components/OnboardingTour.tsx) | 15-step react-joyride product tour. Routes auto-advance on `location.pathname` change; CTA steps (5/11/13) wait for the user to navigate themselves. `body[data-tour-step]` is set so CSS can restrict interaction (e.g. only INV0001 is clickable on step 5). Lazy-loaded via `React.lazy()`. |
| [UploadToast.tsx](src/components/UploadToast.tsx) | Custom react-hot-toast renderer with an animated progress bar — used by `notify.upload(file, work)`. |

---

## Utilities — file by file

| File | Purpose |
|---|---|
| [utils/recalculate.ts](src/utils/recalculate.ts) | Pure totals + tax engine (see [GST logic](#gst--tax-logic)). |
| [utils/pdfExport.ts](src/utils/pdfExport.ts) | `downloadPdf(filename)` triggers Save-As; `generatePdfBlob(filename)` returns a Blob (used by the mail flow); `printAsPdf(filename)` opens the generated PDF in a new tab for clean printing. All three lazy-load `html2pdf.js`. |
| [utils/pdfBase64.ts](src/utils/pdfBase64.ts) | `blobToBase64(blob)` — strips the `data:…;base64,` prefix. Used to ship the PDF over JSON to the Netlify function. |
| [utils/gmailClient.ts](src/utils/gmailClient.ts) | Frontend Gmail interface: `startGmailConnect()` redirects to `/google-auth`, `captureOAuthRedirect()` reads the `#gmail-connected?…` hash and saves credentials, `sendInvoiceEmail(args)` POSTs to `/send-email`. Disconnect clears localStorage. |
| [utils/attachmentView.ts](src/utils/attachmentView.ts) | `openAttachmentInNewTab(blob, fileName)`: PDFs / images / video / audio / text open inline in a new tab via `blob:` URL; everything else (DOCX, XLSX, ZIP) is force-downloaded via a hidden `<a download>` so the OS sees the real filename, not the random blob ID. |
| [utils/invoiceStatus.ts](src/utils/invoiceStatus.ts) | `statusLabel(inv)` returns `"Draft" / "Created" / "Mail Sent" / "Mail Sent (2)" / …`. `statusColors(status)` returns the Tailwind class bundle for badge styling. |
| [utils/notify.ts](src/utils/notify.ts) | Single source of truth for toasts. Wraps react-hot-toast with consistent durations + the custom `notify.upload(file, work)` progress-bar variant. |

---

## Database layer — file by file

| File | Purpose |
|---|---|
| [db/invoiceDB.ts](src/db/invoiceDB.ts) | Synchronous localStorage CRUD: `findAll`, `findOne`, `insertOne`, `updateOne`, `deleteOne`. Plus invoice-number machinery: `generateInvoiceNumber()` (FY-aware, `{prefix}{FY_year}-{NNNN}`), `invoiceNumberExists()`, `reconcileDraftNumber()`, `dedupeInvoiceNumbers()`, `bumpConflictingDrafts()`. Also defines `createBlankInvoice()` which carries the company identity over from the most recent saved invoice. |
| [db/attachmentStore.ts](src/db/attachmentStore.ts) | IndexedDB wrapper. `putAttachment(blob) → blobId`, `getAttachmentBlob(id) → Blob`, `deleteAttachment(id)`, `getAttachmentObjectUrl(id)`, `getAttachmentBase64(id)`. The DB (`invoiceBuilderAttachments`, version 1, store `files`) is opened lazily on first call. |
| [db/autoSeed.ts](src/db/autoSeed.ts) | First-run demo seeder. Inserts 5 invoices covering every status, every state of GST (intra-state, inter-state, export), discount types, attachments. INV0001 has a real PDF attachment stored in IndexedDB and a fixed `_id` so the tour can target it reliably. Idempotent + self-healing: if the flag is set but the DB is empty, it re-seeds. Window-global `resetSeed()` is exposed for dev convenience. |
| [db/seedAssets.ts](src/db/seedAssets.ts) | Auto-generated file holding base64-encoded demo logo / seal / signature / PDF — so seeding never needs a network fetch. |
| [db/migrateAttachments.ts](src/db/migrateAttachments.ts) | One-shot migration that scans every invoice for legacy inline `data:` attachments, decodes them to Blobs, writes them to IndexedDB, and rewrites the invoice with a `blobId`. Guarded by the `attachmentStore_migrationV1` flag. Safe to call on every boot. |

---

## Netlify Functions

All Gmail-side credentials and the `googleapis` SDK live entirely on the server. The client never sees the client secret. Three functions, all under [netlify/functions/](netlify/functions/):

### 1. `google-auth.ts` — kick off OAuth

`GET /.netlify/functions/google-auth?returnTo=/invoice/abc/mail`

Builds the Google consent URL with:
- `access_type=offline` (we want a refresh token)
- `prompt=consent` (force the consent screen so a refresh token is always issued — Google won't re-issue one on subsequent grants without this)
- `scope=gmail.send + userinfo.email`
- `state=<returnTo>` — the in-app path the user came from, so we can land them back on it

Returns `302 → accounts.google.com/...`.

### 2. `google-callback.ts` — exchange code for tokens

`GET /.netlify/functions/google-callback?code=…&state=…`

- Exchanges the auth code for `{ access_token, refresh_token, … }`.
- If there's no refresh token (already-consented user without `prompt=consent`), bail with a clear error telling the user to revoke at `myaccount.google.com/permissions` and retry.
- Fetches the user's email from `oauth2.userinfo`.
- Sanitizes `state` so it's a same-origin relative path (no off-site redirects).
- Redirects to `${APP_URL}${returnTo}#gmail-connected?refresh_token=…&email=…`. The hash (not query) keeps the token out of server-side request logs and referrer headers.

### 3. `send-email.ts` — send the email

`POST /.netlify/functions/send-email`

```json
{
  "refreshToken": "…",
  "fromEmail": "user@gmail.com",
  "to": "client@example.com",
  "subject": "Invoice INV2026-0001 …",
  "html": "<html>…</html>",
  "pdfBase64": "JVBERi0xLjQ…",
  "pdfFilename": "INV2026-0001.pdf",
  "attachments": [ { "filename", "mimeType", "base64" }, … ]
}
```

- Builds an RFC 2822 message by hand (`From`, `To`, `Subject` with RFC 2047 encoded-word, `multipart/mixed` if attachments are present, base64-encoded HTML body part, one part per attachment).
- Encodes the whole thing as base64url (Gmail API requirement).
- Calls `gmail.users.messages.send({ userId: 'me', requestBody: { raw } })`.
- Returns `{ messageId }` on success, `{ error }` on failure.

Why Gmail API + not SMTP: the `gmail.send` OAuth scope authorizes this path directly. There's no SMTP auth layer to fail with the dreaded `535-5.7.8` BadCredentials.

---

## Gmail OAuth + send flow

```
User clicks "Connect Gmail" on /invoice/:id/mail
   │
   │ window.location.href = /.netlify/functions/google-auth?returnTo=/invoice/:id/mail
   ▼
Google consent screen
   │
   │ user approves
   ▼
Google → /.netlify/functions/google-callback?code=…&state=/invoice/:id/mail
   │
   │ exchange code → refresh_token + email
   │ 302 → APP_URL/invoice/:id/mail#gmail-connected?refresh_token=…&email=…
   ▼
MailPreview mounts → App.tsx already ran captureOAuthRedirect()
   │
   │ refresh_token + email saved in localStorage
   │ window.dispatchEvent('gmail-connection-changed')
   │ MailPreview's useEffect listener updates `conn` state
   ▼
User edits To/Subject/Message → clicks Send
   │
   │ generatePdfBlob(...) → Blob
   │ blobToBase64(blob) → string
   │ collectMailAttachments(invoice) → MailAttachment[]
   │ POST /.netlify/functions/send-email { refreshToken, fromEmail, to, subject, html, pdfBase64, pdfFilename, attachments }
   ▼
Function builds RFC 2822 → gmail.users.messages.send
   │
   │ { messageId } returned
   ▼
updateOne(id, { status: 'mail-sent', cycleCount: cycleCount + 1 })
navigate(`/invoice/${id}/preview`)
```

---

## PDF generation pipeline

Both download and mail-send go through the same DOM element: `<div id="invoice-print-area">` rendered inside `InvoicePrintView`.

### Download flow

```ts
await (await import('html2pdf.js')).default()
  .set({ margin, image, html2canvas, jsPDF, pagebreak })
  .from(document.getElementById('invoice-print-area'))
  .save();
```

`html2pdf.js` is a thin wrapper around `html2canvas` (DOM → canvas) + `jsPDF` (canvas → PDF). It's the slowest part of the app — for a 2-page invoice expect ~2–4 seconds on a mid-range laptop. The LottieLoader overlay covers this; because it's a `<video>` element it runs on the browser's media pipeline and **never freezes** while html2canvas hogs the main thread.

### Mail-send flow

```ts
const pdfBlob   = await generatePdfBlob(filename);   // same html2pdf chain, but ends with .toPdf().output('blob')
const pdfBase64 = await blobToBase64(pdfBlob);
const html      = buildHtmlBody();                   // wraps the same #invoice-print-area in the mobile-responsive shell
POST /send-email { html, pdfBase64, pdfFilename, … }
```

The DOM source is identical — so what the user sees on the preview page is exactly what arrives in the recipient's inbox (HTML body) and exactly what's attached as a PDF.

### Print flow

`printAsPdf(filename)` generates the same PDF Blob, opens it in a new tab via `URL.createObjectURL`, and lets the browser's native PDF viewer handle Ctrl+P — much cleaner than printing the HTML directly (no app chrome, no browser print headers).

---

## Mobile-responsive email HTML

The HTML built by `MailPreview.buildHtmlBody()` is what the recipient sees in their inbox. The desktop layout is unchanged (centered 780 px card on a slate background), but a `@media (max-width: 600px)` rule kicks in on phones:

- `<meta name="viewport" content="width=device-width, initial-scale=1" />` — tells Gmail iOS / Apple Mail to use real device width instead of pretending to be 980 px.
- Outer body padding drops to `0`.
- Card padding drops to `16px`, border-radius and side borders are stripped, so the message and the invoice block run edge to edge.
- The invoice itself is wrapped in `<div class="mail-invoice-scroll" style="overflow-x:auto">` and kept at `min-width: 720px`, so the fixed-width table-based invoice scrolls horizontally instead of forcing the whole inbox to zoom out.

Desktop (≥ 601 px) renders identically to before — same 780 px card, same border, same rounded corners.

---

## Code-splitting + bundle strategy

The initial JS bundle was **10.4 MB raw / 2.9 MB gzipped** before code-splitting. After splitting, **initial download is 263 KB gzipped** — a ~91 % reduction.

| Chunk | Size | Gzipped | Loaded when |
|---|---|---|---|
| `index-*.js` (main app) | 646 KB | 263 KB | Initial paint |
| `OnboardingTour-*.js` (react-joyride) | 90 KB | 30 KB | First-time visitor only |
| `lib-*.js` (country-state-city geographic data) | 8.7 MB | 2.4 MB | When `LocationSelector` mounts (deferred) |
| `exceljs.min-*.js` | 930 KB | 256 KB | On "Export XLSX" click |
| `html2pdf-*.js` | 936 KB | 266 KB | On PDF download / mail-send |
| `FileSaver.min-*.js` | 2.7 KB | 1.3 KB | On "Export XLSX" click |

### How the splits work

- **OnboardingTour** — `const OnboardingTour = lazy(() => import('./components/OnboardingTour'))` in [App.tsx](src/App.tsx#L14), rendered inside `<Suspense fallback={null}>`. Tour kicks off via a 500 ms internal `setTimeout`, so the lazy chunk fetch has plenty of time.
- **country-state-city** — [LocationSelector.tsx](src/components/LocationSelector.tsx) holds the module in state, `useEffect` calls `import('country-state-city')` on mount, the option lists stay empty until the chunk resolves. A module-level `cscModulePromise` cache means subsequent mounts share the same Promise.
- **ExcelJS + file-saver** — dynamically imported inside `exportAllXlsx` / `exportDetailedXlsx` in [InvoiceList.tsx](src/components/InvoiceList.tsx). Both functions are async, so the dynamic import slots in naturally.
- **html2pdf.js** — dynamically imported inside [pdfExport.ts](src/utils/pdfExport.ts) helpers.

### Loader rendering

The Lottie loaders are WebM videos (not Lottie JSON / dotlottie-web) for two reasons:

1. `<video>` runs in the browser's dedicated media pipeline (off the main thread), so heavy main-thread work like `html2canvas` during PDF generation **never freezes the animation** — the old Lottie player used `requestAnimationFrame` on the main thread and stuttered every time.
2. Zero JS runtime cost — no WASM, no JSON parse, just a `<video>` tag.

The loader renders at the video's **intrinsic resolution** (no upscaling — that was causing visible blur in the browser). The optional `size` prop now acts as a maximum cap, never an enlargement.

---

## Local development

### Prerequisites

- Node.js 20+
- A Google Cloud project with OAuth 2.0 credentials (Web application type)

### Install

```bash
npm install
```

### Environment variables for local dev

Create a `.env` file (or set them in your shell):

```
GOOGLE_CLIENT_ID=…apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=…
GOOGLE_REDIRECT_URI=http://localhost:8888/.netlify/functions/google-callback
APP_URL=http://localhost:8888
```

Authorized JavaScript origins (in Google Cloud Console): `http://localhost:8888`
Authorized redirect URIs: `http://localhost:8888/.netlify/functions/google-callback`

### Run

```bash
npm run dev
```

This launches **`netlify dev`** on port `8888`, which proxies Vite (5173) + serves Netlify Functions on the same origin. Visit **http://localhost:8888** — not 5173. If you hit 5173 by mistake, [main.tsx](src/main.tsx#L11) bounces you to 8888 automatically so the splash doesn't double-flash.

If you only want Vite (no Functions), use `npm run dev:vite` — Gmail features will be disabled with a clear toast/alert.

### Build

```bash
npm run build      # tsc -b && vite build
npm run preview    # serve dist/ on a local port
```

### Lint

```bash
npm run lint
```

### Reset demo data

In the browser console (dev convenience exposed by [autoSeed.ts](src/db/autoSeed.ts)):

```js
resetSeed()
```

Clears the seed flag + the invoice collection, then reloads. The 5 demo invoices come back on next mount.

---

## Deployment to Netlify

The repo is Netlify-ready. [netlify.toml](netlify.toml) sets:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200       # SPA fallback (force=false → static files served first)
```

### Steps

1. **Connect the repo on Netlify** — Netlify auto-detects Vite, but the build command + publish dir are already declared in `netlify.toml` so nothing manual is needed.
2. **Add env vars** in Site settings → Environment variables (see next section).
3. **Update Google Cloud Console** OAuth credentials:
   - Authorized JavaScript origins: `https://<your-site>.netlify.app`
   - Authorized redirect URIs: `https://<your-site>.netlify.app/.netlify/functions/google-callback`
4. **Deploy.** Netlify builds, deploys, and serves Functions from `/.netlify/functions/*` on the same origin.

---

## Environment variables

| Name | Used by | Example |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `google-auth.ts`, `google-callback.ts`, `send-email.ts` | `123-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | same | `GOCSPX-…` |
| `GOOGLE_REDIRECT_URI` | same | `https://your-site.netlify.app/.netlify/functions/google-callback` |
| `APP_URL` | `google-callback.ts` (for the post-OAuth redirect back to the app) | `https://your-site.netlify.app` |

All four must be set on both **local** (`.env`) and **production** (Netlify dashboard) — otherwise the Functions return `500: Google OAuth env vars missing.`

---

## License

Private project. All rights reserved.
