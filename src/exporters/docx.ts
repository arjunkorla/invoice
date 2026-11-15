/**
 * Genuine Microsoft Word (.docx / OOXML) export built with the `docx` library.
 * Everything is editable text and real Word tables (no images of text), and
 * the item table header repeats on every page.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
} from "docx";
import { amountInWords, formatDate, formatKD, formatQty, getTotals, lineTotal } from "../lib";
import { logoAsPng } from "../platform";
import type { Invoice } from "../types";

const MM = 56.6929; // twips per mm
const tw = (mm: number) => Math.round(mm * MM);
const CONTENT = tw(176); // A4 width minus 17mm side margins
const FONT = "Arial";
// docx sizes are half-points
const hp = (pt: number) => Math.round(pt * 2);

const COLOR = {
  ink: "23262D",
  muted: "646B77",
  label: "858C97",
  blue: "2440D8",
  head: "272D38",
  line: "E3E5E8",
  notes: "676E79",
};

const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const TABLE_NO_BORDERS = { ...NO_BORDERS, insideHorizontal: NONE, insideVertical: NONE };

type RunOpts = { size?: number; bold?: boolean; italic?: boolean; color?: string; caps?: boolean; spacing?: number };
const run = (text: string, o: RunOpts = {}) =>
  new TextRun({
    text,
    font: FONT,
    size: hp(o.size ?? 9),
    bold: o.bold,
    italics: o.italic,
    color: o.color ?? COLOR.ink,
    allCaps: o.caps,
    characterSpacing: o.spacing,
  });

/** Paragraphs for multi-line text, preserving the user's line breaks. */
const lines = (
  text: string,
  o: RunOpts & { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number } = {},
) =>
  (text || "").split("\n").map(
    (line) =>
      new Paragraph({
        alignment: o.align,
        spacing: { after: o.after ?? 30, line: 276 },
        children: [run(line, o)],
      }),
  );

const label = (text: string) =>
  new Paragraph({ spacing: { after: 60 }, children: [run(text, { size: 6.5, bold: true, color: COLOR.label, spacing: 12 })] });

/** "Label ........ value" line using a right tab stop at the cell's width. */
const pairLine = (dt: string, dd: string, width: number, o: { size?: number; bold?: boolean; ddColor?: string; ddSize?: number; topBorder?: boolean } = {}) =>
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: width }],
    spacing: { before: o.topBorder ? 120 : 40, after: 40 },
    border: o.topBorder ? { top: { style: BorderStyle.SINGLE, size: 12, color: "252B35", space: 6 } } : undefined,
    children: [
      run(dt, { size: o.size ?? 8, bold: o.bold, color: o.bold ? COLOR.ink : "626A76" }),
      new TextRun({
        children: [new Tab(), dd],
        font: FONT,
        size: hp(o.ddSize ?? o.size ?? 8),
        bold: true,
        color: o.ddColor ?? "252830",
      }),
    ],
  });

const cell = (children: (Paragraph | Table)[], width: number, extra: Partial<ConstructorParameters<typeof TableCell>[0]> = {}) =>
  new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    borders: NO_BORDERS,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    ...extra,
  });

const layoutTable = (widths: number[], cells: TableCell[]) =>
  new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: TABLE_NO_BORDERS,
    rows: [new TableRow({ cantSplit: true, children: cells })],
  });

export async function buildInvoiceDocx(invoice: Invoice): Promise<Blob> {
  const totals = getTotals(invoice);
  const logo = await logoAsPng(invoice.issuer.logo);

  // ---- header ----------------------------------------------------------------
  const issuer: Paragraph[] = [];
  if (logo) {
    const box = 68; // px (~18mm)
    const ratio = logo.width / logo.height;
    issuer.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new ImageRun({
            type: "png",
            data: logo.bytes,
            transformation: { width: Math.round(ratio >= 1 ? box : box * ratio), height: Math.round(ratio >= 1 ? box / ratio : box) },
          }),
        ],
      }),
    );
  }
  issuer.push(...lines(invoice.issuer.name || "Your Business Name", { size: 14, bold: true, after: 60 }));
  issuer.push(...lines(invoice.issuer.address || "Business address", { size: 7.5, color: COLOR.muted }));
  for (const line of [
    [invoice.issuer.phone, invoice.issuer.email].filter(Boolean).join("  •  "),
    invoice.issuer.website,
  ].filter(Boolean))
    issuer.push(...lines(line, { size: 7.5, color: COLOR.muted }));

  const titleCol = tw(60);
  const header = layoutTable(
    [CONTENT - titleCol, titleCol],
    [
      cell(issuer, CONTENT - titleCol),
      cell(
        [
          new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 60 }, children: [run("INVOICE", { size: 25, bold: true, spacing: 20 })] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(invoice.invoiceNumber || "Invoice number", { size: 8, bold: true, color: COLOR.blue })] }),
        ],
        titleCol,
      ),
    ],
  );
  const headerRule = new Paragraph({
    spacing: { before: 0, after: tw(10) / 1 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "202631", space: tw(11) / 20 } },
    children: [],
  });

  // ---- bill to + meta --------------------------------------------------------
  const metaW = tw(65);
  const gap = tw(24);
  const billTo: Paragraph[] = [
    label("BILL TO"),
    ...lines(invoice.client.name || "Client name", { size: 10, bold: true, after: 40 }),
    ...(invoice.client.company ? lines(invoice.client.company, { size: 8, color: "5E6570" }) : []),
    ...(invoice.client.address ? lines(invoice.client.address, { size: 8, color: "5E6570" }) : []),
    ...([invoice.client.phone, invoice.client.email].some(Boolean)
      ? lines([invoice.client.phone, invoice.client.email].filter(Boolean).join("  •  "), { size: 8, color: "5E6570" })
      : []),
  ];
  const metaRows: [string, string][] = [["Invoice date", formatDate(invoice.invoiceDate)]];
  if (invoice.dueDate) metaRows.push(["Due date", formatDate(invoice.dueDate)]);
  if (invoice.referenceNumber) metaRows.push(["Reference", invoice.referenceNumber]);
  metaRows.push(["Status", invoice.status === "finalized" ? "Finalized" : "Draft"]);
  const meta = layoutTable(
    [CONTENT - metaW - gap, gap, metaW],
    [
      cell(billTo, CONTENT - metaW - gap),
      cell([new Paragraph({ children: [] })], gap),
      cell(metaRows.map(([dt, dd]) => pairLine(dt, dd, metaW, { size: 7.5, ddColor: COLOR.ink })), metaW),
    ],
  );

  // ---- items table -----------------------------------------------------------
  const widths = [tw(9), CONTENT - tw(9 + 15 + 30 + 30), tw(15), tw(30), tw(30)];
  const aligns = [AlignmentType.CENTER, AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.RIGHT, AlignmentType.RIGHT];
  const rowBorder = { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.line } };
  const cellMargins = (i: number) => {
    const x = i === 0 ? tw(1) : tw(3);
    return { top: tw(3), bottom: tw(3), left: x, right: x };
  };
  const headRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: ["#", "DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"].map(
      (title, i) =>
        new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          borders: NO_BORDERS,
          margins: cellMargins(i),
          shading: { type: ShadingType.CLEAR, color: "auto", fill: COLOR.head },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: aligns[i], children: [run(title, { size: 6.5, bold: true, color: "FFFFFF", spacing: 8 })] })],
        }),
    ),
  });
  const itemRows = invoice.lineItems.map(
    (item, index) =>
      new TableRow({
        cantSplit: true,
        children: [
          String(index + 1),
          item.description || "Item description",
          formatQty(item.quantity),
          formatKD(item.unitPriceMills),
          formatKD(lineTotal(item)),
        ].map(
          (text, i) =>
            new TableCell({
              width: { size: widths[i], type: WidthType.DXA },
              borders: rowBorder,
              margins: cellMargins(i),
              children: lines(text, { size: 8, align: aligns[i], after: 0 }),
            }),
        ),
      }),
  );
  const items = new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: TABLE_NO_BORDERS,
    rows: [headRow, ...itemRows],
  });

  // ---- summary ---------------------------------------------------------------
  const sumW = tw(68);
  const sumGap = tw(16);
  const sumRows = [pairLine("Subtotal", formatKD(totals.subtotal), sumW)];
  if (totals.discount > 0) sumRows.push(pairLine("Discount", `− ${formatKD(totals.discount)}`, sumW));
  if (invoice.additionalChargesMills > 0)
    sumRows.push(pairLine("Additional charges", formatKD(invoice.additionalChargesMills), sumW));
  sumRows.push(pairLine("Grand total", formatKD(totals.grandTotal), sumW, { size: 10, bold: true, ddSize: 13, ddColor: COLOR.blue, topBorder: true }));
  const summary = layoutTable(
    [CONTENT - sumW - sumGap, sumGap, sumW],
    [
      cell([label("AMOUNT IN WORDS"), ...lines(amountInWords(totals.grandTotal), { size: 8, bold: true })], CONTENT - sumW - sumGap),
      cell([new Paragraph({ children: [] })], sumGap),
      cell(sumRows, sumW),
    ],
  );

  // ---- notes -----------------------------------------------------------------
  const notes = (
    [
      ["Notes", invoice.notes],
      ["Payment instructions", invoice.paymentInstructions],
      ["Terms & conditions", invoice.terms],
    ] as [string, string][]
  ).filter(([, text]) => text?.trim());
  const notesBlock: (Paragraph | Table)[] = [];
  if (notes.length) {
    const colGap = tw(7);
    const colW = Math.floor((CONTENT - colGap * 2) / 3);
    const cells: TableCell[] = [];
    const colWidths: number[] = [];
    notes.forEach(([title, text], i) => {
      if (i) {
        cells.push(cell([new Paragraph({ children: [] })], colGap));
        colWidths.push(colGap);
      }
      cells.push(cell([...lines(title, { size: 7, bold: true }), ...lines(text, { size: 7, color: COLOR.notes })], colW));
      colWidths.push(colW);
    });
    notesBlock.push(
      new Paragraph({
        spacing: { before: tw(12) / 1, after: tw(7) / 1 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E1E4E8", space: 1 } },
        children: [],
      }),
      layoutTable(colWidths, cells),
    );
  }

  // ---- footer / signatures ---------------------------------------------------
  const recipient = invoice.client.company || invoice.client.name;
  const sigGap = tw(25);
  const sigW = Math.floor((CONTENT - sigGap) / 2);
  const sigCell = (name: string, caption: string) =>
    cell(
      [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: name || " ", font: "Georgia", italics: true, size: hp(10), color: COLOR.ink })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: "4C515A", space: 4 } },
          children: [run(caption, { size: 6.5, color: "7D8490" })],
        }),
      ],
      sigW,
    );
  const signatures = layoutTable(
    [sigW, sigGap, sigW],
    [
      sigCell(invoice.issuerSignature, "Issuer signature"),
      cell([new Paragraph({ children: [] })], sigGap),
      sigCell(invoice.clientSignature, recipient ? `${recipient} signature` : "Client signature"),
    ],
  );

  const spacer = (mm: number) => new Paragraph({ spacing: { before: 0, after: 0, line: tw(mm), lineRule: "exact" }, children: [] });

  const doc = new Document({
    creator: "Invoice Studio",
    title: `Invoice ${invoice.invoiceNumber}`,
    description: "Invoice",
    styles: { default: { document: { run: { font: FONT, size: hp(9), color: COLOR.ink } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: tw(210), height: tw(297) },
            margin: { top: tw(18), bottom: tw(16), left: tw(17), right: tw(17), header: tw(8), footer: tw(8) },
          },
        },
        children: [
          header,
          headerRule,
          meta,
          spacer(10),
          items,
          spacer(9),
          summary,
          ...notesBlock,
          spacer(15),
          new Paragraph({
            keepNext: true,
            children: [run(invoice.thankYou || "Thank you for your business.", { size: 8, bold: true, color: COLOR.blue })],
          }),
          spacer(18),
          signatures,
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}
