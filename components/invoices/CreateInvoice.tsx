'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Send } from 'lucide-react';
import './CreateInvoice.css';
import DatePicker from '@/components/ui/DatePicker';
import { getCurrencySymbol } from '@/lib/currencyDisplay';

type ClientParams = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type ServiceParams = { id: string; name: string; price: number; category: string };

type InvoiceItemState = {
  id: string;
  serviceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type Status = 'PENDING' | 'PAID' | 'OVERDUE';
type InvoiceType = 'PROFORMA' | 'SALES';
type SalesPaymentStatus = 'pending' | 'partial' | 'paid';

const SALES_PAYMENT_TERMS = `Payment is due within 3-7 days from the invoice date.

This invoice reflects goods/services already delivered. Kindly ensure prompt payment.

Late payments may incur a 3% penalty fee on the outstanding balance.`;

const PROFORMA_NOTE =
  'This is a preliminary invoice for estimation purposes only and does not constitute a demand for payment.';

export default function CreateInvoice({
  clients,
  services,
}: {
  clients: ClientParams[];
  services: ServiceParams[];
}) {
  const router = useRouter();
  const [invoiceNumber, setInvoiceNumber] = useState('INV-345442-000');
  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState<string>('');
  const [items, setItems] = useState<InvoiceItemState[]>([
    { id: '1', serviceId: '', description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState(PROFORMA_NOTE);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('PROFORMA');
  const [currency, setCurrency] = useState('USD');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [sellerName, setSellerName] = useState('Studio Arsa Digital');
  const [sellerContact, setSellerContact] = useState('billing@fintrack.com');
  const [sellerAddress, setSellerAddress] = useState(
    '43 Smanding, Sumbersari, Indonesia',
  );

  const handleInvoiceTypeChange = (type: InvoiceType) => {
    setInvoiceType(type);
    if (type === 'SALES') {
      setPaymentTerms(SALES_PAYMENT_TERMS);
      return;
    }
    setPaymentTerms('');
  };

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      ),
    [items],
  );

  const taxAmount = useMemo(
    () => ((subtotal - discount) * taxRate) / 100,
    [subtotal, discount, taxRate],
  );

  const total = useMemo(
    () => Math.max(0, subtotal - discount + taxAmount),
    [subtotal, discount, taxAmount],
  );

  const amountDue = useMemo(
    () => Math.max(0, total - Math.max(0, amountPaid)),
    [total, amountPaid],
  );

  const salesPaymentStatus: SalesPaymentStatus = useMemo(() => {
    if (amountPaid <= 0) return 'pending';
    if (amountDue > 0) return 'partial';
    return 'paid';
  }, [amountPaid, amountDue]);

  const calculatedValidityPeriod = useMemo(() => {
    if (!issueDate || !dueDate) return '—';
    const start = new Date(issueDate);
    const end = new Date(dueDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (Number.isNaN(diffDays)) return '—';
    if (diffDays < 0) return 'Invalid range';
    const inclusiveDays = diffDays + 1;
    return `${inclusiveDays} day${inclusiveDays === 1 ? '' : 's'}`;
  }, [issueDate, dueDate]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), serviceId: '', description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const updateItem = (id: string, field: keyof InvoiceItemState, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated: InvoiceItemState = { ...item, [field]: value };
        if (field === 'serviceId' && value) {
          const svc = services.find((s) => s.id === value);
          if (svc) {
            updated.unitPrice = svc.price;
            updated.description = svc.name;
          }
        }
        return updated;
      }),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const computeStatus = (): Status => {
    if (invoiceType === 'SALES') {
      if (salesPaymentStatus === 'paid') return 'PAID';
      if (salesPaymentStatus === 'partial') return 'PENDING';
    }
    if (!dueDate) return 'PENDING';
    const today = new Date();
    const due = new Date(dueDate);
    if (today.getTime() > due.getTime()) return 'OVERDUE';
    return 'PENDING';
  };

  const status = computeStatus();

  const handleDownloadPdf = () => {
    if (typeof window === 'undefined') return;
    window.print();
  };

  const handleSubmit = async () => {
    const validItems = items.filter(
      (i) => i.description && i.quantity > 0 && i.unitPrice >= 0,
    );
    if (!clientId) {
      alert('Please select a customer before saving the invoice.');
      return;
    }
    if (validItems.length === 0) {
      alert('Please add at least one valid line item.');
      return;
    }
    if (!sellerName || !sellerContact || !sellerAddress) {
      alert('Please provide complete seller details.');
      return;
    }
    if (!currency) {
      alert('Please choose a currency.');
      return;
    }
    if (invoiceType === 'PROFORMA' && !estimatedDeliveryDate) {
      alert('Proforma invoices require an expected delivery date.');
      return;
    }
    if (!dueDate) {
      alert('Please select a valid until date.');
      return;
    }
    if (calculatedValidityPeriod === 'Invalid range') {
      alert('Valid until date must be on or after issue date.');
      return;
    }
    if (invoiceType === 'SALES' && !paymentTerms) {
      alert('Please enter payment terms for sales invoice.');
      return;
    }
    if (invoiceType === 'SALES' && amountPaid > total) {
      alert('Amount paid cannot exceed total amount.');
      return;
    }

    const invoiceStatus =
      invoiceType === 'PROFORMA'
        ? 'PROFORMA'
        : salesPaymentStatus === 'paid'
          ? 'PAID'
          : salesPaymentStatus === 'partial'
            ? 'PARTIALLY_PAID'
            : 'FINAL';

    const resolvedPaymentTerms =
      invoiceType === 'SALES' ? generatedSalesPaymentTerms : paymentTerms;

    const resolvedPaymentStatus: SalesPaymentStatus =
      invoiceType === 'SALES'
        ? salesPaymentStatus
        : 'pending';

    const typeSummary = [
      `Invoice Type: ${invoiceType}`,
      `Currency: ${currency}`,
      `Seller: ${sellerName}`,
      `Seller Contact: ${sellerContact}`,
      `Seller Address: ${sellerAddress}`,
      `Valid Until: ${dueDate}`,
      `Payment Terms: ${resolvedPaymentTerms}`,
      `Amount Paid: ${amountPaid.toFixed(2)}`,
      `Amount Due: ${amountDue.toFixed(2)}`,
      estimatedDeliveryDate
        ? `Expected Delivery: ${estimatedDeliveryDate}`
        : null,
      invoiceType !== 'PROFORMA'
        ? `Payment Status: ${resolvedPaymentStatus}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    const mergedNotes = notes ? `${notes}\n\n${typeSummary}` : typeSummary;

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          items: validItems,
          issueDate,
          dueDate: dueDate || null,
          status: invoiceStatus,
          subtotal,
          tax: taxAmount,
          discount,
          total,
          totalAmount: total,
          depositAmount: Math.max(0, amountPaid),
          amountDue,
          paymentStatus: resolvedPaymentStatus,
          notes: mergedNotes,
          paymentTerms: resolvedPaymentTerms,
          expectedDeliveryDate: estimatedDeliveryDate || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert(err.message || 'Failed to save invoice');
        return;
      }

      const invoice = (await response.json()) as {
        id: string;
        invoiceNumber: string;
        total: number;
      };
      const clientName = clients.find((c) => c.id === clientId)?.name ?? 'Customer';
      const next = new URLSearchParams({
        ft_toast: 'invoice_created',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName,
        invoiceTotal: String(Number(invoice.total)),
      });
      router.push(`/invoices?${next.toString()}`);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert('Failed to save invoice');
    }
  };

  const formattedIssueDate = issueDate
    ? new Date(issueDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Upon Receipt';

  const generatedSalesPaymentTerms = useMemo(() => {
    if (!issueDate || !dueDate) {
      return 'Set issue date and valid until date to generate payment terms.';
    }
    if (calculatedValidityPeriod === 'Invalid range') {
      return 'Valid until date must be on or after issue date.';
    }
    return `Payment for this sales invoice is due within ${calculatedValidityPeriod} (${formattedIssueDate} to ${formattedDueDate}). A 3% penalty fee applies to any outstanding amount after the valid-until date.`;
  }, [
    issueDate,
    dueDate,
    calculatedValidityPeriod,
    formattedIssueDate,
    formattedDueDate,
  ]);

  const invoiceTypeLabel: Record<InvoiceType, string> = {
    PROFORMA: 'Proforma Invoice',
    SALES: 'Sales Invoice',
  };

  const currencyLabel: Record<string, string> = {
    USD: 'US Dollar (USD)',
    EUR: 'Euro (EUR)',
    GBP: 'British Pound (GBP)',
    GHS: 'Ghanaian Cedi (GHS)',
    NGN: 'Nigerian Naira (NGN)',
  };

  const previewCurrencySymbol = getCurrencySymbol(currency);

  const formattedEstimatedDeliveryDate = estimatedDeliveryDate
    ? new Date(estimatedDeliveryDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="create-invoice-page">
      <div className="create-invoice-header">
        <h1>Create New Invoice</h1>
        <p>Create a new invoice and deliver it instantly.</p>
        <div className="create-invoice-header-actions">
          <button className="btn btn-outline header-pill">Save as Draft</button>
          <button className="btn btn-primary header-pill" onClick={handleSubmit}>
            <Send size={14} /> Save Invoice
          </button>
        </div>
      </div>

      <div className="create-invoice-grid">
        <section className="create-invoice-card">
          <header className="card-header">
            <h2>Invoice Details</h2>
          </header>

          <div className="card-body">
            <section className="form-section">
              <header className="form-section-header">
                <h3>Document Header</h3>
              </header>

              <div className="invoice-type-section">
                <p className="invoice-type-title">Select Invoice Type</p>
                <div className="invoice-type-grid">
                  <button
                    type="button"
                    className={`invoice-type-option ${invoiceType === 'PROFORMA' ? 'active' : ''}`}
                    onClick={() => handleInvoiceTypeChange('PROFORMA')}
                  >
                    <strong>Proforma</strong>
                    <span>Estimate / pre-agreement</span>
                  </button>
                  <button
                    type="button"
                    className={`invoice-type-option ${invoiceType === 'SALES' ? 'active' : ''}`}
                    onClick={() => handleInvoiceTypeChange('SALES')}
                  >
                    <strong>Sales</strong>
                    <span>General sales billing</span>
                  </button>
                </div>
              </div>

              <div className="field-row three doc-header-row">
                <div className="field">
                  <label>Invoice Number</label>
                  <div className="field-input with-prefix">
                    <span>#</span>
                    <input
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Issue Date *</label>
                  <DatePicker value={issueDate} onChange={setIssueDate} />
                </div>
                <div className="field">
                  <label>Valid Until *</label>
                  <DatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="Select end date"
                    className="date-picker-align-right"
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <header className="form-section-header">
                <h3>Parties Involved</h3>
              </header>

              <div className="field-row three">
                <div className="field">
                  <label>Seller Name *</label>
                  <input
                    className="field-input"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Seller Contact *</label>
                  <input
                    className="field-input"
                    value={sellerContact}
                    onChange={(e) => setSellerContact(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Seller Address *</label>
                  <input
                    className="field-input"
                    value={sellerAddress}
                    onChange={(e) => setSellerAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row two">
                <div className="field">
                  <label>Customer *</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="field-input"
                  >
                    <option value="">Select customer</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Billing Address</label>
                  <input
                    className="field-input"
                    value={selectedClient?.address ?? ''}
                    readOnly
                    placeholder="Customer billing address"
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <header className="form-section-header">
                <h3>Transaction Context</h3>
              </header>

              <div className="field-row two">
                <div className="field">
                  <label>Currency *</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="field-input"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                  <option value="GHS">GHS - Ghanaian Cedi</option>
                    <option value="NGN">NGN - Nigerian Naira</option>
                  </select>
                </div>
                <div className="field">
                  <label>
                    Expected Delivery Date {invoiceType === 'PROFORMA' ? '*' : ''}
                  </label>
                  <DatePicker
                    value={estimatedDeliveryDate}
                    onChange={setEstimatedDeliveryDate}
                    placeholder="Pick expected date"
                  />
                </div>
              </div>

              {invoiceType === 'SALES' && (
                <div className="field-row">
                  <div className="field">
                    <label>Payment Status</label>
                    <input
                      className="field-input"
                      value={salesPaymentStatus}
                      readOnly
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="form-section">
              <header className="form-section-header">
                <h3>Line Items</h3>
              </header>

              <div className="items-section">
                <div className="items-header">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Cost</span>
                  <span>Amount</span>
                </div>
                {items.map((item) => (
                  <div key={item.id} className="items-row">
                    <select
                      value={item.serviceId}
                      onChange={(e) =>
                        updateItem(item.id, 'serviceId', e.target.value)
                      }
                    >
                      <option value="">Custom item…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          'quantity',
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          'unitPrice',
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <div className="items-amount">
                      {previewCurrencySymbol}
                      {(item.quantity * item.unitPrice).toFixed(2)}
                    </div>
                    <button
                      type="button"
                      className="items-remove"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button type="button" className="items-add" onClick={addItem}>
                  + Add Item
                </button>
              </div>
            </section>

            <section className="form-section">
              <header className="form-section-header">
                <h3>Pricing Summary</h3>
              </header>

              <div className="field-row two">
                <div className="field">
                  <label>Discount</label>
                  <input
                    type="number"
                    min={0}
                    className="field-input"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="field">
                  <label>Tax (%)</label>
                  <input
                    type="number"
                    min={0}
                    className="field-input"
                    value={taxRate}
                    onChange={(e) =>
                      setTaxRate(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
              </div>

              <div className="field-row two">
                <div className="field">
                  <label>Subtotal</label>
                  <input className="field-input" value={subtotal.toFixed(2)} readOnly />
                </div>
                <div className="field">
                  <label>Total Amount</label>
                  <input className="field-input" value={total.toFixed(2)} readOnly />
                </div>
              </div>

              {invoiceType === 'SALES' && (
                <div className="field-row two">
                  <div className="field">
                    <label>Amount Paid / Deposit</label>
                    <input
                      type="number"
                      min={0}
                      max={total}
                      className="field-input"
                      value={amountPaid}
                      onChange={(e) =>
                        setAmountPaid(Math.max(0, parseFloat(e.target.value) || 0))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Amount Due</label>
                    <input
                      className={`field-input ${amountDue > 0 ? 'amount-due-highlight' : ''}`}
                      value={amountDue.toFixed(2)}
                      readOnly
                    />
                  </div>
                </div>
              )}

              {invoiceType !== 'PROFORMA' && (
                <div className="field-row">
                  <div className="field">
                    <label>Payment Terms *</label>
                    <textarea
                      className="field-input textarea"
                      value={
                        invoiceType === 'SALES'
                          ? generatedSalesPaymentTerms
                          : paymentTerms
                      }
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder={
                        invoiceType === 'SALES'
                          ? 'Auto-generated from issue and valid until dates'
                          : 'Enter payment terms'
                      }
                      readOnly={invoiceType === 'SALES'}
                      rows={4}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="form-section">
              <header className="form-section-header">
                <h3>Notes / Additional Info</h3>
              </header>
              <div className="field-row">
                <div className="field">
                  <label>Notes to Customer</label>
                  <textarea
                    className="field-input textarea"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="create-invoice-card preview-card">
          <header className="card-header preview-header">
            <div>
              <h2>Preview</h2>
            </div>
            <div className="preview-header-actions">
              <button
                type="button"
                className="preview-pill"
                onClick={handleDownloadPdf}
              >
                <FileText size={14} /> PDF
              </button>
            </div>
          </header>

          <div className="preview-surface">
            <div className="preview-inner" id="invoice-preview">
              <div className="preview-brand-row">
                <div className="preview-logo-circle">
                  <span>FT</span>
                </div>
                <div className="preview-company-meta">
                  <p className="preview-company-name">FinTrack</p>
                  <p className="preview-company-tagline">Modern Finance & Invoicing</p>
                </div>
              </div>

              <div className="preview-top-row">
                <div className="preview-title-row">
                  <h3>Invoice</h3>
                  <div
                    className={`status-chip ${
                      invoiceType === 'PROFORMA'
                        ? 'status-proforma'
                        : invoiceType === 'SALES' &&
                            salesPaymentStatus === 'partial'
                          ? 'status-partial'
                          : `status-${status.toLowerCase()}`
                    }`}
                  >
                    {invoiceType === 'PROFORMA'
                      ? 'Proforma'
                      : invoiceType === 'SALES' &&
                          salesPaymentStatus === 'partial'
                        ? 'Partially Paid'
                        : status === 'PENDING'
                          ? 'Pending'
                          : status === 'PAID'
                            ? 'Paid'
                            : 'Overdue'}
                  </div>
                </div>
              </div>
              <p className="preview-sub">
                Type <span>{invoiceTypeLabel[invoiceType]}</span>
              </p>
              <p className="preview-sub preview-sub-invoice-number">
                Invoice Number <span>{invoiceNumber}</span>
              </p>
              <p className="preview-sub">
                Currency <span>{currencyLabel[currency] ?? currency}</span>
              </p>

              <div className="preview-columns">
                <div>
                  <p className="preview-label">Billed by</p>
                  <p className="preview-strong">{sellerName || 'Seller Name'}</p>
                  <p className="preview-muted">{sellerContact || 'Seller Contact'}</p>
                  <p className="preview-muted">
                    {sellerAddress || 'Seller Address'}
                  </p>
                </div>
                <div>
                  <p className="preview-label">Billed to</p>
                  <p className="preview-strong">
                    {selectedClient?.name || 'Client Name'}
                  </p>
                  <p className="preview-muted">
                    {selectedClient?.address || 'Client Address'}
                  </p>
                </div>
              </div>

              <div className="preview-columns dates">
                <div>
                  <p className="preview-label">Issue Date</p>
                  <p className="preview-strong">{formattedIssueDate}</p>
                </div>
                <div>
                  <p className="preview-label">Valid Until</p>
                  <p className="preview-strong">{formattedDueDate}</p>
                </div>
                {estimatedDeliveryDate && (
                  <div>
                    <p className="preview-label">Expected Delivery</p>
                    <p className="preview-strong">{formattedEstimatedDeliveryDate}</p>
                  </div>
                )}
              </div>

              <div className="preview-table">
                <div className="preview-table-header">
                  <span>Item</span>
                  <span>QTY</span>
                  <span>Cost</span>
                  <span>Amount</span>
                </div>
                {items.map((item) => (
                  <div key={item.id} className="preview-table-row">
                    <span>{item.description || '—'}</span>
                    <span>{item.quantity}</span>
                    <span>
                      {previewCurrencySymbol}
                      {item.unitPrice.toFixed(2)}
                    </span>
                    <span>
                      {previewCurrencySymbol}
                      {(item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="preview-totals">
                <div className="preview-total-row">
                  <span>Sub Total</span>
                  <span>
                    {previewCurrencySymbol}
                    {subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="preview-total-row">
                  <span>Discount</span>
                  <span>
                    {previewCurrencySymbol}
                    {discount.toFixed(2)}
                  </span>
                </div>
                <div className="preview-total-row">
                  <span>Tax</span>
                  <span>
                    {previewCurrencySymbol}
                    {taxAmount.toFixed(2)}
                  </span>
                </div>
                <div className="preview-total-row grand">
                  <span>Grand Total</span>
                  <span>
                    {previewCurrencySymbol}
                    {total.toFixed(2)}
                  </span>
                </div>
                {invoiceType === 'SALES' && (
                  <>
                    <div className="preview-total-row">
                      <span>Amount Paid</span>
                      <span>
                        {previewCurrencySymbol}
                        {Math.max(0, amountPaid).toFixed(2)}
                      </span>
                    </div>
                    <div className={`preview-total-row ${amountDue > 0 ? 'due-highlight' : ''}`}>
                      <span>Amount Due</span>
                      <span>
                        {previewCurrencySymbol}
                        {amountDue.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {invoiceType !== 'PROFORMA' && (
                <div className="preview-notes">
                  <p className="preview-label">Payment Terms</p>
                  <p className="preview-muted">
                    {invoiceType === 'SALES'
                      ? generatedSalesPaymentTerms
                      : paymentTerms || '—'}
                  </p>
                </div>
              )}

              <div className="preview-notes">
                <p className="preview-label">Notes</p>
                <p className="preview-muted">{notes}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

