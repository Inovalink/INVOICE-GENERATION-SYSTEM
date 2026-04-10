'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote,
  Building2,
  Check,
  CreditCard,
  FileText,
  Printer,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { RECEIPT_DEFAULT_NOTE } from '@/lib/receiptDefaultNotes';
import { getPaymentMethodSubtext, getPaymentMethodTitle } from '@/lib/paymentDisplay';
import './ReceiptModal.css';

export type ReceiptModalPayload = {
  receipt: {
    id: string;
    receiptNumber: string;
    issueDate: string;
    totalAmount: number;
    notes: string | null;
  };
  issuer: {
    name: string;
    email: string;
  };
  invoice: {
    invoiceNumber: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    amountDue: number;
    client: {
      name: string;
      company: string | null;
      email: string | null;
      address: string | null;
    };
    items: {
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }[];
  };
  payments: { paymentMethod: string; transactionRef: string | null; notes: string | null }[];
};

function PaymentMethodMark({
  payment,
}: {
  payment: { paymentMethod: string; notes: string | null };
}) {
  const notes = payment.notes?.trim() ?? '';
  const common = { size: 18 as const, strokeWidth: 1.75 as const };

  if (payment.paymentMethod === 'MOBILE_MONEY') {
    if (notes.startsWith('MTN Momo')) {
      return (
        <img
          src="/Assets/Mtn_momo.svg"
          alt=""
          className="receipt-payment-method-mark-img"
        />
      );
    }
    if (notes.startsWith('Telecel Cash')) {
      return (
        <img
          src="/Assets/Telecel_cash.png"
          alt=""
          className="receipt-payment-method-mark-img receipt-payment-method-mark-img--telecel"
        />
      );
    }
    return <Smartphone {...common} />;
  }

  switch (payment.paymentMethod) {
    case 'BANK_TRANSFER':
      return <Building2 {...common} />;
    case 'CREDIT_CARD':
      return <CreditCard {...common} />;
    case 'CASH':
      return <Banknote {...common} className="receipt-payment-method-mark-icon--cash" />;
    default:
      return <Wallet {...common} />;
  }
}

function ReceiptUrlBarcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !value) return;
    try {
      while (el.firstChild) el.removeChild(el.firstChild);
      JsBarcode(el, value, {
        format: 'CODE128',
        lineColor: '#0a0a0a',
        background: '#ffffff',
        width: 1.25,
        height: 120,
        margin: 12,
        displayValue: false,
      });
    } catch {
      /* invalid length / chars for symbology */
    }
  }, [value]);

  return (
    <svg
      ref={svgRef}
      className="receipt-footer-barcode-svg"
      role="img"
      aria-label="Barcode that encodes a link to this receipt"
    />
  );
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQty(q: number): string {
  if (Number.isInteger(q)) return String(q);
  return q.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function ReceiptDocumentContent({
  data,
  receiptPublicUrl,
}: {
  data: ReceiptModalPayload;
  receiptPublicUrl: string;
}) {
  const issueDateShort = new Date(data.receipt.issueDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const discountPct =
    data.invoice.subtotal > 0.009 && data.invoice.discount > 0
      ? Math.round((data.invoice.discount / data.invoice.subtotal) * 1000) / 10
      : null;

  const discountPctLabel =
    discountPct == null
      ? ''
      : discountPct % 1 === 0
        ? String(discountPct)
        : discountPct.toFixed(1);

  const footerDateTime = (() => {
    const d = new Date(data.receipt.issueDate);
    const day = d.getDate();
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    const time = d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${day} ${month} ${year} · ${time}`;
  })();

  const paymentSubtext =
    data.payments.length > 0
      ? getPaymentMethodSubtext(data.payments[0], data.invoice.client.name)
      : null;

  return (
    <article className="receipt-document">
      <div className="receipt-premium-topbar">
        <div className="receipt-premium-brandlock">
          <div className="receipt-doc-logo" aria-hidden>
            <FileText size={22} color="#ffffff" strokeWidth={2.5} aria-hidden />
          </div>
          <span className="receipt-premium-wordmark">FinTrack</span>
        </div>
        <span className="receipt-premium-doc-type">Receipt</span>
      </div>

      <div className="receipt-hero">
        <p className="receipt-hero-lead">FinTrack received your payment of</p>
        <p className="receipt-hero-amount" aria-label="Amount received">
          <span className="receipt-hero-currency">$</span>
          {formatMoney(data.receipt.totalAmount)}
        </p>
        <div className="receipt-hero-status">
          <Check className="receipt-hero-check" strokeWidth={2.5} size={18} aria-hidden />
          <span>Successful</span>
        </div>
      </div>

      <section className="receipt-payment-meta-grid" aria-label="Receipt details">
        <div className="receipt-payment-meta-card">
          <p className="receipt-party-label">Receipt</p>
          <p className="receipt-party-value">{data.receipt.receiptNumber}</p>
        </div>
        <div className="receipt-payment-meta-card">
          <p className="receipt-party-label">Issued</p>
          <p className="receipt-party-value">{issueDateShort}</p>
        </div>
        <div className="receipt-payment-meta-card">
          <p className="receipt-party-label">Invoice</p>
          <p className="receipt-party-value">{data.invoice.invoiceNumber}</p>
        </div>
        <div className="receipt-payment-meta-card">
          <p className="receipt-party-label">Status</p>
          <span className="receipt-party-status-paid">Paid</span>
        </div>
      </section>

      <section className="receipt-payment-parties" aria-label="Billing parties">
        <div>
          <p className="receipt-party-label">Billed by</p>
          <p className="receipt-party-value">FinTrack</p>
          <p className="receipt-party-muted">{data.issuer.email}</p>
        </div>
        <div>
          <p className="receipt-party-label">Bill to</p>
          <p className="receipt-party-value">
            {data.invoice.client.name}
            {data.invoice.client.company ? ` (${data.invoice.client.company})` : ''}
          </p>
          {data.invoice.client.address && (
            <p className="receipt-party-muted">{data.invoice.client.address}</p>
          )}
          {data.invoice.client.email && (
            <p className="receipt-party-muted">{data.invoice.client.email}</p>
          )}
        </div>
      </section>

      <section
        className="receipt-checkout-items receipt-checkout-items-card"
        aria-label="Line items and totals"
      >
        <h2 className="receipt-items-section-label">Line items</h2>
        <div className="receipt-items-header-row">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span>Amount</span>
        </div>
        {data.invoice.items.length === 0 ? (
          <div className="receipt-items-row receipt-items-row--empty">
            <span>No line items</span>
          </div>
        ) : (
          data.invoice.items.map((item) => (
            <div key={item.id} className="receipt-items-row">
              <span>{item.description}</span>
              <span>{formatQty(item.quantity)}</span>
              <span>${formatMoney(item.unitPrice)}</span>
              <span>${formatMoney(item.subtotal)}</span>
            </div>
          ))
        )}

        <div className="receipt-items-summary-block">
          <div className="receipt-items-summary-row">
            <span>Sub Total</span>
            <span>${formatMoney(data.invoice.subtotal)}</span>
          </div>
          <div className="receipt-items-summary-row">
            <span>
              {data.invoice.discount > 0 && discountPct != null
                ? `Discount (${discountPctLabel}% off)`
                : 'Discount'}
            </span>
            <span>
              {data.invoice.discount > 0
                ? `-$${formatMoney(data.invoice.discount)}`
                : '$0.00'}
            </span>
          </div>
          <div className="receipt-items-summary-row">
            <span>Tax</span>
            <span>${formatMoney(data.invoice.tax)}</span>
          </div>
          <div className="receipt-items-summary-row grand">
            <span>Grand Total</span>
            <span>${formatMoney(data.invoice.total)}</span>
          </div>
          <div className="receipt-items-summary-row">
            <span>Amount Paid</span>
            <span>${formatMoney(data.receipt.totalAmount)}</span>
          </div>
          <div
            className={`receipt-items-summary-row${
              data.invoice.amountDue > 0.009 ? ' due-highlight' : ''
            }`}
          >
            <span>Balance due</span>
            <span>${formatMoney(data.invoice.amountDue)}</span>
          </div>
        </div>
      </section>

      <div className="receipt-payment-note-row receipt-payment-note-row--split">
        <section className="receipt-payment-method-section" aria-label="Payment method">
          <div className="receipt-doc-well receipt-payment-method-card">
            <p className="receipt-payment-method-heading">Payment method</p>
            <div className="receipt-payment-method-row">
              <div className="receipt-payment-method-icon" aria-hidden>
                {data.payments.length > 0 ? (
                  <PaymentMethodMark payment={data.payments[0]} />
                ) : (
                  <Wallet size={18} strokeWidth={1.75} />
                )}
              </div>
              <div className="receipt-payment-method-text">
                <p className="receipt-payment-method-title">
                  {data.payments.length > 0
                    ? getPaymentMethodTitle(data.payments[0])
                    : '—'}
                </p>
                {paymentSubtext && (
                  <p className="receipt-payment-method-sub">{paymentSubtext}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="receipt-doc-notes receipt-doc-well">
          <span className="receipt-doc-notes-label">Note</span>
          <p className="receipt-doc-notes-body">{RECEIPT_DEFAULT_NOTE}</p>
        </aside>
      </div>

      <footer className="receipt-doc-footer receipt-doc-footer--visual">
        <div className="receipt-footer-barcode-wrap" aria-label="Barcode link to this receipt">
          {receiptPublicUrl ? (
            <>
              <ReceiptUrlBarcode value={receiptPublicUrl} />
              <span className="receipt-footer-scan-hint">Scan barcode to open receipt</span>
            </>
          ) : null}
        </div>
        <p className="receipt-footer-thanks">Thank you for choosing us</p>
        <p className="receipt-footer-wish">Have a great day!</p>
        <p className="receipt-footer-time">{footerDateTime}</p>
        <p className="receipt-footer-help receipt-footer-help--compact">
          Questions?{' '}
          <a href={`mailto:${data.issuer.email}`}>{data.issuer.email}</a>
        </p>
      </footer>
    </article>
  );
}

type ReceiptModalProps = {
  receiptId: string | null;
  onClose: () => void;
};

export default function ReceiptModal({ receiptId, onClose }: ReceiptModalProps) {
  const [data, setData] = useState<ReceiptModalPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptPublicUrl, setReceiptPublicUrl] = useState('');

  const load = useCallback(async () => {
    if (!receiptId) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/receipts/${receiptId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Could not load receipt');
      }
      const json = (await res.json()) as ReceiptModalPayload;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    if (receiptId) load();
  }, [receiptId, load]);

  useEffect(() => {
    if (!receiptId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [receiptId, onClose]);

  useEffect(() => {
    if (!receiptId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('receipt-print-active');
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove('receipt-print-active');
    };
  }, [receiptId]);

  useEffect(() => {
    if (!data?.receipt?.id) {
      setReceiptPublicUrl('');
      return;
    }
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const base = envBase || origin;
    if (!base) return;
    setReceiptPublicUrl(`${base}/receipts/${data.receipt.id}`);
  }, [data?.receipt?.id]);

  if (!receiptId) return null;

  const modal = (
    <div
      className="receipt-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="receipt-modal-shell">
        <div className="receipt-modal-toolbar">
          <div className="receipt-modal-toolbar-text">
            <p className="receipt-modal-toolbar-label" id="receipt-modal-title">
              Receipt
            </p>
            {data && (
              <p className="receipt-modal-toolbar-meta">
                <span className="receipt-modal-toolbar-id">{data.receipt.receiptNumber}</span>
                <span className="receipt-modal-toolbar-dot" aria-hidden>
                  ·
                </span>
                <span>{data.invoice.invoiceNumber}</span>
              </p>
            )}
          </div>
          <div className="receipt-modal-toolbar-actions">
            {data && (
              <button
                type="button"
                className="receipt-modal-icon-btn receipt-modal-icon-btn--primary"
                onClick={() => window.print()}
                aria-label="Print receipt"
                title="Print"
              >
                <Printer size={18} strokeWidth={1.75} />
              </button>
            )}
            <button
              type="button"
              className="receipt-modal-icon-btn"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="receipt-modal-body">
          {loading && (
            <div className="receipt-modal-loading" role="status">
              <span className="receipt-modal-loading-text">Loading receipt…</span>
            </div>
          )}
          {error && <div className="receipt-modal-error">{error}</div>}
          {data && !loading && !error && (
            <ReceiptDocumentContent data={data} receiptPublicUrl={receiptPublicUrl} />
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
