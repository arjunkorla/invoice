/**
 * Client-side A4 PDF export with real (selectable) text, drawn with jsPDF.
 * The layout mirrors the on-screen <InvoiceDocument> sheet: same margins,
 * pt sizes, colours and section order. Long item lists flow onto extra pages
 * with the table header repeated.
 */
import { jsPDF } from "jspdf";
import { amountInWords, formatDate, formatKD, formatQty, getTotals, lineTotal } from "../lib";
import { logoAsPng } from "../platform";
import type { Invoice } from "../types";

const PT = 0.3528; // mm per point
const PAGE_W = 210;
const PAGE_H = 297;
const M_LEFT = 17;
const M_RIGHT = 17;
const M_TOP = 18;
const M_BOTTOM = 16;
const CONTENT_W = PAGE_W - M_LEFT - M_RIGHT;
const RIGHT = PAGE_W - M_RIGHT;

const C = {
  ink: "#23262d",
  muted: "#646b77",
  meta: "#5e6570",
  label: "#858c97",
  dt: "#747b87",
  blue: "#2440d8",
  rule: "#202631",
  tableHead: "#272d38",
  rowLine: "#e3e5e8",
  summaryDt: "#626a76",
  summaryDd: "#252830",
  notes: "#676e79",
  sigLine: "#4c515a",
  sigLabel: "#7d8490",
};

/**
 * The built-in PDF fonts cover Latin-1 only. Map common typographic characters
 * and replace anything else so the PDF never shows garbled glyphs.
 */
const REPLACEMENTS: Record<string, string> = {
  "−": "-", "–": "-", "—": "-", "‘": "'", "’": "'",
  "“": '"', "”": '"', "•": "·", "…": "...", " ": " ",
};
export function pdfUnsupportedChars(text: string): boolean {
  return [...text].some((ch) => ch.charCodeAt(0) > 255 && !(ch in REPLACEMENTS));
}
const clean = (text: string) =>
  [...(text ?? "")].map((ch) => REPLACEMENTS[ch] ?? (ch.charCodeAt(0) > 255 ? "?" : ch)).join("");

export async function buildInvoicePdf(invoice: Invoice): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  doc.setProperties({
    title: `Invoice ${invoice.invoiceNumber}`,
    subject: "Invoice",
    author: invoice.issuer.name || "",
    creator: "Invoice Studio",
  });
  const totals = getTotals(invoice);
  const logo = await logoAsPng(invoice.issuer.logo);

  // ---- text helpers --------------------------------------------------------
  const font = (size: number, style: "normal" | "bold" | "italic" = "normal", color = C.ink, family = "helvetica") => {
    doc.setFont(family, style);
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const lineH = (size: number, factor = 1.45) => size * PT * factor;
  const wrap = (text: string, width: number): string[] =>
    clean(text)
      .split("\n")
      .flatMap((part) => (part.trim() ? (doc.splitTextToSize(part, width) as string[]) : [""]));
  /** Draw wrapped lines from top `y`; returns the y below the block. */
  const block = (
    text: string,
    x: number,
    y: number,
    width: number,
    size: number,
    opts: { align?: "left" | "right" | "center"; factor?: number; charSpace?: number } = {},
  ) => {
    const lines = wrap(text, width);
    const lh = lineH(size, opts.factor);
    lines.forEach((line, i) => {
      doc.text(line, x, y + i * lh, {
        baseline: "top",
        align: opts.align ?? "left",
        charSpace: opts.charSpace,
      });
    });
    return y + lines.length * lh;
  };
  const measure = (text: string, width: number, size: number, factor = 1.45) =>
    wrap(text, width).length * lineH(size, factor);
  const rule = (x1: number, y: number, x2: number, width: number, color: string) => {
    doc.setDrawColor(color);
    doc.setLineWidth(width);
    doc.line(x1, y, x2, y);
  };
  /** Right-aligned text that honours letter spacing. */
  const textRight = (text: string, y: number, charSpace = 0) => {
    const t = clean(text);
    const w = doc.getTextWidth(t) + charSpace * Math.max(0, t.length - 1);
    doc.text(t, RIGHT - w, y, { baseline: "top", charSpace });
  };

  let y = M_TOP;
  const newPage = () => {
    doc.addPage();
    y = M_TOP;
  };
  const ensure = (height: number) => {
    if (y + height > PAGE_H - M_BOTTOM) newPage();
  };

  // ---- header ----------------------------------------------------------------
  let leftX = M_LEFT;
  let leftBottom = y;
  if (logo) {
    const box = 18;
    const ratio = logo.width / logo.height;
    const w = ratio >= 1 ? box : box * ratio;
    const h = ratio >= 1 ? box / ratio : box;
    doc.addImage(logo.dataUrl, "PNG", M_LEFT + (box - w) / 2, y + (box - h) / 2, w, h);
    leftX = M_LEFT + box + 3.2;
    leftBottom = y + box;
  }
  font(14, "bold");
  let ly = block(invoice.issuer.name || "Your Business Name", leftX, y, 105, 14, { factor: 1.2 });
  ly += 1;
  font(7.5, "normal", C.muted);
  const issuerLines = [
    invoice.issuer.address || "Business address",
    [invoice.issuer.phone, invoice.issuer.email].filter(Boolean).join("  ·  "),
    invoice.issuer.website,
  ].filter(Boolean);
  for (const line of issuerLines) ly = block(line, leftX, ly + 0.5, 105, 7.5);
  leftBottom = Math.max(leftBottom, ly);

  font(25, "bold");
  textRight("INVOICE", y - 1, 25 * 0.04 * PT);
  font(8, "bold", C.blue);
  textRight(invoice.invoiceNumber || "Invoice number", y + 25 * PT * 1.1);
  const rightBottom = y + 25 * PT * 1.1 + lineH(8);

  y = Math.max(leftBottom, rightBottom) + 11;
  rule(M_LEFT, y, RIGHT, 0.4, C.rule);
  y += 10;

  // ---- bill to + meta ------------------------------------------------------
  const metaW = 65;
  const metaX = RIGHT - metaW;
  const billW = CONTENT_W - metaW - 24;
  const top = y;
  font(6.5, "bold", C.label);
  let by = block("BILL TO", M_LEFT, y, billW, 6.5, { charSpace: 6.5 * 0.1 * PT }) + 1;
  font(10, "bold");
  by = block(invoice.client.name || "Client name", M_LEFT, by, billW, 10, { factor: 1.3 }) + 0.8;
  font(8, "normal", C.meta);
  for (const line of [
    invoice.client.company,
    invoice.client.address,
    [invoice.client.phone, invoice.client.email].filter(Boolean).join("  ·  "),
  ].filter(Boolean))
    by = block(line, M_LEFT, by + 0.5, billW, 8);

  const metaRows: [string, string][] = [["Invoice date", formatDate(invoice.invoiceDate)]];
  if (invoice.dueDate) metaRows.push(["Due date", formatDate(invoice.dueDate)]);
  if (invoice.referenceNumber) metaRows.push(["Reference", invoice.referenceNumber]);
  metaRows.push(["Status", invoice.status === "finalized" ? "Finalized" : "Draft"]);
  let my = top;
  for (const [dt, dd] of metaRows) {
    my += 0.8;
    font(7.5, "normal", C.dt);
    doc.text(dt, metaX, my, { baseline: "top" });
    font(7.5, "bold");
    const ddLines = wrap(dd, metaW - 24);
    ddLines.forEach((l, i) => doc.text(l, RIGHT, my + i * lineH(7.5), { baseline: "top", align: "right" }));
    my += ddLines.length * lineH(7.5) + 0.8;
  }
  y = Math.max(by, my) + 10;

  // ---- line items table ----------------------------------------------------
  const cols = [
    { title: "#", w: 9, align: "center" as const },
    { title: "DESCRIPTION", w: CONTENT_W - 9 - 15 - 30 - 30, align: "left" as const },
    { title: "QTY", w: 15, align: "center" as const },
    { title: "UNIT PRICE", w: 30, align: "right" as const },
    { title: "TOTAL", w: 30, align: "right" as const },
  ];
  const PAD_X = 3;
  const PAD_Y = 4;
  const cellX = (i: number) => {
    let x = M_LEFT;
    for (let c = 0; c < i; c++) x += cols[c].w;
    const col = cols[i];
    const pad = i === 0 ? 1 : PAD_X;
    return col.align === "left" ? x + pad : col.align === "right" ? x + col.w - pad : x + col.w / 2;
  };
  const headH = PAD_Y * 2 + lineH(6.5, 1.2);
  const drawHead = () => {
    doc.setFillColor(C.tableHead);
    doc.rect(M_LEFT, y, CONTENT_W, headH, "F");
    font(6.5, "bold", "#ffffff");
    cols.forEach((col, i) =>
      doc.text(col.title, cellX(i), y + PAD_Y, { baseline: "top", align: col.align, charSpace: 6.5 * 0.05 * PT }),
    );
    y += headH;
  };
  ensure(headH + 14);
  drawHead();
  invoice.lineItems.forEach((item, index) => {
    font(8);
    const cells = [
      String(index + 1),
      item.description || "Item description",
      formatQty(item.quantity),
      formatKD(item.unitPriceMills),
      formatKD(lineTotal(item)),
      // Only description and quantity wrap; row numbers and amounts stay on one line.
    ].map((text, i) => (i === 1 || i === 2 ? wrap(text, cols[i].w - PAD_X * 2) : [clean(text)]));
    const rowH = PAD_Y * 2 + Math.max(...cells.map((c) => c.length)) * lineH(8);
    if (y + rowH > PAGE_H - M_BOTTOM) {
      newPage();
      drawHead();
    }
    font(8);
    cells.forEach((lines, i) =>
      lines.forEach((line, li) =>
        doc.text(line, cellX(i), y + PAD_Y + li * lineH(8), { baseline: "top", align: cols[i].align }),
      ),
    );
    y += rowH;
    rule(M_LEFT, y, RIGHT, 0.26, C.rowLine);
  });

  // ---- summary (kept together) --------------------------------------------
  const sumW = 68;
  const sumX = RIGHT - sumW;
  const wordsW = CONTENT_W - sumW - 16;
  const words = amountInWords(totals.grandTotal);
  const sumRows: [string, string][] = [["Subtotal", formatKD(totals.subtotal)]];
  if (totals.discount > 0) sumRows.push(["Discount", `- ${formatKD(totals.discount)}`]);
  if (invoice.additionalChargesMills > 0)
    sumRows.push(["Additional charges", formatKD(invoice.additionalChargesMills)]);
  font(8, "bold");
  const wordsH = lineH(6.5) + 1 + measure(words, wordsW, 8, 1.6);
  const totalsH = sumRows.length * (lineH(8) + 1.6) + 3 + 4 + lineH(13, 1.2);
  ensure(9 + Math.max(wordsH, totalsH));
  y += 9;
  const sTop = y;
  font(6.5, "bold", C.label);
  let wy = block("AMOUNT IN WORDS", M_LEFT, sTop, wordsW, 6.5, { charSpace: 6.5 * 0.1 * PT }) + 1;
  font(8, "bold");
  wy = block(words, M_LEFT, wy, wordsW, 8, { factor: 1.6 });
  let sy = sTop;
  for (const [dt, dd] of sumRows) {
    sy += 0.8;
    font(8, "normal", C.summaryDt);
    doc.text(dt, sumX, sy, { baseline: "top" });
    font(8, "bold", C.summaryDd);
    doc.text(dd, RIGHT, sy, { baseline: "top", align: "right" });
    sy += lineH(8) + 0.8;
  }
  sy += 3;
  rule(sumX, sy, RIGHT, 0.4, "#252b35");
  sy += 4;
  font(10, "bold", "#20242b");
  doc.text("Grand total", sumX, sy + 0.8, { baseline: "top" });
  font(13, "bold", C.blue);
  doc.text(formatKD(totals.grandTotal), RIGHT, sy, { baseline: "top", align: "right" });
  sy += lineH(13, 1.2);
  y = Math.max(wy, sy);

  // ---- notes ---------------------------------------------------------------
  const notes = (
    [
      ["Notes", invoice.notes],
      ["Payment instructions", invoice.paymentInstructions],
      ["Terms & conditions", invoice.terms],
    ] as [string, string][]
  ).filter(([, text]) => text?.trim());
  if (notes.length) {
    const colW = (CONTENT_W - 7 * 2) / 3;
    font(7);
    const notesH = Math.max(...notes.map(([, t]) => lineH(7) + 1 + measure(t, colW, 7, 1.5)));
    ensure(12 + 7 + notesH);
    y += 12;
    rule(M_LEFT, y, RIGHT, 0.26, "#e1e4e8");
    y += 7;
    notes.forEach(([title, text], i) => {
      const x = M_LEFT + i * (colW + 7);
      font(7, "bold");
      const ny = block(title, x, y, colW, 7) + 1;
      font(7, "normal", C.notes);
      block(text, x, ny, colW, 7, { factor: 1.5 });
    });
    y += notesH;
  }

  // ---- footer: thank-you + signatures (kept together) -----------------------
  const footerH = 15 + lineH(8) + 18 + lineH(10) + 2 + 5 + lineH(6.5);
  ensure(footerH);
  y += 15;
  font(8, "bold", C.blue);
  y = block(invoice.thankYou || "Thank you for your business.", M_LEFT, y, CONTENT_W, 8);
  y += 18;
  const sigW = (CONTENT_W - 25) / 2;
  const recipient = invoice.client.company || invoice.client.name;
  const sigs: [string, string][] = [
    [invoice.issuerSignature, "Issuer signature"],
    [invoice.clientSignature, recipient ? `${recipient} signature` : "Client signature"],
  ];
  sigs.forEach(([name, label], i) => {
    const cx = M_LEFT + i * (sigW + 25) + sigW / 2;
    font(10, "italic", C.ink, "times");
    if (name) doc.text(clean(name), cx, y, { baseline: "top", align: "center", maxWidth: sigW });
    const lineY = y + lineH(10) + 2;
    rule(cx - sigW / 2, lineY, cx + sigW / 2, 0.26, C.sigLine);
    font(6.5, "normal", C.sigLabel);
    doc.text(clean(label), cx, lineY + 1.8, { baseline: "top", align: "center", maxWidth: sigW });
  });

  // ---- page numbers (multi-page only) --------------------------------------
  const pages = doc.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      font(6.5, "normal", C.sigLabel);
      doc.text(`${clean(invoice.invoiceNumber)}  ·  Page ${p} of ${pages}`, PAGE_W / 2, PAGE_H - 9, {
        baseline: "top",
        align: "center",
      });
    }
  }

  return doc.output("blob");
}
