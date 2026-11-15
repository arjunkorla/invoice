import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DatePicker } from "./DatePicker";
import { InvoiceDocument } from "./InvoiceDocument";
import {
  STORAGE_INVOICES,
  STORAGE_SETTINGS,
  amountInWords,
  blankInvoice,
  defaultSettings,
  formatDate,
  formatKD,
  getTotals,
  invoiceFileName,
  lineTotal,
  loadJson,
  millsToInput,
  nextInvoiceNumber,
  parseMills,
  saveJson,
  today,
  uid,
  withoutRegistration,
} from "./lib";
import { MIME, printPage, saveDocument } from "./platform";
import type { BusinessDetails, Invoice, LineItem, Page, Settings } from "./types";

export const APP_NAME = "Invoice Studio";
export const APP_TAGLINE = "Kuwait Dinar";

type ExportKind = "pdf" | "docx";

type IconName =
  | "dashboard"
  | "word"
  | "invoice"
  | "history"
  | "settings"
  | "plus"
  | "minus"
  | "search"
  | "eye"
  | "edit"
  | "copy"
  | "download"
  | "trash"
  | "print"
  | "save"
  | "menu"
  | "x"
  | "arrow"
  | "check"
  | "info"
  | "upload";

const iconPaths: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  word: (
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M14 2v6h6M8.5 12l1.5 6 2-4.5 2 4.5 1.5-6" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M14 2v6h6M9 13h8M9 17h8" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  edit: (
    <>
      <path d="m14 5 5 5M4 20l4.5-1 11-11a2 2 0 0 0-5-5l-11 11z" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 21h16" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7M10 11v6M14 11v6" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h12l3 3v15H4V3zM8 3v6h8V3M8 21v-7h8v7" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-5 5 5-5 5 5M4 20h16" />
    </>
  ),
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

function Button({
  children,
  icon,
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
      {hint && !error && <small>{hint}</small>}
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section">
      <header>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: Invoice["status"] }) {
  return (
    <span className={`status status-${status}`}>
      {status === "finalized" ? "Finalized" : "Draft"}
    </span>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`icon-btn ${danger ? "danger" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

/**
 * KD amount input. Keeps the user's raw text while typing (so "12.5" is not
 * forced to "12.500" mid-keystroke) and stores integer fils on every change;
 * the value is normalised to 3 decimals when the field loses focus.
 */
function MoneyInput({
  mills,
  onChange,
  ...props
}: {
  mills: number;
  onChange: (mills: number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(() => millsToInput(mills));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(millsToInput(mills));
  }, [mills]);
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        if (parseMills(text) === 0) setText("");
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/,/g, ".").replace(/[^\d.]/g, "");
        if ((next.match(/\./g) ?? []).length > 1) return;
        setText(next);
        onChange(parseMills(next));
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(millsToInput(parseMills(text)));
        props.onBlur?.(e);
      }}
    />
  );
}

/**
 * Whole-number quantity stepper (min 1). Typing, pasting or editing can only
 * produce digits; − / + (and ArrowDown / ArrowUp) change it by exactly 1.
 * The input comes first in the DOM so a surrounding <label> focuses it rather
 * than "clicking" the − button; CSS places − on the left.
 */
function QtyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (quantity: string) => void;
}) {
  const current = Math.max(1, Math.round(Number(value)) || 1);
  const step = (delta: number) => onChange(String(Math.max(1, current + delta)));
  return (
    <div className="qty-stepper">
      <input
        aria-label={label}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(/[.,٫]/)[0] // drop any decimal part ("2.5" -> "2")
              .replace(/\D/g, "")
              .replace(/^0+(?=\d)/, "")
              .slice(0, 6),
          )
        }
        onBlur={() => {
          if (!/^[1-9]\d*$/.test(value)) onChange(String(current));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            step(e.key === "ArrowUp" ? 1 : -1);
          }
        }}
      />
      <button
        type="button"
        className="qty-minus"
        aria-label={`Decrease ${label}`}
        disabled={current <= 1}
        onClick={() => step(-1)}
      >
        <Icon name="minus" size={16} />
      </button>
      <button
        type="button"
        className="qty-plus"
        aria-label={`Increase ${label}`}
        onClick={() => step(1)}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

/** Show a stored multi-line address on one line in a single-line input. */
const singleLine = (text: string) => (text ?? "").replace(/\s*\n+\s*/g, ", ");

type ToastState = {
  message: string;
  type: "success" | "info" | "error";
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(() =>
    withoutRegistration(loadJson(STORAGE_SETTINGS, defaultSettings)),
  );
  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    loadJson<Invoice[]>(STORAGE_INVOICES, []).map(withoutRegistration),
  );
  // The app opens on the Dashboard.
  const [page, setPage] = useState<Page>("dashboard");
  const [editing, setEditing] = useState<Invoice>(() =>
    blankInvoice(loadJson(STORAGE_SETTINGS, defaultSettings), loadJson(STORAGE_INVOICES, [])),
  );
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number>(undefined);
  const [busy, setBusy] = useState<ExportKind | "print" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Detect the on-screen keyboard (the visible viewport shrinks noticeably) so
  // the mobile action bar can step aside while the user types.
  useEffect(() => {
    const vv = window.visualViewport;
    let fullHeight = vv?.height ?? window.innerHeight;
    const onResize = () => {
      const height = vv?.height ?? window.innerHeight;
      if (height > fullHeight) fullHeight = height;
      document.documentElement.classList.toggle("keyboard-open", height < fullHeight - 150);
    };
    const onRotate = () => {
      fullHeight = 0;
      window.setTimeout(onResize, 300);
    };
    (vv ?? window).addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onRotate);
    return () => {
      (vv ?? window).removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onRotate);
    };
  }, []);

  const notify = (message: string, type: ToastState["type"] = "success") => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };

  /** Generate a PDF or Word document locally and save it to the device. */
  const exportDocument = async (invoice: Invoice, kind: ExportKind) => {
    if (busy) return;
    setBusy(kind);
    try {
      const fileName = `${invoiceFileName(invoice)}.${kind}`;
      let blob: Blob;
      if (kind === "pdf") {
        const { buildInvoicePdf, pdfUnsupportedChars } = await import("./exporters/pdf");
        blob = await buildInvoicePdf(invoice);
        if (pdfUnsupportedChars(JSON.stringify(invoice).replace(/"logo":"[^"]*"/, "")))
          notify(
            "Some characters (e.g. Arabic) can't be drawn in the PDF download. Use Word or Print → Save as PDF for those.",
            "info",
          );
      } else {
        const { buildInvoiceDocx } = await import("./exporters/docx");
        blob = await buildInvoiceDocx(invoice);
      }
      const saved = await saveDocument(blob, fileName, MIME[kind]);
      notify(`${fileName} saved to ${saved.location}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify(`Could not export the document. ${message}`, "error");
    } finally {
      setBusy(null);
    }
  };

  const navigate = (next: Page) => {
    setPage(next);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startNew = () => {
    setEditing(blankInvoice(settings, invoices));
    navigate("create");
  };

  const editInvoice = (invoice: Invoice) => {
    setEditing(structuredClone(invoice));
    navigate("create");
  };

  const viewInvoice = (invoice: Invoice) => {
    setPreviewInvoice(invoice);
    navigate("preview");
  };

  const duplicateInvoice = (invoice: Invoice) => {
    const timestamp = new Date().toISOString();
    setEditing({
      ...structuredClone(invoice),
      id: uid(),
      invoiceNumber: nextInvoiceNumber(invoices, settings.invoicePrefix),
      invoiceDate: today(),
      dueDate: "",
      referenceNumber: invoice.referenceNumber ? `${invoice.referenceNumber} (copy)` : "",
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
      lineItems: invoice.lineItems.map((item) => ({ ...item, id: uid() })),
    });
    navigate("create");
    notify("Invoice duplicated as a new draft.", "info");
  };

  const persistInvoices = (next: Invoice[]) => {
    setInvoices(next);
    saveJson(STORAGE_INVOICES, next);
  };

  const saveInvoice = (invoice: Invoice, status: Invoice["status"]) => {
    const errors = validateInvoice(invoice, status, invoices);
    if (Object.keys(errors).length) {
      notify(
        status === "finalized"
          ? "Complete the highlighted required fields."
          : "Invoice number must be unique.",
        "error",
      );
      return errors;
    }
    const exists = invoices.some((item) => item.id === invoice.id);
    const saved = { ...invoice, status, updatedAt: new Date().toISOString() };
    const next = exists
      ? invoices.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...invoices];
    try {
      persistInvoices(next);
      setEditing(saved);
      notify(status === "draft" ? "Draft saved." : "Invoice saved and finalized.");
      return {};
    } catch {
      notify("The invoice could not be saved. Browser storage may be full.", "error");
      return { storage: "Save failed" };
    }
  };

  const removeInvoice = () => {
    if (!deleteTarget) return;
    try {
      persistInvoices(invoices.filter((invoice) => invoice.id !== deleteTarget.id));
      if (editing.id === deleteTarget.id)
        setEditing(
          blankInvoice(
            settings,
            invoices.filter((i) => i.id !== deleteTarget.id),
          ),
        );
      notify(`${deleteTarget.invoiceNumber} deleted.`);
      setDeleteTarget(null);
    } catch {
      notify("The invoice could not be deleted.", "error");
    }
  };

  /** Show only the A4 invoice (print CSS) and open the system print dialog. */
  const printDocument = (invoice: Invoice) => {
    if (busy) return;
    setPreviewInvoice(invoice);
    setPage("preview");
    setBusy("print");
    window.setTimeout(() => {
      try {
        printPage();
      } finally {
        setBusy(null);
      }
    }, 250);
  };

  const exportActions = {
    busy,
    onPdf: (i: Invoice) => exportDocument(i, "pdf"),
    onWord: (i: Invoice) => exportDocument(i, "docx"),
    onPrint: printDocument,
  };

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        previewIsDraft={previewInvoice?.id === editing.id}
        open={sidebarOpen}
        onNavigate={navigate}
        onNew={startNew}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="app-main">
        <header className="mobile-header">
          <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <Brand compact />
          <Button variant="primary" icon="plus" onClick={startNew}>
            New
          </Button>
        </header>
        {page === "dashboard" && (
          <Dashboard
            invoices={invoices}
            onNew={startNew}
            onView={viewInvoice}
            onEdit={editInvoice}
            onDuplicate={duplicateInvoice}
            onDownload={exportActions.onPdf}
            onWord={exportActions.onWord}
            onDelete={setDeleteTarget}
            onHistory={() => navigate("history")}
          />
        )}
        {page === "create" && (
          <InvoiceEditor
            invoice={editing}
            invoices={invoices}
            onChange={setEditing}
            onSave={saveInvoice}
            onPreview={() => {
              setPreviewInvoice(editing);
              navigate("preview");
            }}
            {...exportActions}
            onClear={() => setClearConfirm(true)}
          />
        )}
        {page === "history" && (
          <History
            invoices={invoices}
            onNew={startNew}
            onView={viewInvoice}
            onEdit={editInvoice}
            onDuplicate={duplicateInvoice}
            onDownload={exportActions.onPdf}
            onWord={exportActions.onWord}
            onPrint={printDocument}
            onDelete={setDeleteTarget}
          />
        )}
        {page === "settings" && (
          <SettingsPage
            value={settings}
            onSave={(next) => {
              setSettings(next);
              saveJson(STORAGE_SETTINGS, next);
              notify("Business settings saved.");
            }}
          />
        )}
        {page === "preview" && previewInvoice && (
          <Preview
            invoice={previewInvoice}
            onBack={() =>
              previewInvoice.id === editing.id ? navigate("create") : navigate("history")
            }
            onEdit={() => editInvoice(previewInvoice)}
            {...exportActions}
          />
        )}
      </div>
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          <Icon name={toast.type === "success" ? "check" : "info"} />
          <span>{toast.message}</span>
        </div>
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete invoice?"
          description={`${deleteTarget.invoiceNumber} for ${deleteTarget.client.name || "this client"} will be permanently removed from this browser.`}
          confirmLabel="Delete invoice"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={removeInvoice}
          danger
        />
      )}
      {clearConfirm && (
        <ConfirmDialog
          title="Clear this form?"
          description="All unsaved changes in the current invoice will be removed."
          confirmLabel="Clear form"
          onCancel={() => setClearConfirm(false)}
          onConfirm={() => {
            setEditing(blankInvoice(settings, invoices));
            setClearConfirm(false);
            notify("Form cleared.", "info");
          }}
          danger
        />
      )}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">
        <span>i</span>
      </div>
      <div>
        <strong>{APP_NAME}</strong>
        {!compact && <small>{APP_TAGLINE}</small>}
      </div>
    </div>
  );
}

function Sidebar({
  page,
  previewIsDraft,
  open,
  onNavigate,
  onNew,
  onClose,
}: {
  page: Page;
  previewIsDraft: boolean;
  open: boolean;
  onNavigate: (p: Page) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const links: { id: Page; label: string; icon: IconName }[] = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "create", label: "Create invoice", icon: "invoice" },
    { id: "history", label: "Invoice history", icon: "history" },
    { id: "settings", label: "Business settings", icon: "settings" },
  ];
  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-head">
          <Brand />
          <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
            <Icon name="x" />
          </button>
        </div>
        <Button variant="primary" icon="plus" className="sidebar-create" onClick={onNew}>
          Create new invoice
        </Button>
        <nav>
          {links.map((link) => (
            <button
              key={link.id}
              className={
                page === link.id ||
                (page === "preview" && link.id === (previewIsDraft ? "create" : "history"))
                  ? "active"
                  : ""
              }
              onClick={() => onNavigate(link.id)}
            >
              <Icon name={link.icon} />
              <span>{link.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="currency-chip">KD</div>
          <div>
            <strong>Kuwaiti Dinar</strong>
            <small>3 decimal precision</small>
          </div>
        </div>
      </aside>
      {open && <button className="scrim" onClick={onClose} aria-label="Close menu" />}
    </>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

interface RowActions {
  onView: (i: Invoice) => void;
  onEdit: (i: Invoice) => void;
  onDuplicate: (i: Invoice) => void;
  onDownload: (i: Invoice) => void;
  onWord: (i: Invoice) => void;
  onDelete: (i: Invoice) => void;
}

function Dashboard({
  invoices,
  onNew,
  onHistory,
  ...actions
}: { invoices: Invoice[]; onNew: () => void; onHistory: () => void } & RowActions) {
  // All figures come from the invoices saved in this browser, so they update
  // as soon as an invoice is saved, edited or deleted.
  const total = invoices.reduce((sum, invoice) => sum + getTotals(invoice).grandTotal, 0);
  const currentMonth = today().slice(0, 7);
  const monthTotal = invoices
    .filter((i) => i.invoiceDate.startsWith(currentMonth))
    .reduce((sum, i) => sum + getTotals(i).grandTotal, 0);
  const sorted = [...invoices].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  const latest = sorted[0]?.invoiceDate;
  return (
    <main className="page dashboard-page">
      <PageHeader
        eyebrow={`${APP_NAME} · ${APP_TAGLINE}`}
        title="Good business starts with a clear invoice."
        description="Create, track, and manage your KWD invoices from one simple workspace."
        action={
          <div className="header-actions">
            <Button icon="history" onClick={onHistory}>
              Invoice history
            </Button>
            <Button variant="primary" icon="plus" onClick={onNew}>
              Create new invoice
            </Button>
          </div>
        }
      />
      <section className="stats-grid">
        <Stat
          label="Total invoices"
          value={String(invoices.length)}
          note="All saved records"
          icon="invoice"
        />
        <Stat
          label="Total invoice value"
          value={formatKD(total)}
          note="Lifetime value"
          icon="dashboard"
        />
        <Stat
          label="This month"
          value={formatKD(monthTotal)}
          note={new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
            new Date(),
          )}
          icon="history"
        />
        <Stat
          label="Latest invoice"
          value={latest ? formatDate(latest) : "—"}
          note={latest ? sorted[0].invoiceNumber : "No invoices yet"}
          icon="check"
        />
      </section>
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Recent invoices</h2>
            <p>Your latest saved drafts and finalized invoices.</p>
          </div>
          {invoices.length > 0 && (
            <Button variant="ghost" onClick={onHistory}>
              View all <Icon name="arrow" />
            </Button>
          )}
        </header>
        {invoices.length ? (
          <InvoiceTable invoices={sorted.slice(0, 6)} {...actions} />
        ) : (
          <EmptyState onNew={onNew} compact />
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: IconName;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon name={icon} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function InvoiceTable({
  invoices,
  onView,
  onEdit,
  onDuplicate,
  onDownload,
  onWord,
  onDelete,
  onPrint,
}: { invoices: Invoice[]; onPrint?: (i: Invoice) => void } & RowActions) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Client</th>
            <th>Date</th>
            <th>Total</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <button className="invoice-link" onClick={() => onView(invoice)}>
                  {invoice.invoiceNumber}
                </button>
                <small>{invoice.referenceNumber || "No reference"}</small>
              </td>
              <td>
                <strong>{invoice.client.name || "Unnamed client"}</strong>
                <small>{invoice.client.company}</small>
              </td>
              <td>{formatDate(invoice.invoiceDate)}</td>
              <td className="amount-cell">{formatKD(getTotals(invoice).grandTotal)}</td>
              <td>
                <StatusBadge status={invoice.status} />
              </td>
              <td>
                <div className="row-actions">
                  <ActionButton label="View" icon="eye" onClick={() => onView(invoice)} />
                  <ActionButton label="Edit" icon="edit" onClick={() => onEdit(invoice)} />
                  <ActionButton
                    label="Duplicate"
                    icon="copy"
                    onClick={() => onDuplicate(invoice)}
                  />
                  {onPrint && (
                    <ActionButton label="Print" icon="print" onClick={() => onPrint(invoice)} />
                  )}
                  <ActionButton
                    label="Download PDF"
                    icon="download"
                    onClick={() => onDownload(invoice)}
                  />
                  <ActionButton
                    label="Download Word (.docx)"
                    icon="word"
                    onClick={() => onWord(invoice)}
                  />
                  <ActionButton
                    label="Delete"
                    icon="trash"
                    danger
                    onClick={() => onDelete(invoice)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function validateInvoice(invoice: Invoice, status: Invoice["status"], invoices: Invoice[]) {
  const errors: Record<string, string> = {};
  if (!invoice.invoiceNumber.trim()) errors.invoiceNumber = "Invoice number is required.";
  if (
    invoices.some(
      (i) =>
        i.invoiceNumber.toLowerCase() === invoice.invoiceNumber.trim().toLowerCase() &&
        i.id !== invoice.id,
    )
  )
    errors.invoiceNumber = "This invoice number is already in use.";
  if (status === "finalized") {
    if (!invoice.invoiceDate) errors.invoiceDate = "Invoice date is required.";
    if (!invoice.client.name.trim()) errors.clientName = "Client name is required.";
    if (!invoice.lineItems.length) errors.lineItems = "Add at least one line item.";
    invoice.lineItems.forEach((item, index) => {
      if (!item.description.trim()) errors[`description-${index}`] = "Description is required.";
      if (parseMills(item.quantity) <= 0)
        errors[`quantity-${index}`] = "Enter a quantity greater than zero.";
      if (item.unitPriceMills < 0) errors[`price-${index}`] = "Price cannot be negative.";
    });
  }
  return errors;
}

function InvoiceEditor({
  invoice,
  invoices,
  onChange,
  onSave,
  onPreview,
  onPrint,
  onPdf,
  onWord,
  busy,
  onClear,
}: {
  invoice: Invoice;
  invoices: Invoice[];
  onChange: (i: Invoice) => void;
  onSave: (i: Invoice, status: Invoice["status"]) => Record<string, string> | undefined;
  onPreview: () => void;
  onClear: () => void;
} & ExportProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const totals = getTotals(invoice);
  const update = <K extends keyof Invoice>(key: K, value: Invoice[K]) =>
    onChange({ ...invoice, [key]: value });
  const updateIssuer = (key: keyof BusinessDetails, value: string) =>
    update("issuer", { ...invoice.issuer, [key]: value });
  const updateClient = (key: keyof Invoice["client"], value: string) =>
    update("client", { ...invoice.client, [key]: value });
  const save = (status: Invoice["status"]) => setErrors(onSave(invoice, status) ?? {});
  const updateItem = (id: string, patch: Partial<LineItem>) =>
    update(
      "lineItems",
      invoice.lineItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const addItem = () =>
    update("lineItems", [
      ...invoice.lineItems,
      { id: uid(), description: "", quantity: "1", unitPriceMills: 0 },
    ]);
  const duplicateItem = (index: number) =>
    update("lineItems", [
      ...invoice.lineItems.slice(0, index + 1),
      { ...invoice.lineItems[index], id: uid() },
      ...invoice.lineItems.slice(index + 1),
    ]);
  const deleteItem = (id: string) =>
    update(
      "lineItems",
      invoice.lineItems.filter((i) => i.id !== id),
    );
  return (
    <main className="page editor-page">
      <PageHeader
        eyebrow={invoices.some((i) => i.id === invoice.id) ? "Edit invoice" : "New invoice"}
        title={invoice.invoiceNumber || "New invoice"}
        description="Build a clear, professional invoice. Changes are saved only when you choose an action below."
        action={
          <div className="header-actions">
            <Button icon="eye" onClick={onPreview}>
              Preview
            </Button>
            <Button variant="primary" icon="save" onClick={() => save("finalized")}>
              Save invoice
            </Button>
          </div>
        }
      />
      <div className="editor-layout">
        <div className="editor-form">
          <Section
            title="Business details"
            description="Issuer information shown at the top of the invoice."
          >
            <div className="form-grid two">
              <Field label="Business / freelancer name">
                <input
                  value={invoice.issuer.name}
                  onChange={(e) => updateIssuer("name", e.target.value)}
                  placeholder="Your business name"
                />
              </Field>
              <Field label="Email address">
                <input
                  type="email"
                  value={invoice.issuer.email}
                  onChange={(e) => updateIssuer("email", e.target.value)}
                  placeholder="accounts@business.com"
                />
              </Field>
              <Field label="Business address">
                <input
                  value={singleLine(invoice.issuer.address)}
                  onChange={(e) => updateIssuer("address", e.target.value)}
                  placeholder="Street, area, Kuwait"
                />
              </Field>
              <Field label="Contact number">
                <input
                  value={invoice.issuer.phone}
                  onChange={(e) => updateIssuer("phone", e.target.value)}
                  placeholder="+965 0000 0000"
                />
              </Field>
              <Field label="Website (optional)">
                <input
                  value={invoice.issuer.website}
                  onChange={(e) => updateIssuer("website", e.target.value)}
                  placeholder="yourbusiness.com"
                />
              </Field>
              <LogoField
                logo={invoice.issuer.logo}
                onChange={(value) => updateIssuer("logo", value)}
              />
            </div>
          </Section>
          <Section
            title="Invoice information"
            description="A unique number is generated automatically and can be edited."
          >
            <div className="form-grid three">
              <Field label="Invoice number" error={errors.invoiceNumber}>
                <input
                  value={invoice.invoiceNumber}
                  onChange={(e) => update("invoiceNumber", e.target.value)}
                />
              </Field>
              <Field label="Invoice date" error={errors.invoiceDate}>
                <DatePicker
                  label="Invoice date"
                  value={invoice.invoiceDate}
                  onChange={(value) => update("invoiceDate", value)}
                />
              </Field>
              <Field label="Status">
                <select
                  value={invoice.status}
                  onChange={(e) => update("status", e.target.value as Invoice["status"])}
                >
                  <option value="draft">Draft</option>
                  <option value="finalized">Finalized</option>
                </select>
              </Field>
              <Field label="Reference number (optional)">
                <input
                  value={invoice.referenceNumber}
                  onChange={(e) => update("referenceNumber", e.target.value)}
                  placeholder="e.g. SEP/40520/B"
                />
              </Field>
              <Field
                label="Due date (optional)"
                error={
                  invoice.dueDate && invoice.invoiceDate && invoice.dueDate < invoice.invoiceDate
                    ? "Due date is before the invoice date."
                    : undefined
                }
              >
                <DatePicker
                  label="Due date"
                  value={invoice.dueDate}
                  min={invoice.invoiceDate}
                  allowClear
                  placeholder="No due date"
                  onChange={(value) => update("dueDate", value)}
                />
              </Field>
            </div>
          </Section>
          <Section title="Client information" description="Who this invoice is addressed to.">
            <div className="form-grid two">
              <Field label="Client name" error={errors.clientName}>
                <input
                  value={invoice.client.name}
                  onChange={(e) => updateClient("name", e.target.value)}
                  placeholder="Client full name"
                />
              </Field>
              <Field label="Company name (optional)">
                <input
                  value={invoice.client.company}
                  onChange={(e) => updateClient("company", e.target.value)}
                  placeholder="Company or project name"
                />
              </Field>
              <Field label="Client address">
                <input
                  value={singleLine(invoice.client.address)}
                  onChange={(e) => updateClient("address", e.target.value)}
                  placeholder="Client billing address"
                />
              </Field>
              <Field label="Contact number (optional)">
                <input
                  value={invoice.client.phone}
                  onChange={(e) => updateClient("phone", e.target.value)}
                />
              </Field>
              <Field label="Email address (optional)">
                <input
                  type="email"
                  value={invoice.client.email}
                  onChange={(e) => updateClient("email", e.target.value)}
                />
              </Field>
            </div>
          </Section>
          <Section
            title="Line items"
            description="Quantities and unit prices calculate automatically in KD."
          >
            {errors.lineItems && <p className="section-error">{errors.lineItems}</p>}
            <div className="items-desktop">
              <div className="item-head">
                <span>#</span>
                <span>Description</span>
                <span>Qty</span>
                <span>Unit price (KD)</span>
                <span>Total</span>
                <span />
              </div>
              {invoice.lineItems.map((item, index) => (
                <div className="item-row" key={item.id}>
                  <span className="item-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <input
                      aria-label={`Item ${index + 1} description`}
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Describe the product or service"
                    />
                    {errors[`description-${index}`] && (
                      <small className="field-error">{errors[`description-${index}`]}</small>
                    )}
                  </div>
                  <div>
                    <QtyInput
                      label={`Item ${index + 1} quantity`}
                      value={item.quantity}
                      onChange={(quantity) => updateItem(item.id, { quantity })}
                    />
                    {errors[`quantity-${index}`] && (
                      <small className="field-error">{errors[`quantity-${index}`]}</small>
                    )}
                  </div>
                  <div className="money-input">
                    <span>KD</span>
                    <MoneyInput
                      aria-label={`Item ${index + 1} unit price`}
                      mills={item.unitPriceMills}
                      onChange={(unitPriceMills) => updateItem(item.id, { unitPriceMills })}
                    />
                  </div>
                  <strong>{formatKD(lineTotal(item))}</strong>
                  <div className="row-actions">
                    <ActionButton
                      label="Duplicate item"
                      icon="copy"
                      onClick={() => duplicateItem(index)}
                    />
                    <ActionButton
                      label="Delete item"
                      icon="trash"
                      danger
                      onClick={() => deleteItem(item.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="items-mobile">
              {invoice.lineItems.map((item, index) => (
                <article className="item-card" key={item.id}>
                  <header>
                    <strong>Item {index + 1}</strong>
                    <div className="row-actions">
                      <ActionButton
                        label="Duplicate item"
                        icon="copy"
                        onClick={() => duplicateItem(index)}
                      />
                      <ActionButton
                        label="Delete item"
                        icon="trash"
                        danger
                        onClick={() => deleteItem(item.id)}
                      />
                    </div>
                  </header>
                  <Field label="Description" error={errors[`description-${index}`]}>
                    <textarea
                      rows={2}
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    />
                  </Field>
                  <div className="form-grid two">
                    <Field label="Quantity" error={errors[`quantity-${index}`]}>
                      <QtyInput
                        label={`Item ${index + 1} quantity`}
                        value={item.quantity}
                        onChange={(quantity) => updateItem(item.id, { quantity })}
                      />
                    </Field>
                    <Field label="Unit price (KD)">
                      <MoneyInput
                        mills={item.unitPriceMills}
                        onChange={(unitPriceMills) => updateItem(item.id, { unitPriceMills })}
                      />
                    </Field>
                  </div>
                  <div className="item-card-total">
                    <span>Line total</span>
                    <strong>{formatKD(lineTotal(item))}</strong>
                  </div>
                </article>
              ))}
            </div>
            <Button icon="plus" onClick={addItem}>
              Add item
            </Button>
          </Section>
          <Section
            title="Financial summary"
            description="Optional adjustments are zero by default; no tax is added."
          >
            <div className="financial-grid">
              <div className="adjustments">
                <div className="discount-row">
                  <Field label="Discount type">
                    <select
                      value={invoice.discountType}
                      onChange={(e) =>
                        update("discountType", e.target.value as Invoice["discountType"])
                      }
                    >
                      <option value="fixed">Fixed amount</option>
                      <option value="percent">Percentage</option>
                    </select>
                  </Field>
                  <Field
                    label={invoice.discountType === "fixed" ? "Discount (KD)" : "Discount (%)"}
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={invoice.discountType === "percent" ? 100 : undefined}
                      step={invoice.discountType === "fixed" ? "0.001" : "0.01"}
                      value={invoice.discountValue}
                      onChange={(e) => update("discountValue", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Additional charges (KD)">
                  <MoneyInput
                    mills={invoice.additionalChargesMills}
                    onChange={(value) => update("additionalChargesMills", value)}
                  />
                </Field>
              </div>
              <div className="totals-box">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatKD(totals.subtotal)}</strong>
                </div>
                <div>
                  <span>Discount</span>
                  <strong>− {formatKD(totals.discount)}</strong>
                </div>
                <div>
                  <span>Additional charges</span>
                  <strong>{formatKD(invoice.additionalChargesMills)}</strong>
                </div>
                <div className="total-line">
                  <span>Grand total</span>
                  <strong>{formatKD(totals.grandTotal)}</strong>
                </div>
              </div>
            </div>
            <div className="words-box">
              <span>Amount in words</span>
              <strong>{amountInWords(totals.grandTotal)}</strong>
            </div>
          </Section>
          <Section
            title="Additional information"
            description="Optional details displayed near the end of the invoice."
          >
            <div className="form-grid two">
              <Field label="Notes">
                <textarea
                  rows={4}
                  value={invoice.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="A note for your client"
                />
              </Field>
              <Field label="Payment instructions">
                <textarea
                  rows={4}
                  value={invoice.paymentInstructions}
                  onChange={(e) => update("paymentInstructions", e.target.value)}
                  placeholder="Bank transfer or payment details"
                />
              </Field>
              <Field label="Terms and conditions">
                <textarea
                  rows={4}
                  value={invoice.terms}
                  onChange={(e) => update("terms", e.target.value)}
                />
              </Field>
              <Field label="Thank-you message">
                <textarea
                  rows={4}
                  value={invoice.thankYou}
                  onChange={(e) => update("thankYou", e.target.value)}
                />
              </Field>
              <Field label="Issuer signature name (optional)">
                <input
                  value={invoice.issuerSignature}
                  onChange={(e) => update("issuerSignature", e.target.value)}
                  placeholder="Authorized signatory"
                />
              </Field>
              <Field label="Client signature name (optional)">
                <input
                  value={invoice.clientSignature}
                  onChange={(e) => update("clientSignature", e.target.value)}
                />
              </Field>
            </div>
          </Section>
        </div>
        <aside className="editor-summary">
          <div className="summary-card">
            <span>Invoice total</span>
            <strong>{formatKD(totals.grandTotal)}</strong>
            <div>
              <span>
                {invoice.lineItems.length} {invoice.lineItems.length === 1 ? "item" : "items"}
              </span>
              <StatusBadge status={invoice.status} />
            </div>
          </div>
          <div className="summary-actions">
            <Button variant="primary" icon="save" onClick={() => save("finalized")}>
              Save invoice
            </Button>
            <Button icon="save" onClick={() => save("draft")}>
              Save draft
            </Button>
            <Button icon="eye" onClick={onPreview}>
              Preview invoice
            </Button>
            <ExportButtons invoice={invoice} busy={busy} onPdf={onPdf} onWord={onWord} onPrint={onPrint} />
            <Button variant="ghost" onClick={onClear}>
              Clear form
            </Button>
          </div>
          <p className="save-note">
            <Icon name="info" size={16} /> Everything stays on this device. Saved invoices are
            kept only in this browser — clearing its data erases them.
          </p>
        </aside>
      </div>
      <div className="mobile-actionbar">
        <div>
          <span>Grand total</span>
          <strong>{formatKD(totals.grandTotal)}</strong>
        </div>
        <Button variant="primary" icon="download" disabled={!!busy} onClick={() => onPdf(invoice)}>
          PDF
        </Button>
        <Button icon="word" disabled={!!busy} onClick={() => onWord(invoice)}>
          Word
        </Button>
        <ActionButton label="Print invoice" icon="print" onClick={() => onPrint(invoice)} />
      </div>
    </main>
  );
}

interface ExportProps {
  busy: ExportKind | "print" | null;
  onPdf: (i: Invoice) => void;
  onWord: (i: Invoice) => void;
  onPrint: (i: Invoice) => void;
}

function ExportButtons({
  invoice,
  busy,
  onPdf,
  onWord,
  onPrint,
  primary,
}: ExportProps & { invoice: Invoice; primary?: boolean }) {
  return (
    <>
      <Button
        icon="download"
        variant={primary ? "primary" : "secondary"}
        disabled={!!busy}
        onClick={() => onPdf(invoice)}
      >
        {busy === "pdf" ? "Creating PDF…" : "Download PDF"}
      </Button>
      <Button icon="word" disabled={!!busy} onClick={() => onWord(invoice)}>
        {busy === "docx" ? "Creating Word…" : "Download Word"}
      </Button>
      <Button icon="print" disabled={!!busy} onClick={() => onPrint(invoice)}>
        Print invoice
      </Button>
    </>
  );
}

function LogoField({ logo, onChange }: { logo?: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const handleFile = (file?: File) => {
    if (!file) return;
    if (file.size > 800_000) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };
  return (
    <div className="field">
      <span>Logo (optional)</span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="logo-upload">
        {logo ? (
          <img src={logo} alt="Business logo preview" />
        ) : (
          <span>
            <Icon name="upload" /> PNG or JPG, under 800 KB
          </span>
        )}
        <Button type="button" onClick={() => input.current?.click()}>
          {logo ? "Replace" : "Upload logo"}
        </Button>
        {logo && (
          <Button type="button" variant="ghost" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function History({
  invoices,
  onNew,
  onView,
  onEdit,
  onDuplicate,
  onDownload,
  onWord,
  onPrint,
  onDelete,
}: { invoices: Invoice[]; onNew: () => void; onPrint: (i: Invoice) => void } & RowActions) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return invoices
      .filter(
        (i) =>
          (!query ||
            `${i.invoiceNumber} ${i.client.name} ${i.referenceNumber}`
              .toLowerCase()
              .includes(query)) &&
          (status === "all" || i.status === status) &&
          (!from || i.invoiceDate >= from) &&
          (!to || i.invoiceDate <= to),
      )
      .sort((a, b) =>
        sort === "oldest"
          ? a.invoiceDate.localeCompare(b.invoiceDate)
          : sort === "highest"
            ? getTotals(b).grandTotal - getTotals(a).grandTotal
            : sort === "lowest"
              ? getTotals(a).grandTotal - getTotals(b).grandTotal
              : b.invoiceDate.localeCompare(a.invoiceDate),
      );
  }, [invoices, search, status, sort, from, to]);
  return (
    <main className="page">
      <PageHeader
        eyebrow="Optional · on this device only"
        title="Invoice history"
        description="Invoices you choose to save are kept only in this browser on this device — nothing is uploaded. Clearing browser data erases them, so keep exported PDF or Word copies of anything important."
        action={
          <Button variant="primary" icon="plus" onClick={onNew}>
            Create new invoice
          </Button>
        }
      />
      {invoices.length ? (
        <section className="panel">
          <div className="filters">
            <label className="search-box">
              <Icon name="search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice, client, or reference"
              />
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All invoices</option>
              <option value="draft">Draft</option>
              <option value="finalized">Finalized</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort invoices"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest amount</option>
              <option value="lowest">Lowest amount</option>
            </select>
            <label className="date-filter">
              <span>From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="date-filter">
              <span>To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          {filtered.length ? (
            <>
              <div className="result-count">
                {filtered.length} {filtered.length === 1 ? "invoice" : "invoices"}
              </div>
              <InvoiceTable
                invoices={filtered}
                onView={onView}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDownload={onDownload}
                onWord={onWord}
                onPrint={onPrint}
                onDelete={onDelete}
              />
            </>
          ) : (
            <div className="no-results">
              <Icon name="search" size={28} />
              <h3>No matching invoices</h3>
              <p>Try changing your search or filters.</p>
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          <EmptyState onNew={onNew} />
        </section>
      )}
    </main>
  );
}

function EmptyState({ onNew, compact = false }: { onNew: () => void; compact?: boolean }) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <div className="empty-icon">
        <Icon name="invoice" size={30} />
      </div>
      <h3>No invoices yet</h3>
      <p>
        Create your first professional KWD invoice. It will appear here automatically after you save
        it.
      </p>
      <Button variant="primary" icon="plus" onClick={onNew}>
        Create first invoice
      </Button>
    </div>
  );
}

function SettingsPage({ value, onSave }: { value: Settings; onSave: (value: Settings) => void }) {
  const [form, setForm] = useState(structuredClone(value));
  const updateBusiness = (key: keyof BusinessDetails, next: string) =>
    setForm({ ...form, business: { ...form.business, [key]: next } });
  return (
    <main className="page settings-page">
      <PageHeader
        eyebrow="Preferences"
        title="Business settings"
        description="These defaults apply to future invoices. Historical invoices keep their saved details."
        action={
          <Button variant="primary" icon="save" onClick={() => onSave(form)}>
            Save settings
          </Button>
        }
      />
      <Section title="Business profile" description="Default issuer details for every new invoice.">
        <div className="form-grid two">
          <Field label="Business / freelancer name">
            <input
              value={form.business.name}
              onChange={(e) => updateBusiness("name", e.target.value)}
            />
          </Field>
          <Field label="Email address">
            <input
              type="email"
              value={form.business.email}
              onChange={(e) => updateBusiness("email", e.target.value)}
            />
          </Field>
          <Field label="Address">
            <input
              value={singleLine(form.business.address)}
              onChange={(e) => updateBusiness("address", e.target.value)}
            />
          </Field>
          <Field label="Contact number">
            <input
              value={form.business.phone}
              onChange={(e) => updateBusiness("phone", e.target.value)}
            />
          </Field>
          <Field label="Website">
            <input
              value={form.business.website}
              onChange={(e) => updateBusiness("website", e.target.value)}
            />
          </Field>
          <LogoField logo={form.business.logo} onChange={(next) => updateBusiness("logo", next)} />
        </div>
      </Section>
      <Section
        title="Invoice preferences"
        description="Currency and precision are fixed for accurate Kuwaiti Dinar invoices."
      >
        <div className="form-grid two">
          <Field label="Currency">
            <input value="Kuwaiti Dinar (KWD)" disabled />
          </Field>
          <Field label="Currency display">
            <input value="KD" disabled />
          </Field>
          <Field label="Decimal precision">
            <input value="3 decimal places" disabled />
          </Field>
          <Field
            label="Default invoice prefix"
            hint={`New numbers will look like ${form.invoicePrefix || "INV"}-${new Date().getFullYear()}-001`}
          >
            <input
              value={form.invoicePrefix}
              onChange={(e) =>
                setForm({
                  ...form,
                  invoicePrefix: e.target.value.toUpperCase().replace(/\s+/g, "-"),
                })
              }
              maxLength={12}
            />
          </Field>
          <Field label="Default thank-you message">
            <textarea
              rows={3}
              value={form.defaultThankYou}
              onChange={(e) => setForm({ ...form, defaultThankYou: e.target.value })}
            />
          </Field>
          <Field label="Default payment terms">
            <textarea
              rows={3}
              value={form.defaultTerms}
              onChange={(e) => setForm({ ...form, defaultTerms: e.target.value })}
            />
          </Field>
          <Field label="Default payment instructions">
            <textarea
              rows={3}
              value={form.defaultPaymentInstructions}
              onChange={(e) => setForm({ ...form, defaultPaymentInstructions: e.target.value })}
            />
          </Field>
        </div>
      </Section>
      <div className="settings-save">
        <Button variant="primary" icon="save" onClick={() => onSave(form)}>
          Save settings
        </Button>
      </div>
    </main>
  );
}

function Preview({
  invoice,
  onBack,
  onEdit,
  ...exportProps
}: {
  invoice: Invoice;
  onBack: () => void;
  onEdit: () => void;
} & ExportProps) {
  const canvas = useRef<HTMLDivElement>(null);
  const fit = useRef<HTMLDivElement>(null);
  // Scale the 210mm sheet down to the available width (phones) without
  // affecting print, which resets the transform.
  useLayoutEffect(() => {
    const host = canvas.current;
    const wrapper = fit.current;
    const sheet = wrapper?.firstElementChild as HTMLElement | null;
    if (!host || !wrapper || !sheet) return;
    const resize = () => {
      const style = getComputedStyle(host);
      const available =
        host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const scale = Math.min(1, available / sheet.offsetWidth);
      sheet.style.transform = scale < 1 ? `scale(${scale})` : "";
      wrapper.style.width = `${sheet.offsetWidth * scale}px`;
      wrapper.style.height = `${sheet.offsetHeight * scale}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [invoice]);
  return (
    <main className="page preview-page">
      <PageHeader
        eyebrow="Document preview"
        title={invoice.invoiceNumber}
        description="Review the final A4 document, then download it as PDF or Word, or print it."
        action={
          <div className="header-actions">
            <Button icon="arrow" className="back-button" onClick={onBack}>
              Back
            </Button>
            <Button icon="edit" onClick={onEdit}>
              Edit
            </Button>
            <ExportButtons invoice={invoice} primary {...exportProps} />
          </div>
        }
      />
      <div className="preview-canvas" ref={canvas}>
        <div className="sheet-fit" ref={fit}>
          <InvoiceDocument invoice={invoice} />
        </div>
      </div>
    </main>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  danger,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <div className="dialog-layer" role="presentation">
      <div className="dialog" role="alertdialog" aria-modal="true">
        <div className="dialog-icon">
          <Icon name="trash" />
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
