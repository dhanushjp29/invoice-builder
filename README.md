# Invoice Builder

A modern, fully client-side Invoice Builder built with **React 19**, **TypeScript**, and **Vite 8**. Create, manage, preview, and send professional GST-aware invoices — all from the browser, with no backend account required. Gmail sending is handled by lightweight Netlify Functions; everything else lives in the browser (`localStorage` for invoice JSON + `IndexedDB` for file blobs).

Deployed on Netlify with code-split bundles for fast first paint, and a **mobile-responsive UI** that adapts down to ~320 px viewports while keeping the desktop layout untouched at lg+ (≥ 1024 px).

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Application flow](#application-flow)
5. [Routing map](#routing-map)
6. [Data model](#data-model)
7. [Storage layer](#storage-layer)
8. [GST + tax logic](#gst--tax-logic)
9. [Invoice numbering + dedupe](#invoice-numbering--dedupe)
10. [Status state machine](#status-state-machine)
11. [Mobile responsiveness](#mobile-responsiveness)
12. [Onboarding tour](#onboarding-tour)
13. [Components — file by file](#components--file-by-file)
14. [Utilities — file by file](#utilities--file-by-file)
15. [Database layer — file by file](#database-layer--file-by-file)
16. [Hooks](#hooks)
17. [Type system](#type-system)
18. [Netlify Functions](#netlify-functions)
19. [Gmail OAuth + send flow](#gmail-oauth--send-flow)
20. [PDF generation pipeline](#pdf-generation-pipeline)
21. [Mobile-responsive email HTML](#mobile-responsive-email-html)
22. [Code-splitting + bundle strategy](#code-splitting--bundle-strategy)
23. [Notifications system](#notifications-system)
24. [Local development](#local-development)
25. [Deployment to Netlify](#deployment-to-netlify)
26. [Environment variables](#environment-variables)
27. [Dev conveniences](#dev-conveniences)

---

## Features

### Invoicing
- **No-account invoicing** — every invoice is stored locally in the user's browser (`localStorage` for JSON + `IndexedDB` for file blobs). No login wall, no cloud database.
- **GST-aware totals** — automatic CGST/SGST split for intra-state, IGST for inter-state, zero-rated for exports. India-only logic disabled gracefully for non-Indian sellers (single "Tax Amount" row instead of CGST/SGST/IGST).
- **Auto-generated invoice numbers** — financial-year-aware (April–March), per-prefix sequence, with built-in dedupe and draft-renumbering, and conflict-bumping for racing tabs.
- **Editable invoice-number prefix** — the prefix is user-editable and persisted; the year + 4-digit sequence are auto-generated and read-only.
- **Discount engine** — invoice-level discount, percentage or flat amount, applied proportionally to each line item's taxable amount **before** GST.
- **Round-off** — manual ± input plus an "Auto" button that picks the smallest round-off needed to reach a whole rupee/dollar.
- **Amount in words** — Indian numbering (Lakhs / Crores) for INR, Western (Thousand / Million / Billion) for every other currency.
- **10 currencies** — INR, USD, EUR, GBP, AED, SGD, JPY, CNY, CAD, AUD — each with its own symbol and word-units.
- **Two invoice list views**:
  - **All Invoices** — summary table with Excel-style multi-column filters, cascade unique-value pickers, sorting, pagination, per-row PDF download, and delete-with-confirm.
  - **Detailed Invoice** — line-item breakdown table with the same filter/sort/paginate machinery (34 columns total).
- **Excel export** — both summary and detailed workbooks via ExcelJS, with styled headers, alternating row backgrounds, frozen first row, auto-filter, status color-coding, and number formatting. ExcelJS + file-saver are lazy-loaded inside the export functions.
- **PDF export + print** — html2pdf-based generation, lazy-loaded so first-load is fast. "Print" opens the generated PDF in a new tab so the browser's native PDF viewer handles Ctrl+P cleanly (no app chrome, no browser headers).
- **File attachments per invoice** — drag-and-drop or file-picker; stored as native Blobs in IndexedDB (no base64 bloat); per-file "Include In Mail" toggle to decide what rides along with the email; view in new tab or force-download.

### Email
- **Inbuilt Gmail sender** — connect a Gmail account via Google OAuth (server-side exchange in a Netlify Function); send the invoice as embedded HTML + PDF + optional extra attachments, using `gmail.users.messages.send` (not SMTP — the `gmail.send` OAuth scope authorizes this path directly).
- **Mobile-responsive email** — the sent HTML uses a `@media (max-width: 600px)` rule so phones render the message cleanly while desktop stays at 780 px.
- **Cycle tracking** — sending again after edit bumps `cycleCount`; the badge then shows "Mail Sent (2)", "Modified (2)", etc.

### UX
- **Onboarding tour** — 15-step react-joyride walkthrough that triggers once per browser; auto-pauses on route changes, auto-resumes when the right page mounts; has a `TARGET_NOT_FOUND` auto-advance safety net so the tour never hangs.
- **Splash screen** — pure CSS animation, inline SVG mark, gradient background, character-by-character title reveal. Plays once per tab session.
- **Lottie loaders (WebM)** — fullscreen blurred overlay with a `<video>` player. Runs on the browser's media pipeline (off the main thread), so it **never freezes** during PDF generation. 1-second minimum visible time so sub-second operations don't flash.
- **Toaster** — react-hot-toast with a unified white-card style; success/error/info/warning/loading/promise/upload variants; consistent durations.
- **Custom upload toast** — per-file Tailwind progress bar that animates while the IndexedDB write is in flight, then flips to success / error.
- **Navigation guard** — three-button modal (Save / Save as Draft / Don't Save) appears when leaving a dirty editor.
- **Auto-seed** — 5 demo invoices covering every status (saved / mail-sent / modified / draft) and every GST scenario (intra-state, inter-state, export), inserted on first load. INV0001 ships with a real PDF attachment stored in IndexedDB.
- **Persistent UI state** — search / filter / sort / pagination on every list view persists across navigation via `sessionStorage` (wipes on tab close).
- **Auto-fill on new invoice** — company identity (name, logo, GST, address, seal, signature, bank account) carries over from the most recent saved invoice, so users don't retype it.

### Mobile responsiveness
- **Invoice list** — sidebar nav becomes a top pill-bar on mobile; tables wrap in `overflow-x-auto` with explicit `min-width` so they horizontally scroll cleanly.
- **Editor sidebar** — vertical sticky sidebar on lg+; **horizontal scrollable card strip** above the editor on mobile, with shared state (search + page) between the two layouts.
- **Form sections** — every card uses `p-4 sm:p-6` padding, grids fall to single-column under `sm:`.
- **Preview + Mail pages** — the fixed-width A4 invoice gets wrapped in `overflow-x-auto` with `min-width: 720 px` so it scrolls horizontally instead of squashing; a "← swipe to see the full invoice →" hint shows under `sm:`.
- **Compose form labels** — mail compose rows stack label-above-input on mobile, inline on desktop.
- **DatePicker popup** — anchors to the input's right edge on mobile and clamps to `calc(100vw - 24px)` so it never overflows the screen.
- **Toasts / upload toasts** — capped at `calc(100vw - 32px)` so they never reach the screen edges.

---

## Tech stack

### Runtime

| Layer | Tech |
|---|---|
| UI framework | **React 19.2** with `StrictMode` |
| Language | **TypeScript ~6.0** (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`) |
| Bundler | **Vite 8.0** (rolldown-based) |
| Styling | **Tailwind CSS 4.3** via `@tailwindcss/vite` (CSS-first config) |
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
| `eslint-plugin-react-refresh` | Fast Refresh compatibility checks |

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
│   ├── favicon.ico                 # PWA icons + manifest
│   ├── site.webmanifest
│   └── lottie/
│       ├── loader-common.webm      # Used by export/save/PDF spinners
│       └── loader-email.webm       # Used by send-email spinner
├── src/
│   ├── main.tsx                    # Entry; bouncer 5173 → 8888 in dev
│   ├── App.tsx                     # Routes, splash, toaster, OnboardingTour, boot side-effects
│   ├── index.css                   # Tailwind imports + global hide of number-input spinners
│   ├── App.css                     # Legacy global styles (empty / unused)
│   │
│   ├── components/                 # 25 UI components
│   │
│   ├── db/                         # Persistence layer
│   │   ├── invoiceDB.ts            # localStorage CRUD, numbering, dedupe, blank invoice factory
│   │   ├── attachmentStore.ts      # IndexedDB blob store for attachments
│   │   ├── autoSeed.ts             # First-run demo invoices (5 records)
│   │   ├── seedAssets.ts           # Base64-embedded demo logo/seal/sig/PDF
│   │   └── migrateAttachments.ts   # One-shot legacy data:URL → IndexedDB migration
│   │
│   ├── hooks/
│   │   └── usePersistentState.ts   # useState mirrored into sessionStorage
│   │
│   ├── types/
│   │   ├── invoice.ts              # InvoiceDocument, LineItem, Attachment, enums (currency, tax, UOM, …)
│   │   └── html2pdf.d.ts           # Type shim for html2pdf.js
│   │
│   ├── utils/
│   │   ├── recalculate.ts          # Pure totals + tax recomputation engine
│   │   ├── pdfExport.ts            # html2pdf wrappers (lazy-loaded): downloadPdf, generatePdfBlob, printAsPdf
│   │   ├── pdfBase64.ts            # Blob → base64 helper for mail
│   │   ├── gmailClient.ts          # Frontend OAuth client + sender
│   │   ├── attachmentView.ts       # Open Blob in new tab / force-download with real filename
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
                            │  - dedupe       │ every boot
                            │  - preload      │ Lottie HTTP cache
                            │  - <Toaster>    │
                            │  - <Tour>       │ first run (lazy)
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
   │   - send    │            │  │ /            │──┼──> InvoiceList (All / Detailed)
   │   - PDF gen │            │  │ /invoice/:id │──┼──> Sidebar + Editor
   │   - mark    │            │  │ ../preview   │──┼──> Sidebar + PrintView + PreviewBar
   │     mail-   │            │  └──────────────┘  │
   │     sent    │            └────────────────────┘
   └─────────────┘
   /privacy-policy            → PrivacyPolicy
   /terms-and-conditions      → TermsAndConditions
```

### Boot sequence (App.tsx, in order, on every mount)

1. **`captureOAuthRedirect()`** — if the URL hash is `#gmail-connected?refresh_token=…&email=…`, parse and save to `localStorage`, then strip the hash with `history.replaceState`.
2. **`migrateLegacyAttachments()`** — one-shot: scan invoices for inline base64 `data:` attachments, decode them to Blobs, write them to IndexedDB, rewrite the invoice with a `blobId`, and delete the heavy `data` field. Guarded by `localStorage.attachmentStore_migrationV1 = 'done'`.
3. **`autoSeed()`** — on first run, insert 5 demo invoices (`INV2026-0001` through `INV2026-0005`) covering every status and GST scenario. Has a `seedingInFlight` in-memory lock so StrictMode double-mount in dev can't seed twice. Self-heals if the flag is set but the DB is empty. Skips entirely if the user already has non-demo invoices.
4. **`dedupeInvoiceNumbers()`** — scans the collection and renumbers any duplicate invoice numbers (drafts first, non-drafts keep their number). Idempotent.
5. **`preloadLottieAssets()`** — `fetch(url, { cache: 'force-cache' })` for both loader videos to warm the HTTP cache so the overlay paints instantly the first time the user triggers a long operation.

After splash fades, `OnboardingTour` mounts (`React.lazy()`-loaded). It self-gates on `localStorage.invoiceBuilder.tour.v4 === '1'` and only runs on the list route (`/`).

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
                  Click Preview ── if dirty → NavGuardModal (Save / Save as Draft / Don't Save / Cancel)
                       │
                  /invoice/:id/preview ── InvoicePrintView + PreviewBar (Mail / Print / PDF / Edit)
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
                                  Auto-redirect to preview
```

---

## Routing map

| Path | Component | Notes |
|---|---|---|
| `/` | `InvoiceBuilder → InvoiceList` | List screen (All / Detailed tabs) |
| `/invoice/:id` | `InvoiceBuilder` (editor) | Sidebar + editor form; `:id = 'new'` for unsaved invoices |
| `/invoice/:id/preview` | `InvoiceBuilder` (preview) | Sidebar + PrintView + PreviewBar |
| `/invoice/:id/mail` | `MailPreview` | Standalone composer screen, has its own header |
| `/privacy-policy` | `PrivacyPolicy` | Required for Google OAuth verification |
| `/terms-and-conditions` | `TermsAndConditions` | Required for Google OAuth verification |
| `/*` (fallback) | `InvoiceBuilder` | Same component matches everything not above |

A Netlify redirect (`/* → /index.html status=200`) in [netlify.toml](netlify.toml) handles SPA fallback in production. `force = false` (default) means static files are served first — only unknown routes fall back to the SPA, so `/assets/*` keeps working.

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
  taxAmount: number;              // sum of CGST + SGST + IGST (legacy field, still computed)
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
  uom: UOM | string;              // preset or custom (session-only)
  quantity: number;
  unitRate: number;
  tax: TaxType;                   // 'None' | 'GST 5/12/18/28%' | 'IGST 5/12/18/28%'
  taxRate: number;                // numeric % (e.g. 18) — authoritative

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
  data?: string;                  // legacy: inline data: URL (pre-migration; stripped after migrate)
  includeInMail?: boolean;        // user-tickable on the editor
}
```

### Additional charge

```ts
interface AdditionalCharge {
  _id: string;
  type: AdditionalChargeType;     // preset or 'Other' for custom labels
  label: string;
  amount: number;
}
```

### Location data

```ts
interface LocationData {
  country: string;                // ISO code (e.g. 'IN', 'US')
  state: string;                  // ISO state code (e.g. 'TN', 'CA')
  city: string;
  pincode: string;
}
```

### Account details

```ts
interface AccountDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;            // optional
}
```

The invoice document itself is plain JSON in `localStorage`. Only file *bytes* live in IndexedDB — the JSON carries a `blobId` pointer.

---

## Storage layer

| Where | Key / DB | What | Why |
|---|---|---|---|
| `localStorage` | `invoiceDB_invoices` | The whole `InvoiceDocument[]` as JSON | Synchronous, simple, ~5 MB ceiling — plenty for hundreds of invoices |
| `localStorage` | `invoiceDB_prefix` | User's custom invoice prefix (default `"INV"`) | Persists across sessions, used by every new number |
| `localStorage` | `invoiceBuilder.autoSeeded.v4` | Boolean flag — has demo data been seeded? | Prevents re-seeding |
| `localStorage` | `attachmentStore_migrationV1` | Boolean — has the legacy inline-base64 migration run? | One-shot guard |
| `localStorage` | `invoiceBuilder.tour.v4` | Boolean — has the user completed the tour? | First-run gate |
| `localStorage` | `gmail_refresh_token`, `gmail_connected_email` | OAuth credentials | Single-user, single-device tool — acceptable for this app |
| `sessionStorage` | `invoiceList.all.*`, `invoiceList.detailed.*`, `invoiceList.view` | List view search/filter/sort/pagination + tab choice | Persists across navigation, wipes on tab close |
| `sessionStorage` | `splashShown` | Boolean — splash already played this tab? | Prevents replay on SPA route changes |
| `IndexedDB` | db `invoiceBuilderAttachments`, store `files` | `{ id, blob, createdAt }` per attachment | Raw `Blob` storage — no base64 bloat, gigabytes of headroom |

### Why two storage backends?

`localStorage` stores strings only, so attaching a 5 MB PDF means base64-encoding it to ~6.7 MB and parking it inside the invoice JSON. That bloated the invoice list query (every load reparses the whole collection), pushed multiple invoices over the 5 MB origin limit, and made `JSON.stringify` painfully slow.

IndexedDB stores native `Blob` objects with no encoding. Each attachment is a separate record keyed by UUID; the invoice JSON only carries the UUID. Save and read are O(1) regardless of file size, and writes are async so they never block the main thread.

### Storage events

Two custom DOM events keep multiple component subtrees in sync without prop-drilling:

- **`invoiceDB:seeded`** — fired by `autoSeed.ts` after demo data is written. `InvoiceBuilder` listens and refreshes its `allInvoices` snapshot.
- **`invoiceDB:changed`** — fired by `invoiceDB.ts` when `bumpConflictingDrafts()` renumbers drafts under the user. Same listener.
- **`gmail-connection-changed`** — fired by `gmailClient.ts` when connect/disconnect happens. `MailPreview` listens and updates its connection state.

---

## GST + tax logic

Computed in [src/utils/recalculate.ts](src/utils/recalculate.ts) — pure function, no side effects, no I/O. Called on every edit via the wrapped `setInvoice` updater in `InvoiceBuilder`.

### Step 1 — Classify the invoice

```ts
isExport      = companyCountry === 'IN' && billingCountry && billingCountry !== 'IN'
isIntraState  = !isExport && companyState === billingState
```

- **Export** → all line-item taxes set to 0, "EXPORT INVOICE" + "Zero Rated Supply" badges in PDF.
- **Intra-state** → tax rate split 50/50 into CGST + SGST.
- **Inter-state** → full rate goes to IGST.
- **Missing state** → defaults to intra-state (graceful default for in-progress forms).

### Step 2 — Apply discount

Discount is applied at the **invoice level** before tax. A line item's share of the discount is proportional to its share of the pre-discount subtotal:

```ts
weight        = (qty * rate) / subtotal
taxableAmount = (qty * rate) − discountAmount * weight
```

This means a 10 % invoice discount reduces every line's taxable amount by 10 %, so the GST is computed on the post-discount value. Capped at `subtotal` so users can't go negative.

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

Each value rounded to 2 decimal places via `round2()` (banker-friendly rounding via `Math.round(n * 100) / 100`).

### Step 4 — Roll up to invoice totals

```ts
grandTotal = discountedSubtotal
           + totalCGST + totalSGST + totalIGST
           + additionalChargesTotal
           + roundOff;
```

### Step 5 — Auto round-off

[InvoiceTotals.tsx](src/components/InvoiceTotals.tsx) has an "Auto" button that picks the smallest ± round-off needed to reach a whole rupee/dollar. The user can also flip the sign and override the magnitude manually.

### Non-Indian sellers

If `companyLocation.country !== 'IN'`, GST/IGST is hidden entirely from the totals UI ([InvoiceTotals.tsx](src/components/InvoiceTotals.tsx)) and the print view ([InvoicePrintView.tsx](src/components/InvoicePrintView.tsx)) shows a single "Tax Amount" row — the pure tax-calc logic still runs (in case a non-IN seller types a custom `taxRate`), it's just collapsed in the UI.

### Amount in words

[InvoiceTotals.tsx](src/components/InvoiceTotals.tsx) renders the grand total as words. INR uses **Indian numbering** (Lakhs / Crores), every other currency uses **Western numbering** (Thousand / Million / Billion). Each currency has its own major/minor units (`Rupees / Paise`, `Dollars / Cents`, `Yen / Sen`, etc.).

---

## Invoice numbering + dedupe

Implemented in [src/db/invoiceDB.ts](src/db/invoiceDB.ts).

### Format

```
{prefix}{FY_YEAR}-{NNNN}    e.g. INV2026-0001
```

- **prefix** — user-editable, default `"INV"`, persisted in `localStorage.invoiceDB_prefix`. Normalised to uppercase, max 6 chars, alphanumeric only.
- **FY year** — Indian financial year start year. Jan–Mar of year *N* is FY *N − 1*; Apr–Dec of year *N* is FY *N*.
- **NNNN** — 4-digit sequence, incremented per FY across **all** invoices (drafts included), so two invoices can never share a slot.

### Functions

| Function | Purpose |
|---|---|
| `generateInvoiceNumber()` | Scan every invoice with the current FY prefix, return `max(seq) + 1` padded to 4 digits. |
| `invoiceNumberExists(number, excludeId?)` | Look for collisions. `excludeId` skips the document being saved. |
| `reconcileDraftNumber(doc)` | When loading a draft, keep its stored number unless it's blank or collides with another invoice. |
| `dedupeInvoiceNumbers()` | One-shot cleanup at app boot: scan the whole collection, renumber any duplicates. Drafts get renumbered before non-drafts. Idempotent. Returns the count of changes. |
| `bumpConflictingDrafts(collection, takenNumber)` | When a non-draft is saved with number X, push any drafts holding X to the next free slot. Mutates `collection` in place, fires `invoiceDB:changed` so the UI refreshes. |

### Why so much machinery?

Without it, a user could:
1. Create draft 0005.
2. Open a second tab, create another invoice — also gets 0005 because drafts weren't being counted by `generateInvoiceNumber()`.
3. Save both — the user now has two visible rows with `INV2026-0005`.

The current logic prevents this end-to-end: drafts are counted in the sequence calculation, non-draft saves bump conflicting drafts, and `dedupeInvoiceNumbers()` on boot heals any pre-existing duplicates from older versions.

---

## Status state machine

| Status | When | Editable | Deletable | Badge color | Label |
|---|---|---|---|---|---|
| `draft` | Manual "Save as draft" via NavGuardModal | yes | yes | amber | "Draft" |
| `saved` | After `Save` (validated) | yes | yes | green | "Created" |
| `mail-sent` | After successful email send | yes (→ `modified`) | **no** (audit trail) | blue | "Mail Sent" / "Mail Sent (N)" |
| `modified` | Edit a `mail-sent` invoice | yes (→ `modified`) | **no** (audit trail) | orange | "Modified" / "Modified (N)" |

Editing a `mail-sent` invoice automatically flips it to `modified` (handled in `setInvoice` wrapper, [InvoiceBuilder.tsx](src/components/InvoiceBuilder.tsx)). Sending again bumps `cycleCount` and flips back to `mail-sent`. The badge shows `Mail Sent (2)`, `Modified (3)`, etc., once N ≥ 2.

The "no delete after mail-sent" rule is enforced in **three places**:
1. UI hides the delete button.
2. `deleteOne()` in `invoiceDB.ts` rejects the call as a last-line-of-defence.
3. The list table shows a "Locked" pill instead of delete for sent invoices.

---

## Mobile responsiveness

Built on Tailwind 4 breakpoints (`sm: 640 px`, `md: 768 px`, `lg: 1024 px`, `xl: 1280 px`). **PC view at lg+ is byte-identical to the original layout**; every responsive class is a `sm:` / `md:` / `lg:` modifier added alongside the original.

### Strategy per screen

| Screen | Mobile (< lg) | Desktop (lg+) |
|---|---|---|
| **InvoiceList outer** | `flex-col` — view nav becomes a top pill-bar | `flex-row` — view nav is a vertical sidebar |
| **All Invoices table** | `overflow-x-auto` + `min-w-[820px]` — horizontal scroll | Full table inline |
| **Detailed table** | Same horizontal scroll pattern (already had `min-w-275`) | Full table inline |
| **InvoiceBuilder outer (editor)** | `flex-col` — sidebar strip above editor | `flex-row` — sticky sidebar to the left |
| **InvoiceSidebar** | Horizontal card strip with same search + new + pagination | Vertical sticky column (original) |
| **InvoiceHeader / ClientInfo / AccountDetails / LineItemsTable / AdditionalCharges / FileAttachments / InvoiceTotals** | `p-4` / `px-4` padding | `p-6` / `px-6` padding |
| **LineItemsTable** | `overflow-x-auto` + `min-w-225` — already responsive | Inline table |
| **FileAttachments rows** | Stacked: icon+name+remove on top, Include In Mail + View + Download below | All in one row |
| **PreviewBar** | "Invoice Preview" label hidden, action buttons wrap | Full label + buttons inline |
| **Preview / Mail invoice display** | `overflow-x-auto` + `min-w-180` (720 px) + "← swipe" hint | Inline at native A4 size |
| **MailPreview compose rows** | Label-above-input (`flex-col sm:flex-row`) | Inline `w-16` label + input |
| **DatePicker popup** | Anchored to input's right edge, clamped to `calc(100vw - 24px)` | Anchored left, fixed `w-72` |
| **UploadToast / global Toaster** | `max-w-[calc(100vw-32px)]` | `w-80` |

### Onboarding tour behavior

The 15-step tour now works on every viewport. Step 6 targets the sidebar — which on mobile is the horizontal card strip, on desktop is the vertical column. The same `[data-tour="sidebar-list"]` selector matches both layouts, so the tour proceeds identically.

A `TARGET_NOT_FOUND` safety net (one retry after 600 ms, then auto-advance) catches any future desktop-only targets so the tour never hangs behind a stuck overlay.

---

## Onboarding tour

15-step react-joyride walkthrough implemented in [OnboardingTour.tsx](src/components/OnboardingTour.tsx). Custom tooltip component (`TourTooltip`) replaces Joyride's default, with:

- Numbered badge (`1/15`, `2/15`, …)
- Per-step emoji + gradient accent color
- Progress bar
- "Click X to continue" CTA banner on the 3 CTA steps (5, 11, 13)
- Custom Skip / Back / Next / "Let's go!" buttons

### CTA steps

Three steps are **CTA-only** — they pause Joyride and wait for the user to navigate themselves by clicking the highlighted target:

| Step | Target | User action |
|---|---|---|
| 5 | `[data-tour-row="INV2026-0001"]` | Click the row → navigates to `/invoice/:id` |
| 11 | `[data-tour="preview-btn"]` | Click "Preview" → navigates to `/invoice/:id/preview` |
| 13 | `[data-tour="mail-btn"]` | Click "Mail" → navigates to `/invoice/:id/mail` |

The route-watcher `useEffect` is the only signal the tour gets that the user has acted — Joyride emits no event for the click. On route change, it advances the step and re-shows the tooltip.

### CSS-controlled interactivity

`body[data-tour-step="N"]` is set whenever the tour is running. CSS rules in the tour component then dim and disable non-target elements:

- **Step 5** — only `INV2026-0001` row is clickable; every other row is dimmed and pointer-events-none. The export button is forced non-interactive via `pointer-events: none !important` because the Joyride spotlight punches through `::after` overlays for single interactive elements.
- **Steps 3, 4, 7, 8, 9, 10, 12, 14** — read-only tour steps; a transparent `::after` glass pane blocks clicks on the highlighted target.

### Route gating

A `STEP_ROUTES` map declares which route each step lives on:

```ts
const STEP_ROUTES: Record<number, RegExp> = {
  0: /^\/$/, 1: /^\/$/, 2: /^\/$/, 3: /^\/$/, 4: /^\/$/, 5: /^\/$/,
  6: /^\/invoice\/[^/]+$/, 7: /^\/invoice\/[^/]+$/, ...
  12: /^\/invoice\/[^/]+\/preview$/, 13: /^\/invoice\/[^/]+\/preview$/,
  14: /^\/invoice\/[^/]+\/mail$/,
};
```

If the user is on the wrong route for the current step, the tour pauses. When they navigate to the right route, the route-watcher resumes it.

### Going Back across routes

Pressing "Back" on a step that lives on a different route actively navigates to the previous route so the next step's target exists — e.g. Back from step 12 (preview) to step 11 (editor) calls `navigate(location.pathname.replace(/\/preview$/, ''))`.

### StrictMode survival

The initial `setRun(true)` is deferred via a two-phase guard: a `useEffect` sets `mounted=true`, and a second effect (gated on `mounted`) schedules the 500 ms kickoff. Without this, StrictMode's cleanup on the first mount cancels the timer before the second mount can reschedule it.

---

## Components — file by file

| File | Purpose |
|---|---|
| [App.tsx](src/App.tsx) | Root routes, splash gate (sessionStorage), global Toaster, lazy `OnboardingTour`, boot effects (OAuth capture, migrate, autoSeed, dedupe, Lottie preload). |
| [main.tsx](src/main.tsx) | React entry. Bounces port `:5173` → `:8888` in dev (with a `throw` to abort the doomed render) so Netlify Functions are reachable. |
| [InvoiceBuilder.tsx](src/components/InvoiceBuilder.tsx) | Top-level editor: parses ID from URL, loads/creates invoice, renders header + sidebar + form sections (or preview), wires Save / Preview / Print / PDF / Mail buttons, manages `isDirty`, validation errors, nav-guard modal. Has the `setInvoice` wrapper that auto-flips `mail-sent` → `modified` on any edit. Handles Ctrl+P/Cmd+P → print-as-PDF when saved. |
| [InvoiceList.tsx](src/components/InvoiceList.tsx) | List screen with two tabs (`All Invoices` / `Detailed Invoice`). Excel-style multi-column filters with cascade unique values, sorting, pagination, per-row PDF download, delete-with-confirm, XLSX export. ExcelJS + file-saver are lazy-loaded inside the export functions. Has its own `Pagination`, `DropdownSelect`, `ExcelFilterMenu`, `DateFilterStrip` sub-components. Centralised export overlay + toast manager (`runExport`, `runOverlay`). |
| [InvoiceSidebar.tsx](src/components/InvoiceSidebar.tsx) | Dual-layout sidebar — vertical sticky column at lg+, **horizontal scrollable card strip** under lg. Shared search + page state. Searchable across invoice number, client name, project, status, and parsed date components (day, full date, month name, month short, year). |
| [InvoiceHeader.tsx](src/components/InvoiceHeader.tsx) | Top form section: company logo + name + GST + email + phone, editable invoice-number prefix (year + 4-digit seq locked), invoice/due dates, PO / project / e-way bill, currency selector, company location, transport details, seal + signature uploads. |
| [InvoicePrintView.tsx](src/components/InvoicePrintView.tsx) | Print-ready invoice rendered as a table-based layout (so it survives Gmail/Outlook MIME inlining). Used in: preview screen, hidden `print:block` clone, source DOM for both PDF generation and the mail HTML body. Renders a "Ship To" block, transport row (only when filled), CGST/SGST/IGST split or single Tax row based on `isExport` + `isIndianSeller`, bank account block, seal + signature row. |
| [InvoiceTotals.tsx](src/components/InvoiceTotals.tsx) | Subtotal → discount → CGST/SGST/IGST (or single Tax row for non-IN) → additional charges → round-off → grand total panel. Discount type toggle (% / amount), Auto round-off picker, ± sign toggle. Plus notes / terms / payment-method fields with custom method support (creatable combobox). Amount-in-words generator with Indian + Western numbering. |
| [LineItemsTable.tsx](src/components/LineItemsTable.tsx) | Editable line items table. Description is an autocomplete-creatable combobox seeded from every saved invoice's items; UOM combobox supports custom units kept in session state; per-row delete; merge-into-twin button when a duplicate description is detected. Hides Tax columns when `isExport` is true. |
| [AdditionalCharges.tsx](src/components/AdditionalCharges.tsx) | Repeatable list of named non-tax charges (freight, installation, etc.) — type-creatable combobox + amount field. Detects duplicate labels and surfaces "Sum into existing / Delete this row" inline. Session-only custom labels. |
| [ClientInfo.tsx](src/components/ClientInfo.tsx) | Client name / address / GST / email / phone, client location, optional separate delivery address with "Same as billing" toggle. |
| [AccountDetails.tsx](src/components/AccountDetails.tsx) | Bank account fields for payment instructions on the invoice (account holder, bank name, account number, IFSC, branch — branch optional). |
| [FileAttachments.tsx](src/components/FileAttachments.tsx) | Drag-and-drop / file-picker for invoice attachments. Each file goes straight to IndexedDB via `putAttachment()`; the invoice carries metadata + `blobId`. Per-file "Include In Mail" checkbox decides what rides along with the email. View / Download / Remove buttons. View opens PDFs / images / video / audio / text inline in a new tab; other types are force-downloaded with the real filename. Stacked layout on mobile. |
| [LocationSelector.tsx](src/components/LocationSelector.tsx) | Country / State / City / Pincode group. `country-state-city` (8.7 MB of geographic JSON) is dynamic-imported on mount so it never blocks first paint. Cross-search across all states / cities globally when no country is selected. |
| [Combobox.tsx](src/components/Combobox.tsx) | Generic searchable dropdown with **portal-rendered popup**, keyboard nav (↑↓ Enter Esc), optional `creatable` mode for free-text values. Two visual variants: `default` (bordered input) and `cell` (borderless, used inside `LineItemsTable`). Repositions popup on scroll/resize. Outside-click commits creatable free text. |
| [DatePicker.tsx](src/components/DatePicker.tsx) | Custom YYYY-MM-DD picker. Calendar grid with month/year jump (`Combobox` for month, number input for year), Today + Clear buttons, no native browser styling. Popup anchors right on mobile to prevent off-screen overflow. |
| [LogoUpload.tsx](src/components/LogoUpload.tsx) | Company logo uploader with preview + Change/Remove buttons. Stores as `data:` URL on the invoice document (small images only). |
| [ImageUploadField.tsx](src/components/ImageUploadField.tsx) | Generic image uploader used for company seal + authorised signature. Same data:URL approach as LogoUpload. |
| [PreviewBar.tsx](src/components/PreviewBar.tsx) | Action bar shown above `InvoicePrintView` on the preview route — Mail / Print / Download PDF / Back-to-editor. Hides the "Invoice Preview" label on mobile to give buttons full width. |
| [NavGuardModal.tsx](src/components/NavGuardModal.tsx) | Three-button modal shown when navigating away from a dirty editor: **Save as Draft** / **Save** / **Don't Save** + Cancel (✕). Buttons available depend on the invoice's current case (`new` / `draft` / `saved`). |
| [SplashScreen.tsx](src/components/SplashScreen.tsx) | Boot splash — pure CSS animation, inline SVG mark, gradient background, character-by-character title reveal, progress bar shimmer. No assets, no network. Plays once per tab (gated by `sessionStorage.splashShown`). Respects `prefers-reduced-motion`. |
| [LottieLoader.tsx](src/components/LottieLoader.tsx) | Fullscreen blurred overlay with a `<video>` WebM player. Off the main thread so it never freezes during PDF generation. 1-second minimum visible time so sub-second operations don't flash. Renders at native intrinsic resolution (no upscaling). Locks body scroll while visible. Variants: `common` and `email`. |
| [lottieAssets.ts](src/components/lottieAssets.ts) | URLs for the WebM loaders + `preloadLottieAssets()` HTTP-cache warmer. |
| [MailPreview.tsx](src/components/MailPreview.tsx) | Email composer screen. Compose To / Subject / Message; PDF generated from `#invoice-print-area`; sends via `gmailClient.sendInvoiceEmail()` to the Netlify Function; on success, flips the invoice to `mail-sent` and bumps `cycleCount`. Builds the mobile-responsive HTML body (see below) with `<style>` media query + per-element inline-style fallbacks for clients that strip `<style>`. Connect / Disconnect Gmail controls. |
| [OnboardingTour.tsx](src/components/OnboardingTour.tsx) | 15-step react-joyride product tour. Routes auto-advance on `location.pathname` change; CTA steps (5/11/13) wait for the user to navigate themselves. `body[data-tour-step]` is set so CSS can restrict interaction. `TARGET_NOT_FOUND` retry + auto-skip safety net. Lazy-loaded via `React.lazy()`. |
| [UploadToast.tsx](src/components/UploadToast.tsx) | Custom react-hot-toast renderer with an animated progress bar — used by `notify.upload(fileName, work)`. Easing curve hits ~90 % while pending, snaps to 100 % on resolve. |
| [PrivacyPolicy.tsx](src/components/PrivacyPolicy.tsx) | Static privacy policy page. Required for Google OAuth verification. Responsive padding (`p-5 sm:p-8 md:p-12`). |
| [TermsAndConditions.tsx](src/components/TermsAndConditions.tsx) | Static T&C page. Required for Google OAuth verification. |

---

## Utilities — file by file

| File | Purpose |
|---|---|
| [utils/recalculate.ts](src/utils/recalculate.ts) | Pure totals + tax engine (see [GST logic](#gst--tax-logic)). Single export `recalculate(inv) → inv`. Helper `round2(n)`. |
| [utils/pdfExport.ts](src/utils/pdfExport.ts) | Three lazy-loaded helpers. `downloadPdf(filename)` triggers Save-As. `generatePdfBlob(filename)` returns a Blob (used by the mail flow) — must call `.toPdf()` before `.output('blob')` because `.output('blob')` on its own returns the canvas data, not a PDF. `printAsPdf(filename)` opens the generated PDF in a new tab for clean printing; falls back to download if popups are blocked. Shared `PDF_OPTIONS` block. |
| [utils/pdfBase64.ts](src/utils/pdfBase64.ts) | `blobToBase64(blob)` — strips the `data:…;base64,` prefix. Used to ship the PDF over JSON to the Netlify function. |
| [utils/gmailClient.ts](src/utils/gmailClient.ts) | Frontend Gmail interface. `getConnection()` / `saveConnection()` / `disconnect()` localStorage helpers. `startGmailConnect()` redirects to `/google-auth?returnTo=…`. `captureOAuthRedirect()` reads the `#gmail-connected?…` hash and saves credentials, then strips the hash. `sendInvoiceEmail(args)` POSTs JSON to `/send-email`. Hard error if running on Vite dev server (port 5173) where Functions don't exist. |
| [utils/attachmentView.ts](src/utils/attachmentView.ts) | `openAttachmentInNewTab(blob, fileName)`: PDFs / images / video / audio / text / json / xml open inline in a new tab via `blob:` URL; everything else (DOCX, XLSX, ZIP) is force-downloaded via a hidden `<a download="real-name">` so the OS saves the real filename, not the random blob ID. |
| [utils/invoiceStatus.ts](src/utils/invoiceStatus.ts) | `statusLabel(inv)` returns "Draft" / "Created" / "Mail Sent" / "Mail Sent (2)" / "Modified" / "Modified (3)" based on `status` + `cycleCount`. `statusColors(status)` returns the Tailwind `{ bg, text, border, dot }` token bundle for badge styling. Centralised palette. |
| [utils/notify.ts](src/utils/notify.ts) | Single source of truth for toasts. Wraps react-hot-toast with consistent durations + the custom `notify.upload(file, work)` progress-bar variant. Variants: `success`, `error` (longer duration), `info`, `warning`, `loading`, `promise`, `dismiss`, `upload`. |

---

## Database layer — file by file

| File | Purpose |
|---|---|
| [db/invoiceDB.ts](src/db/invoiceDB.ts) | Synchronous localStorage CRUD: `findAll`, `findOne`, `insertOne`, `updateOne`, `deleteOne`. Invoice-number machinery: `generateInvoiceNumber()`, `invoiceNumberExists()`, `reconcileDraftNumber()`, `dedupeInvoiceNumbers()`, `bumpConflictingDrafts()`. Factory helpers: `createBlankInvoice()` (carries company identity from latest saved), `createLineItem()`, `createAdditionalCharge()`, `createAttachment(file, blobId)`. Prefix accessors: `getInvoicePrefix()`, `setInvoicePrefix()`. Enforces audit-trail (no delete on `mail-sent` / `modified`). Fires `invoiceDB:changed` events on draft renumbers. |
| [db/attachmentStore.ts](src/db/attachmentStore.ts) | IndexedDB wrapper. `putAttachment(blob) → blobId`, `putAttachmentWithId(id, blob)` (for the migration + autoSeed), `getAttachmentBlob(id)`, `deleteAttachment(id)`, `getAttachmentObjectUrl(id)`, `getAttachmentBase64(id)`. The DB (`invoiceBuilderAttachments`, version 1, store `files`) is opened lazily on first call via a cached `dbPromise`. |
| [db/autoSeed.ts](src/db/autoSeed.ts) | First-run demo seeder. Inserts 5 invoices covering every status, every GST state (intra-state TN→TN, intra-state MH→MH, export INR→USD, intra-state DL→DL with cycleCount=2, inter-state HR→UP draft). INV0001 has a real PDF attachment stored in IndexedDB and a fixed `_id` (`SEED_INV0001_ID`) so the tour can target it reliably. Has an in-memory `seedingInFlight` lock to defeat StrictMode double-mount. Self-heals if flag is set but DB is empty. Wipes ALL demo invoices if it detects duplicates from a prior bad run. Skips entirely if the user has any non-demo invoices. Window-global `resetSeed()` exposed for dev. |
| [db/seedAssets.ts](src/db/seedAssets.ts) | Auto-generated file holding base64-encoded demo logo / seal / signature / PDF — so seeding never needs a network fetch. |
| [db/migrateAttachments.ts](src/db/migrateAttachments.ts) | One-shot migration that scans every invoice for legacy inline `data:` attachments, decodes them to Blobs, writes them to IndexedDB, and rewrites the invoice with a `blobId` (deleting the heavy `data` field). Guarded by the `attachmentStore_migrationV1` flag. Safe to call on every boot. Doesn't set the flag if it crashes — retries next start. |

---

## Hooks

| File | Purpose |
|---|---|
| [hooks/usePersistentState.ts](src/hooks/usePersistentState.ts) | `useState` whose value is mirrored into `sessionStorage`. Survives component unmount + route navigation within the same browser tab; wipes when the tab closes. Key must be unique across the app (prefixed by screen: `invoiceList.all.search`, etc.). Reads once in the initial state factory, writes on every change (skipping the first effect so we don't immediately rewrite what we just read). |

---

## Type system

[src/types/invoice.ts](src/types/invoice.ts) defines every domain type and enum:

### Enums

- **`Currency`** — 10 codes (`INR`, `USD`, `EUR`, `GBP`, `AED`, `SGD`, `JPY`, `CNY`, `CAD`, `AUD`).
- **`CURRENCY_OPTIONS`** — `{ code, symbol, name }[]` for every currency.
- **`UOM`** — 27 units of measurement (Pcs, Nos, Kg, Ltr, Mtr, Sqft, Box, Hours, Days, etc.). Line items also accept session-only custom UOMs.
- **`TaxType`** — `'None' | 'GST 5/12/18/28%' | 'IGST 5/12/18/28%'`. Authoritative tax rate is the numeric `taxRate` field on the line item, not the string name (kept as legacy fallback for old saves).
- **`PaymentMethod`** — 10 presets + custom (any user-typed value).
- **`AdditionalChargeType`** — 8 presets (Freight, Loading, Unloading, Weighment, Packing, Handling, Installation, Insurance) + `'Other'` for any custom label.

### Document types

`InvoiceDocument`, `LineItem`, `Attachment`, `AdditionalCharge`, `AccountDetails`, `LocationData`, `DiscountType`.

### `html2pdf.d.ts`

Module-augmentation shim for `html2pdf.js` (no official types ship with the package).

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
- Sanitizes `state` so it's a same-origin relative path (`/...`, not `//evil.com/...`) — prevents being used as an open redirector.
- Redirects to `${APP_URL}${returnTo}#gmail-connected?refresh_token=…&email=…`. The **hash** (not query) keeps the token out of server-side request logs and referrer headers.

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

- Validates required fields, parses JSON, rejects non-POST.
- Builds an RFC 2822 message by hand:
  - Headers: `From`, `To`, `Subject` (RFC 2047 encoded-word for non-ASCII).
  - Body: base64-encoded HTML.
  - If attachments are present: `multipart/mixed` with a boundary token, one part per attachment, base64 line-wrapped to 76 chars.
- Encodes the whole thing as **URL-safe base64** (Gmail API requirement: `+ → -`, `/ → _`, strip `=` padding).
- Calls `gmail.users.messages.send({ userId: 'me', requestBody: { raw } })`.
- Returns `{ messageId }` on success, `{ error }` on failure (with the message from the caught error).

Why Gmail API and not SMTP: the `gmail.send` OAuth scope authorizes this path directly. There's no SMTP auth layer to fail with the dreaded `535-5.7.8 BadCredentials`. Same OAuth credential, less moving parts.

---

## Gmail OAuth + send flow

```
User clicks "Connect Gmail" on /invoice/:id/mail
   │
   │ window.location.href = /.netlify/functions/google-auth?returnTo=/invoice/:id/mail
   ▼
Google consent screen
   │
   │ user approves (with prompt=consent so refresh_token is always issued)
   ▼
Google → /.netlify/functions/google-callback?code=…&state=/invoice/:id/mail
   │
   │ exchange code → { access_token, refresh_token, … }
   │ fetch userinfo.email
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
   │ collect attachments where includeInMail=true → MailAttachment[]
   │ POST /.netlify/functions/send-email { refreshToken, fromEmail, to, subject, html, pdfBase64, pdfFilename, attachments }
   ▼
Function builds RFC 2822 → base64url → gmail.users.messages.send
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
  .set({
    margin: [8, 10, 8, 10],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'thead'] },
    filename,
  })
  .from(document.getElementById('invoice-print-area'))
  .save();
```

`html2pdf.js` is a thin wrapper around `html2canvas` (DOM → canvas) + `jsPDF` (canvas → PDF). It's the slowest part of the app — for a 2-page invoice expect ~2–4 seconds on a mid-range laptop. The LottieLoader overlay covers this; because it's a `<video>` element it runs on the browser's media pipeline and **never freezes** while html2canvas hogs the main thread.

### Mail-send flow

```ts
const pdfBlob   = await generatePdfBlob(filename);   // same html2pdf chain, but ends with .toPdf().output('blob')
const pdfBase64 = await blobToBase64(pdfBlob);
const html      = buildHtmlBody();                   // wraps #invoice-print-area in the mobile-responsive shell
POST /send-email { html, pdfBase64, pdfFilename, … }
```

The DOM source is identical — so what the user sees on the preview page is exactly what arrives in the recipient's inbox (HTML body) and exactly what's attached as a PDF.

### Print flow

`printAsPdf(filename)` generates the same PDF Blob, opens it in a new tab via `URL.createObjectURL`, and lets the browser's native PDF viewer handle Ctrl+P — much cleaner than printing the HTML directly (no app chrome, no browser print headers, no URL injection). Falls back to a download if popups are blocked.

### Important caveat

`html2pdf.js` returns a builder that needs **`.toPdf()` before `.output('blob')`** for a Blob output. Calling `.output('blob')` directly returns the canvas data, not a PDF. This is the only way `generatePdfBlob()` differs from `downloadPdf()`.

---

## Mobile-responsive email HTML

The HTML built by `MailPreview.buildHtmlBody()` is what the recipient sees in their inbox. The desktop layout is unchanged (centered 780 px card on a slate background), but a `@media (max-width: 600px)` rule kicks in on phones:

- `<meta name="viewport" content="width=device-width, initial-scale=1" />` — tells Gmail iOS / Apple Mail to use real device width instead of pretending to be 980 px.
- Outer body padding drops to `0`.
- Card padding drops to `16px`, border-radius and side borders are stripped, so the message and the invoice block run edge to edge.
- The invoice line-items table is wrapped in `<div class="line-items-scroll" style="overflow-x:auto">` with `min-width: 560px` on the inner table, so it scrolls horizontally instead of squashing every column to unreadable widths.
- The rest of the invoice uses `width:100%` everywhere with percentage column widths, so it reflows naturally.

Desktop (≥ 601 px) renders identically to before — same 780 px card, same border, same rounded corners. The mobile-responsive CSS targets only what Gmail-iOS / Apple Mail render under 600 px width; Gmail web strips `<style>` blocks but the inline `width:100%` percentages keep the layout sane there too.

---

## Code-splitting + bundle strategy

The initial JS bundle was **~10.4 MB raw / ~2.9 MB gzipped** before code-splitting. After splitting, **initial download is ~270 KB gzipped** — a >90 % reduction.

| Chunk | Size | Gzipped | Loaded when |
|---|---|---|---|
| `index-*.js` (main app) | ~665 KB | ~268 KB | Initial paint |
| `OnboardingTour-*.js` (react-joyride) | ~93 KB | ~31 KB | First-time visitor only (lazy + Suspense) |
| `lib-*.js` (country-state-city geographic data) | ~8.7 MB | ~2.4 MB | When `LocationSelector` mounts (deferred) |
| `exceljs.min-*.js` | ~930 KB | ~256 KB | On "Export XLSX" click |
| `html2pdf-*.js` | ~936 KB | ~266 KB | On PDF download / mail-send |
| `FileSaver.min-*.js` | ~2.7 KB | ~1.3 KB | On "Export XLSX" click |

### How the splits work

- **OnboardingTour** — `const OnboardingTour = lazy(() => import('./components/OnboardingTour'))` in [App.tsx](src/App.tsx), rendered inside `<Suspense fallback={null}>`. Tour kicks off via a 500 ms internal `setTimeout`, so the lazy chunk fetch has plenty of time.
- **country-state-city** — [LocationSelector.tsx](src/components/LocationSelector.tsx) holds the module in state, `useEffect` calls `import('country-state-city')` on mount, the option lists stay empty until the chunk resolves. A module-level `cscModulePromise` cache means subsequent mounts share the same Promise.
- **ExcelJS + file-saver** — dynamically imported inside `exportAllXlsx` / `exportDetailedXlsx` in [InvoiceList.tsx](src/components/InvoiceList.tsx) via a `loadExcelDeps()` helper that imports both in parallel.
- **html2pdf.js** — dynamically imported inside [pdfExport.ts](src/utils/pdfExport.ts) helpers (`loadHtml2Pdf()`).

### Loader rendering

The Lottie loaders are WebM videos (not Lottie JSON / dotlottie-web) for two reasons:

1. `<video>` runs in the browser's dedicated media pipeline (off the main thread), so heavy main-thread work like `html2canvas` during PDF generation **never freezes the animation** — the old Lottie player used `requestAnimationFrame` on the main thread and stuttered every time.
2. Zero JS runtime cost — no WASM, no JSON parse, just a `<video>` tag.

The loader renders at the video's **intrinsic resolution** (no upscaling — that was causing visible blur in the browser). The optional `size` prop now acts as a maximum cap, never an enlargement.

`preloadLottieAssets()` warms the HTTP cache at app boot via `fetch(url, { cache: 'force-cache' })` so the overlay paints instantly the first time the user triggers a long operation.

---

## Notifications system

[utils/notify.ts](src/utils/notify.ts) wraps react-hot-toast in a single style source. Every toast renders with the unified white-card background; colour comes from the icon, not the background.

### Variants

| Variant | Duration | Use case |
|---|---|---|
| `notify.success(msg)` | 2.8 s | Save succeeded, file deleted, email sent |
| `notify.error(msg)` | 4 s | Validation failed, network error, save rejected |
| `notify.info(msg)` | 2.8 s | "Redirecting to Google…", auto-saved changes |
| `notify.warning(msg)` | 3.5 s | Soft alerts: file is large, etc. |
| `notify.loading(msg)` | manual | Returns id; pass to `notify.dismiss(id)` |
| `notify.promise(p, msgs)` | auto | Flips loading → success/error based on `p` |
| `notify.upload(name, work)` | until resolved | Custom `<UploadToast>` with animated progress bar |

The global `<Toaster>` is mounted **once** in [App.tsx](src/App.tsx) — every page shares the same look, no per-page `Toaster` instances. Caps every toast at `maxWidth: 'calc(100vw - 32px)'` so they never reach the screen edges on mobile.

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

In Google Cloud Console:
- **Authorized JavaScript origins:** `http://localhost:8888`
- **Authorized redirect URIs:** `http://localhost:8888/.netlify/functions/google-callback`

### Run

```bash
npm run dev
```

This launches **`netlify dev`** on port `8888`, which proxies Vite (5173) + serves Netlify Functions on the same origin. Visit **http://localhost:8888** — not 5173. If you hit 5173 by mistake, [main.tsx](src/main.tsx) bounces you to 8888 automatically so the splash doesn't double-flash.

If you only want Vite (no Functions), use `npm run dev:vite` — Gmail features will be disabled with a clear toast/alert (see `gmailClient.ts`).

### Build

```bash
npm run build      # tsc -b && vite build
npm run preview    # serve dist/ on a local port
```

### Lint

```bash
npm run lint
```

---

## Deployment to Netlify

The repo is Netlify-ready. [netlify.toml](netlify.toml) sets:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[dev]
  command = "npm run dev:vite"
  port = 8888
  targetPort = 5173
  framework = "#custom"   # we own the dev server; don't auto-rewrite SPA routes
  autoLaunch = false

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200             # SPA fallback (force=false → static files served first)
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

## Dev conveniences

### Reset demo data

In the browser console (exposed by [autoSeed.ts](src/db/autoSeed.ts)):

```js
resetSeed()
```

Clears the seed flag + the invoice collection, then reloads. The 5 demo invoices come back on next mount.

### Replay the tour

```js
localStorage.removeItem('invoiceBuilder.tour.v4'); location.reload();
```

### Replay the splash

```js
sessionStorage.removeItem('splashShown'); location.reload();
```

### Disconnect Gmail without revoking

```js
localStorage.removeItem('gmail_refresh_token');
localStorage.removeItem('gmail_connected_email');
location.reload();
```

### Clear everything

DevTools → Application → Storage → "Clear site data". Brings the app back to a fresh-install state.

---

## License

Private project. All rights reserved.
