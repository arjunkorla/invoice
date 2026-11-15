export type InvoiceStatus = "draft" | "finalized";

export interface BusinessDetails {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo?: string;
}

export interface ClientDetails {
  name: string;
  company: string;
  address: string;
  phone: string;
  email: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPriceMills: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  referenceNumber: string;
  dueDate: string;
  status: InvoiceStatus;
  issuer: BusinessDetails;
  client: ClientDetails;
  lineItems: LineItem[];
  discountType: "fixed" | "percent";
  discountValue: string;
  additionalChargesMills: number;
  notes: string;
  paymentInstructions: string;
  terms: string;
  thankYou: string;
  issuerSignature: string;
  clientSignature: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  business: BusinessDetails;
  invoicePrefix: string;
  defaultTerms: string;
  defaultThankYou: string;
  defaultPaymentInstructions: string;
}

export type Page = "dashboard" | "create" | "history" | "settings" | "preview";
