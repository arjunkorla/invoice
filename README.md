# Invoice Studio · Kuwait Dinar

A lightweight invoice website for Kuwaiti Dinar invoices (KD, 3 decimals).
Works on desktop and mobile browsers and can be added to a phone's home screen
as an app icon. No backend, no login, no database — calculations, PDF/Word
generation and printing all happen in the browser.

## Features

- Opens on the **Dashboard**: total invoices, total invoice value (KD), this
  month's value, latest invoice, recent invoices, plus quick buttons for
  **Create new invoice** and **Invoice history**. All figures come from the
  invoices saved in this browser and update on save, edit and delete.
- Navigation: Dashboard · Create invoice · Invoice history · Business settings.
- Business details: name, address, phone, email, website, logo. No tax or
  registration number, and no tax is calculated.
- Line items: add, edit, duplicate, delete. Quantity is a whole number (min 1)
  with − / + buttons. Prices use 3 decimals. Amounts are calculated in integer
  fils: `Line total = Qty × Unit price`,
  `Grand total = Subtotal − Discount + Additional charges`.
- **Download PDF**: A4 with selectable text (jsPDF), multi-page with repeated table header.
- **Download Word**: a genuine, editable `.docx` (docx library) with real Word tables.
- **Print**: the browser print dialog, A4, invoice only ("Save as PDF" available).
- Installable web app (PWA): custom icon, opens full-screen from the home screen.

### What is stored, and where

| What | Where | Notes |
| --- | --- | --- |
| App files (the "app shell") | Service-worker cache | Lets the app open, calculate and export **offline** after the first visit. Contains no invoice data. |
| Business settings | `localStorage` (this browser only) | Saved only when you click **Save settings**. |
| Saved invoices | `localStorage` (this browser only) | Saved only when you click **Save invoice / Save draft**. Clearing browser data erases them, so keep the PDF/Word copies of important invoices. |

Nothing is uploaded or sent anywhere.

> The PDF download uses the built-in PDF fonts (Latin characters). If an invoice
> contains Arabic text, use **Download Word** or **Print → Save as PDF**; the app
> shows a hint when this applies.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | UI: dashboard, editor, invoice history, settings, preview |
| `src/InvoiceDocument.tsx` | On-screen / print A4 invoice |
| `src/lib.ts` | Money math (fils), formatting, amount in words |
| `src/exporters/pdf.ts`, `src/exporters/docx.ts` | PDF and Word generation (loaded on demand) |
| `src/platform.ts` | Browser download, print and logo helpers |
| `src/DatePicker.tsx` | Calendar for Invoice date / Due date (no dependency) |
| `public/manifest.webmanifest` | Web app manifest (name, icons, colours) |
| `public/icons/` | App icons; `icon.svg` is the master design |
| `vite.config.ts` → `appShellServiceWorker()` | Generates `dist/sw.js` at build time |

## Development

```bash
npm install
npm run dev        # development server (service worker disabled)
npm run build      # production build -> dist/
npm run preview    # serve dist/ at http://localhost:4173 (service worker active)
```

## Deployment (static hosting)

`npm run build` produces a fully static `dist/` folder. All paths are relative,
so it works at a domain root or in a sub-folder. **HTTPS is required** for the
home-screen install and the service worker. All the hosts below provide it.

| Host | Settings |
| --- | --- |
| **Netlify** | Build command `npm run build`, publish directory `dist` (or drag-and-drop `dist/` in the Netlify UI). |
| **Vercel** | Framework preset "Vite", build `npm run build`, output `dist`. |
| **Cloudflare Pages** | Build command `npm run build`, output directory `dist`. |
| **GitHub Pages** | Upload the contents of `dist/` to the Pages branch/folder (e.g. with the `actions/upload-pages-artifact` workflow). Works under `https://<user>.github.io/<repo>/`. |

There is a single page and no client-side routing, so no redirect or rewrite
rules are needed.

After a new deploy, an open copy of the app picks up the new version the next
time the page loads. The service worker refreshes its cache automatically.

## Add to Home screen (Android, Chrome)

1. Open the website's HTTPS address in **Chrome**.
2. Tap the **⋮** menu → **Add to Home screen** (on some versions:
   **Install app**). Chrome may also show an *Install* banner by itself.
3. Confirm **Install** / **Add**. The **Invoice Studio** icon appears on the home screen.
4. Tap the icon: the website opens full-screen on the **Dashboard**, with
   **Create new invoice** one tap away.

Installation is always started by the user from the browser and can't be forced.
Other browsers (Samsung Internet, Edge) have a similar "Add page to → Home
screen" option. On iPhone use Safari → Share → **Add to Home Screen**.

Downloads from the installed app go to the phone's **Downloads** folder, like
any Chrome download. **Print** opens Android's print screen, where you can pick
a printer or **Save as PDF**.

## Changing the icon

Edit `public/icons/icon.svg`, then export PNGs at the same file names:
`icon-192.png` (192×192), `icon-512.png` (512×512), `icon-maskable-512.png`
(512×512, keep the artwork inside the centre 80%), `apple-touch-icon.png`
(180×180) and `public/favicon.png`.
