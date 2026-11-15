import type { Invoice } from "./types";
import { amountInWords, formatDate, formatKD, formatQty, getTotals, lineTotal } from "./lib";

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const totals = getTotals(invoice);
  const recipient = invoice.client.company || invoice.client.name;
  return (
    <article className="invoice-sheet">
      <header className="document-header">
        <div className="document-brand">
          {invoice.issuer.logo && (
            <img src={invoice.issuer.logo} alt="" className="document-logo" />
          )}
          <div>
            <h2>{invoice.issuer.name || "Your Business Name"}</h2>
            <p className="preline">{invoice.issuer.address || "Business address"}</p>
            <p>{[invoice.issuer.phone, invoice.issuer.email].filter(Boolean).join("  •  ")}</p>
            {invoice.issuer.website && <p>{invoice.issuer.website}</p>}
          </div>
        </div>
        <div className="document-title">
          <span>INVOICE</span>
          <strong>{invoice.invoiceNumber || "Invoice number"}</strong>
        </div>
      </header>

      <section className="document-meta">
        <div>
          <p className="document-label">BILL TO</p>
          <h3>{invoice.client.name || "Client name"}</h3>
          {invoice.client.company && <p>{invoice.client.company}</p>}
          <p className="preline">{invoice.client.address}</p>
          <p>{[invoice.client.phone, invoice.client.email].filter(Boolean).join("  •  ")}</p>
        </div>
        <dl>
          <div>
            <dt>Invoice date</dt>
            <dd>{formatDate(invoice.invoiceDate)}</dd>
          </div>
          {invoice.dueDate && (
            <div>
              <dt>Due date</dt>
              <dd>{formatDate(invoice.dueDate)}</dd>
            </div>
          )}
          {invoice.referenceNumber && (
            <div>
              <dt>Reference</dt>
              <dd>{invoice.referenceNumber}</dd>
            </div>
          )}
          <div>
            <dt>Status</dt>
            <dd className="capitalize">{invoice.status}</dd>
          </div>
        </dl>
      </section>

      <table className="document-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item, index) => (
            <tr key={item.id}>
              <td>{index + 1}</td>
              <td>{item.description || "Item description"}</td>
              <td>{formatQty(item.quantity)}</td>
              <td>{formatKD(item.unitPriceMills)}</td>
              <td>{formatKD(lineTotal(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="document-summary">
        <div className="amount-words">
          <p className="document-label">AMOUNT IN WORDS</p>
          <strong>{amountInWords(totals.grandTotal)}</strong>
        </div>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatKD(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div>
              <dt>Discount</dt>
              <dd>− {formatKD(totals.discount)}</dd>
            </div>
          )}
          {invoice.additionalChargesMills > 0 && (
            <div>
              <dt>Additional charges</dt>
              <dd>{formatKD(invoice.additionalChargesMills)}</dd>
            </div>
          )}
          <div className="grand-total">
            <dt>Grand total</dt>
            <dd>{formatKD(totals.grandTotal)}</dd>
          </div>
        </dl>
      </section>

      {(invoice.notes || invoice.paymentInstructions || invoice.terms) && (
        <section className="document-notes">
          {invoice.notes && (
            <div>
              <h4>Notes</h4>
              <p className="preline">{invoice.notes}</p>
            </div>
          )}
          {invoice.paymentInstructions && (
            <div>
              <h4>Payment instructions</h4>
              <p className="preline">{invoice.paymentInstructions}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <h4>Terms & conditions</h4>
              <p className="preline">{invoice.terms}</p>
            </div>
          )}
        </section>
      )}

      <footer className="document-footer">
        <p>{invoice.thankYou || "Thank you for your business."}</p>
        <div className="signature-grid">
          <div>
            <span>{invoice.issuerSignature}</span>
            <i /> <small>Issuer signature</small>
          </div>
          <div>
            <span>{invoice.clientSignature}</span>
            <i /> <small>{recipient ? `${recipient} signature` : "Client signature"}</small>
          </div>
        </div>
      </footer>
    </article>
  );
}
