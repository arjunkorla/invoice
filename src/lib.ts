import type { Invoice, LineItem, Settings } from "./types";

export const STORAGE_INVOICES = "kwd-invoice-studio.invoices.v1";
export const STORAGE_SETTINGS = "kwd-invoice-studio.settings.v1";

export const defaultSettings: Settings = {
  business: {
    name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
  },
  invoicePrefix: "INV",
  defaultTerms: "Payment is due upon receipt of this invoice.",
  defaultThankYou: "Thank you for your business.",
  defaultPaymentInstructions: "",
};

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Local calendar date (YYYY-MM-DD). toISOString() would give the UTC date. */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Drop the retired tax/registration field from data saved by older versions. */
export function withoutRegistration<T extends { business?: object; issuer?: object }>(item: T): T {
  const strip = (details?: object) => {
    if (!details || !("registrationNumber" in details)) return details;
    const { registrationNumber: _removed, ...rest } = details as Record<string, unknown>;
    return rest;
  };
  return {
    ...item,
    ...(item.business && { business: strip(item.business) }),
    ...(item.issuer && { issuer: strip(item.issuer) }),
  };
}

export function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function parseMills(value: string | number): number {
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized) return 0;
  const match = normalized.match(/^(\d*)(?:\.(\d*))?$/);
  if (!match) return 0;
  const fraction = match[2] ?? "";
  const base = Number(match[1] || 0) * 1000 + Number(fraction.slice(0, 3).padEnd(3, "0"));
  // Round (half up) on the 4th decimal instead of rejecting extra precision.
  return Number(fraction[3] ?? 0) >= 5 ? base + 1 : base;
}

/** Safe file name for exported documents, e.g. "Invoice-INV-2026-001". */
export function invoiceFileName(invoice: Invoice): string {
  const number = (invoice.invoiceNumber || "draft").replace(/[^\w.-]+/g, "-");
  return `Invoice-${number}`;
}

export function millsToInput(mills: number): string {
  return (Math.max(0, mills) / 1000).toFixed(3);
}

export function formatKD(mills: number): string {
  return `KD ${(Math.max(0, mills) / 1000).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

/** Quantity as shown on documents: whole numbers without leading zeros. */
export function formatQty(value: string): string {
  const text = (value ?? "").trim();
  if (/^\d+$/.test(text)) return String(Number(text));
  return text || "0"; // older saved invoices may contain a fractional quantity
}

export function quantityThousandths(value: string): number {
  return parseMills(value);
}

export function lineTotal(item: LineItem): number {
  return Math.round((quantityThousandths(item.quantity) * item.unitPriceMills) / 1000);
}

export function getTotals(invoice: Invoice) {
  const subtotal = invoice.lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const rawDiscount =
    invoice.discountType === "fixed"
      ? parseMills(invoice.discountValue)
      : Math.round((subtotal * Math.round(Number(invoice.discountValue || 0) * 100)) / 10000);
  const discount = Math.min(subtotal, Math.max(0, rawDiscount));
  const grandTotal = Math.max(0, subtotal - discount + invoice.additionalChargesMills);
  return { subtotal, discount, grandTotal };
}

const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function underThousand(value: number): string {
  const parts: string[] = [];
  if (value >= 100) {
    parts.push(`${ones[Math.floor(value / 100)]} Hundred`);
    value %= 100;
  }
  if (value >= 20) {
    const remainder = value % 10;
    parts.push(`${tens[Math.floor(value / 10)]}${remainder ? `-${ones[remainder]}` : ""}`);
  } else if (value > 0) {
    parts.push(ones[value]);
  }
  return parts.join(" ");
}

function integerToWords(value: number): string {
  if (value === 0) return "Zero";
  const scales = ["", "Thousand", "Million", "Billion"];
  const parts: string[] = [];
  let scale = 0;
  while (value > 0 && scale < scales.length) {
    const chunk = value % 1000;
    if (chunk) parts.unshift(`${underThousand(chunk)}${scales[scale] ? ` ${scales[scale]}` : ""}`);
    value = Math.floor(value / 1000);
    scale += 1;
  }
  return parts.join(" ");
}

export function amountInWords(mills: number): string {
  const dinars = Math.floor(mills / 1000);
  const fils = mills % 1000;
  const dinarText = `${integerToWords(dinars)} Kuwaiti Dinar${dinars === 1 ? "" : "s"}`;
  return fils ? `${dinarText} and ${integerToWords(fils)} Fils Only` : `${dinarText} Only`;
}

export function nextInvoiceNumber(invoices: Invoice[], prefix: string): string {
  const year = new Date().getFullYear();
  const safePrefix = prefix.trim() || "INV";
  const matcher = new RegExp(
    `^${safePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-${year}-(\\d+)$`,
  );
  const highest = invoices.reduce((max, invoice) => {
    const match = invoice.invoiceNumber.match(matcher);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${safePrefix}-${year}-${String(highest + 1).padStart(3, "0")}`;
}

export function blankInvoice(settings: Settings, invoices: Invoice[]): Invoice {
  const timestamp = new Date().toISOString();
  return {
    id: uid(),
    invoiceNumber: nextInvoiceNumber(invoices, settings.invoicePrefix),
    invoiceDate: today(),
    referenceNumber: "",
    dueDate: "",
    status: "draft",
    issuer: { ...settings.business },
    client: { name: "", company: "", address: "", phone: "", email: "" },
    lineItems: [{ id: uid(), description: "", quantity: "1", unitPriceMills: 0 }],
    discountType: "fixed",
    discountValue: "0",
    additionalChargesMills: 0,
    notes: "",
    paymentInstructions: settings.defaultPaymentInstructions,
    terms: settings.defaultTerms,
    thankYou: settings.defaultThankYou,
    issuerSignature: "",
    clientSignature: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function formatDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
