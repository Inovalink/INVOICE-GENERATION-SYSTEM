'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Banknote,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Filter,
  Landmark,
  MoreHorizontal,
  Plus,
  FileText,
} from 'lucide-react';
import { formatGhs } from '@/lib/formatGhs';
import { invoiceDisplayStatus } from '@/lib/invoiceDue';
import { clampPage } from '@/lib/pagination';
import PaginationBar from '@/components/ui/PaginationBar';
import DateRangePicker from '@/components/ui/DateRangePicker';
import ReceiptModal from '@/components/receipts/ReceiptModal';

type InvoiceClient = {
  name: string;
  company: string | null;
  address: string | null;
  email?: string | null;
};

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type InvoiceReceipt = {
  id: string;
} | null;

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  totalAmount: number;
  depositAmount: number;
  amountDue: number;
  paymentStatus: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  paymentTerms: string | null;
  notes: string | null;
  client: InvoiceClient;
  items: InvoiceItem[];
  receipt: InvoiceReceipt;
};

type DashboardSortKey = 'invoiceNumber' | 'client' | 'email' | 'dueDate' | 'status';

type DashboardStatusFilter =
  | 'all'
  | 'PAID'
  | 'OVERDUE'
  | 'PROFORMA'
  | 'FINAL'
  | 'PARTIALLY_PAID'
  | 'CANCELLED';

function startOfLocalDayFromYmd(ymd: string): Date | null {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  const x = new Date(y, m - 1, d);
  x.setHours(0, 0, 0, 0);
  return Number.isNaN(x.getTime()) ? null : x;
}

function invoiceDueLocalMidnight(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setHours(0, 0, 0, 0);
  return x;
}

function passesDashboardFilters(
  inv: InvoiceSummary,
  statusFilter: DashboardStatusFilter,
  dateFrom: string,
  dateTo: string,
): boolean {
  const rowStatus = invoiceDisplayStatus(inv);
  if (statusFilter !== 'all' && rowStatus !== statusFilter) return false;
  if (!dateFrom && !dateTo) return true;
  const dueDay = invoiceDueLocalMidnight(inv.dueDate);
  if (!dueDay) return false;
  let from = dateFrom ? startOfLocalDayFromYmd(dateFrom) : null;
  let to = dateTo ? startOfLocalDayFromYmd(dateTo) : null;
  if (from && to && from.getTime() > to.getTime()) {
    const swap = from;
    from = to;
    to = swap;
  }
  if (from && dueDay.getTime() < from.getTime()) return false;
  if (to && dueDay.getTime() > to.getTime()) return false;
  return true;
}

function sortDashboardInvoices(
  list: InvoiceSummary[],
  key: DashboardSortKey | null,
  dir: 'asc' | 'desc',
): InvoiceSummary[] {
  if (!key) return [...list];
  const copy = [...list];
  const factor = dir === 'asc' ? 1 : -1;
  copy.sort((a, b) => {
    if (key === 'invoiceNumber') {
      return factor * a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true });
    }
    if (key === 'client') {
      return factor * a.client.name.localeCompare(b.client.name, undefined, { sensitivity: 'base' });
    }
    if (key === 'email') {
      const ea = (a.client.email ?? '').trim();
      const eb = (b.client.email ?? '').trim();
      return factor * ea.localeCompare(eb, undefined, { sensitivity: 'base' });
    }
    if (key === 'dueDate') {
      const ta = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return factor * (ta - tb);
    }
    if (key === 'status') {
      const sa = invoiceDisplayStatus(a);
      const sb = invoiceDisplayStatus(b);
      return factor * sa.localeCompare(sb, undefined, { sensitivity: 'base' });
    }
    return 0;
  });
  return copy;
}

function dashboardStatusCsvLabel(rowStatus: string): string {
  const map: Record<string, string> = {
    PAID: 'Paid',
    OVERDUE: 'Overdue',
    PROFORMA: 'Proforma',
    FINAL: 'Pending',
    PARTIALLY_PAID: 'Partially Paid',
    CANCELLED: 'Cancelled',
  };
  return map[rowStatus] ?? rowStatus;
}

function downloadDashboardCsv(rows: InvoiceSummary[]) {
  const headers = ['Invoice Number', 'Client', 'Email', 'Amount (GHS)', 'Due Date', 'Status'];
  const lines = rows.map((inv) => {
    const rowStatus = invoiceDisplayStatus(inv);
    const due = inv.dueDate
      ? new Date(inv.dueDate).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '';
    const email = (inv.client.email ?? '').replace(/"/g, '""');
    const cells = [
      inv.invoiceNumber,
      `"${(inv.client.name || '').replace(/"/g, '""')}"`,
      `"${email}"`,
      String(Math.round(inv.total * 100) / 100),
      due,
      `"${dashboardStatusCsvLabel(rowStatus)}"`,
    ];
    return cells.join(',');
  });
  const csv = [headers.join(','), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InvoicesTable({
  invoices,
  itemsPerPage,
  variant = 'full',
  /** Shown above the dashboard filter row — keep filters in this table only (no duplicate toolbar). */
  dashboardTitle,
}: {
  invoices: InvoiceSummary[];
  itemsPerPage?: number;
  /** `dashboard`: compact columns for Financial overview (matches invoice list mock). */
  variant?: 'full' | 'dashboard';
  dashboardTitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDashboard = variant === 'dashboard';
  type PaymentChoice = 'CASH' | 'MTN_MOMO' | 'TELECEL_CASH' | 'BANK_TRANSFER';
  const [selected, setSelected] = useState<InvoiceSummary | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [paymentKind, setPaymentKind] = useState<'full' | 'partial'>('full');
  const [nextDueDate, setNextDueDate] = useState<string>('');
  const [paymentMethodReady, setPaymentMethodReady] = useState<boolean>(false);
  const [methodFlowOpen, setMethodFlowOpen] = useState<boolean>(false);
  const [methodFlowStep, setMethodFlowStep] = useState<'select' | 'details'>('select');
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('CASH');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [draftPaymentChoice, setDraftPaymentChoice] = useState<PaymentChoice>('CASH');
  const [draftTransactionRef, setDraftTransactionRef] = useState<string>('');
  const [draftBankName, setDraftBankName] = useState<string>('');
  const [draftAccountNumber, setDraftAccountNumber] = useState<string>('');
  const [draftAccountName, setDraftAccountName] = useState<string>('');
  const [modalMode, setModalMode] = useState<'preview' | 'payment'>('preview');
  const [tablePage, setTablePage] = useState(1);
  const [viewReceiptId, setViewReceiptId] = useState<string | null>(null);
  const [dashboardSortKey, setDashboardSortKey] = useState<DashboardSortKey | null>(null);
  const [dashboardSortDir, setDashboardSortDir] = useState<'asc' | 'desc'>('asc');
  const [dashboardFilterStatus, setDashboardFilterStatus] = useState<DashboardStatusFilter>('all');
  const [dashboardFilterDateFrom, setDashboardFilterDateFrom] = useState('');
  const [dashboardFilterDateTo, setDashboardFilterDateTo] = useState('');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const receiptIdParam = searchParams.get('receiptId');
    if (!receiptIdParam) return;
    setViewReceiptId(receiptIdParam);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('receiptId');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!statusMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [statusMenuOpen]);

  const filteredInvoices = useMemo(() => {
    if (!isDashboard) return invoices;
    return invoices.filter((inv) =>
      passesDashboardFilters(inv, dashboardFilterStatus, dashboardFilterDateFrom, dashboardFilterDateTo),
    );
  }, [invoices, isDashboard, dashboardFilterStatus, dashboardFilterDateFrom, dashboardFilterDateTo]);

  const countForPagination = isDashboard ? filteredInvoices.length : invoices.length;

  const totalTablePages = itemsPerPage
    ? Math.max(1, Math.ceil(countForPagination / itemsPerPage))
    : 1;

  useEffect(() => {
    if (!itemsPerPage) return;
    setTablePage((p) => Math.min(p, totalTablePages));
  }, [countForPagination, itemsPerPage, totalTablePages]);

  useEffect(() => {
    if (!isDashboard) return;
    setTablePage(1);
  }, [dashboardFilterStatus, dashboardFilterDateFrom, dashboardFilterDateTo, isDashboard]);

  const safeTablePage = itemsPerPage ? clampPage(tablePage, totalTablePages) : 1;

  const baseInvoices = useMemo(() => {
    if (!isDashboard) return invoices;
    return sortDashboardInvoices(filteredInvoices, dashboardSortKey, dashboardSortDir);
  }, [filteredInvoices, isDashboard, dashboardSortKey, dashboardSortDir]);

  const pagedInvoices = useMemo(() => {
    if (!itemsPerPage) return baseInvoices;
    const start = (safeTablePage - 1) * itemsPerPage;
    return baseInvoices.slice(start, start + itemsPerPage);
  }, [baseInvoices, itemsPerPage, safeTablePage]);

  const toggleDashboardSort = (key: DashboardSortKey) => {
    if (dashboardSortKey === key) {
      setDashboardSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setDashboardSortKey(key);
      setDashboardSortDir('asc');
    }
    setTablePage(1);
  };

  const dashboardSortIcon = (key: DashboardSortKey) => {
    const active = dashboardSortKey === key;
    return (
      <span className="modern-table__sort-chevron-wrap" aria-hidden>
        {active ? (
          dashboardSortDir === 'asc' ? (
            <ChevronUp className="modern-table__sort-chevron modern-table__sort-chevron--active" size={15} strokeWidth={2.25} />
          ) : (
            <ChevronDown className="modern-table__sort-chevron modern-table__sort-chevron--active" size={15} strokeWidth={2.25} />
          )
        ) : (
          <span className="modern-table__sort-chevron-both">
            <ChevronUp className="modern-table__sort-chevron" size={11} strokeWidth={2.25} />
            <ChevronDown className="modern-table__sort-chevron" size={11} strokeWidth={2.25} />
          </span>
        )}
      </span>
    );
  };

  const safeAmount = (value: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseAmountFromNotes = (
    notes: string | null,
    label: 'Amount Paid' | 'Amount Due',
  ) => {
    if (!notes) return null;
    const regex = new RegExp(`${label}:\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i');
    const match = notes.match(regex);
    if (!match?.[1]) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getPersistedPaid = (invoice: InvoiceSummary) => {
    const total = safeAmount(invoice.total);
    const dbPaid = safeAmount(invoice.depositAmount);
    const notePaid = parseAmountFromNotes(invoice.notes, 'Amount Paid');

    if (dbPaid > 0) return dbPaid;
    if (notePaid !== null) return Math.max(0, notePaid);
    if (invoice.status === 'PAID' || invoice.paymentStatus === 'paid') return total;
    return 0;
  };

  const getPersistedDue = (invoice: InvoiceSummary) => {
    const total = safeAmount(invoice.total);
    const persistedPaid = getPersistedPaid(invoice);

    if (invoice.status === 'PAID' || invoice.paymentStatus === 'paid') return 0;
    // Canonical rule: Amount Due = Grand Total - Amount Paid
    return Math.max(0, total - persistedPaid);
  };

  const openPaymentModal = (invoice: InvoiceSummary) => {
    setSelected(invoice);
    setAmount(getPersistedDue(invoice).toFixed(2));
    setPaymentKind('full');
    setNextDueDate(invoice.dueDate ? invoice.dueDate.slice(0, 10) : '');
    setPaymentMethodReady(false);
    setMethodFlowOpen(false);
    setMethodFlowStep('select');
    setPaymentChoice('CASH');
    setTransactionRef('');
    setBankName('');
    setAccountNumber('');
    setAccountName('');
    setDraftPaymentChoice('CASH');
    setDraftTransactionRef('');
    setDraftBankName('');
    setDraftAccountNumber('');
    setDraftAccountName('');
    setModalMode('payment');
  };

  const openPreviewModal = (invoice: InvoiceSummary) => {
    setSelected(invoice);
    setModalMode('preview');
  };

  const closeModal = useCallback(() => {
    setSelected(null);
    setAmount('');
    setPaymentKind('full');
    setNextDueDate('');
    setPaymentMethodReady(false);
    setMethodFlowOpen(false);
    setMethodFlowStep('select');
    setPaymentChoice('CASH');
    setTransactionRef('');
    setBankName('');
    setAccountNumber('');
    setAccountName('');
    setDraftPaymentChoice('CASH');
    setDraftTransactionRef('');
    setDraftBankName('');
    setDraftAccountNumber('');
    setDraftAccountName('');
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selected, closeModal]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const getInvoiceTypeLabel = (status: string) =>
    status === 'PROFORMA' ? 'Proforma Invoice' : 'Sales Invoice';

  const getPreviewStatusLabel = (status: string) => {
    if (status === 'OVERDUE') return 'Overdue';
    if (status === 'PAID') return 'Paid';
    if (status === 'PARTIALLY_PAID') return 'Partial';
    if (status === 'PROFORMA') return 'Proforma';
    return 'Pending';
  };

  const extractExpectedDelivery = (notes: string | null) => {
    if (!notes) return '';
    const match = notes.match(/Expected Delivery:\s*([^\n]+)/i);
    return match?.[1]?.trim() ?? '';
  };

  const extractCustomerNotes = (notes: string | null) => {
    if (!notes) return '';
    const markerIndex = notes.indexOf('\n\nInvoice Type:');
    if (markerIndex === -1) return notes.trim();
    return notes.slice(0, markerIndex).trim();
  };

  const totalAmount = selected ? safeAmount(selected.total) : 0;
  const persistedPaid = selected ? getPersistedPaid(selected) : 0;
  const persistedDue = selected ? getPersistedDue(selected) : 0;
  const selectedChipStatus = selected ? invoiceDisplayStatus(selected) : null;
  const enteredAmount = amount.trim() === '' ? 0 : Math.max(0, safeAmount(Number(amount)));
  const checkoutAmount =
    paymentKind === 'full' ? Math.max(0, persistedDue) : enteredAmount;
  const isTypingPayment =
    modalMode === 'payment' && paymentKind === 'partial' && amount.trim() !== '';
  const livePaid = persistedPaid + checkoutAmount;
  const liveDue = totalAmount - livePaid;
  const displayAmountPaid = isTypingPayment ? livePaid : persistedPaid;
  const displayAmountDue = isTypingPayment ? liveDue : persistedDue;
  const dueRowLabel = displayAmountDue < 0 ? 'Balance Owed' : 'Amount Due';
  const dueDisplayValue = Math.abs(displayAmountDue);
  const duePillLabel = displayAmountDue < 0 ? 'Balance owed' : 'Due now';
  const selectedPaymentMethod =
    paymentChoice === 'BANK_TRANSFER'
      ? 'BANK_TRANSFER'
      : paymentChoice === 'CASH'
        ? 'CASH'
        : 'MOBILE_MONEY';
  const paymentMethodLabel =
    paymentChoice === 'CASH'
      ? 'Cash'
      : paymentChoice === 'MTN_MOMO'
        ? 'MTN Momo'
        : paymentChoice === 'TELECEL_CASH'
          ? 'Telecel Cash'
          : 'Bank Transfer';
  const paymentMethodBadgeClass =
    paymentChoice === 'CASH'
      ? 'cash'
      : paymentChoice === 'MTN_MOMO'
        ? 'mtn'
        : paymentChoice === 'TELECEL_CASH'
          ? 'telecel'
          : 'bank';

  const openMethodFlow = () => {
    setMethodFlowOpen(true);
    setMethodFlowStep('select');
    setDraftPaymentChoice(paymentChoice);
    setDraftTransactionRef(transactionRef);
    setDraftBankName(bankName);
    setDraftAccountNumber(accountNumber);
    setDraftAccountName(accountName);
  };

  const closeMethodFlow = () => {
    setMethodFlowOpen(false);
    setMethodFlowStep('select');
  };

  const draftNeedsReference =
    draftPaymentChoice === 'MTN_MOMO' || draftPaymentChoice === 'TELECEL_CASH';
  const draftNeedsBankFields = draftPaymentChoice === 'BANK_TRANSFER';
  const draftDetailsValid = draftNeedsReference
    ? draftTransactionRef.trim().length > 0
    : draftNeedsBankFields
      ? draftBankName.trim().length > 0 &&
        draftAccountNumber.trim().length > 0 &&
        draftAccountName.trim().length > 0
      : true;

  const commitPaymentMethod = () => {
    setPaymentChoice(draftPaymentChoice);
    setTransactionRef(draftTransactionRef.trim());
    setBankName(draftBankName.trim());
    setAccountNumber(draftAccountNumber.trim());
    setAccountName(draftAccountName.trim());
    setPaymentMethodReady(true);
    closeMethodFlow();
  };

  const dashboardStatusTriggerLabel =
    dashboardFilterStatus === 'all' ? 'Status' : dashboardStatusCsvLabel(dashboardFilterStatus);

  const dashboardStatusCell = (rowStatus: string) => {
    if (rowStatus === 'PAID') return <span className="status-badge paid">Paid</span>;
    if (rowStatus === 'OVERDUE') return <span className="status-badge overdue">Overdue</span>;
    if (rowStatus === 'PROFORMA') return <span className="status-badge draft">Proforma</span>;
    if (rowStatus === 'FINAL') return <span className="status-badge pending">Pending</span>;
    if (rowStatus === 'PARTIALLY_PAID')
      return <span className="status-badge partial">Partially Paid</span>;
    if (rowStatus === 'CANCELLED') return <span className="status-badge pending">Cancelled</span>;
    return <span className="status-badge pending">{rowStatus}</span>;
  };

  const dashboardFiltersBar = (
    <div
      className={`dashboard-invoice-filters${dashboardTitle ? ' finance-invoice-list-card__toolbar-row' : ''}`}
      aria-label="Filter invoices"
    >
      <div className="dashboard-invoice-filters__left">
        <span className="dashboard-invoice-filters__pill">
          <Filter size={15} strokeWidth={2.25} aria-hidden />
          Filter By
        </span>
        <div
          className="dashboard-invoice-filters__field dashboard-invoice-filters__field--status"
          ref={statusMenuRef}
        >
          <Clock size={16} strokeWidth={2} className="dashboard-invoice-filters__field-icon" aria-hidden />
          <button
            type="button"
            className="dashboard-invoice-filters__status-trigger"
            onClick={() => setStatusMenuOpen((o) => !o)}
            aria-expanded={statusMenuOpen}
            aria-haspopup="listbox"
            aria-label="Filter by status"
          >
            <span className="dashboard-invoice-filters__status-trigger-text">{dashboardStatusTriggerLabel}</span>
            <ChevronDown
              size={16}
              strokeWidth={2}
              className={`dashboard-invoice-filters__status-chevron ${statusMenuOpen ? 'dashboard-invoice-filters__status-chevron--open' : ''}`}
              aria-hidden
            />
          </button>
          {statusMenuOpen && (
            <ul className="dashboard-invoice-filters__menu" role="listbox">
              {(
                [
                  ['all', 'All'] as const,
                  ['PAID', 'Paid'] as const,
                  ['OVERDUE', 'Overdue'] as const,
                  ['PROFORMA', 'Proforma'] as const,
                  ['FINAL', 'Pending'] as const,
                  ['PARTIALLY_PAID', 'Partially paid'] as const,
                  ['CANCELLED', 'Cancelled'] as const,
                ] as const
              ).map(([value, label]) => (
                <li key={value} role="presentation">
                  <button
                    type="button"
                    className={
                      dashboardFilterStatus === value
                        ? 'dashboard-invoice-filters__menu-item dashboard-invoice-filters__menu-item--active'
                        : 'dashboard-invoice-filters__menu-item'
                    }
                    role="option"
                    aria-selected={dashboardFilterStatus === value}
                    onClick={() => {
                      setDashboardFilterStatus(value);
                      setStatusMenuOpen(false);
                      setTablePage(1);
                    }}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="dashboard-invoice-filters__due-date">
          <DateRangePicker
            variant="pill"
            dateFrom={dashboardFilterDateFrom}
            dateTo={dashboardFilterDateTo}
            onChange={(from, to) => {
              setDashboardFilterDateFrom(from);
              setDashboardFilterDateTo(to);
            }}
            placeholder="Due Date"
            className="dashboard-invoice-filters__date-range date-range-picker--align-right"
          />
        </div>
      </div>
      <div className="dashboard-invoice-filters__right">
        <button
          type="button"
          className="dashboard-invoice-filters__export"
          onClick={() => downloadDashboardCsv(baseInvoices)}
          disabled={filteredInvoices.length === 0}
        >
          <Download size={15} strokeWidth={2} aria-hidden />
          Export Data
        </button>
        <Link href="/invoices/new" className="btn btn-primary dashboard-invoice-filters__create">
          <Plus size={16} strokeWidth={2.5} aria-hidden />
          Create Invoice
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {isDashboard &&
        (dashboardTitle ? (
          <div className="finance-invoice-list-card__header finance-invoice-list-card__header--integrated">
            <div className="finance-invoice-list-card__titles">
              <h2 className="finance-invoice-list-card__title">{dashboardTitle}</h2>
            </div>
            {dashboardFiltersBar}
          </div>
        ) : (
          dashboardFiltersBar
        ))}
      <div className={isDashboard ? 'modern-table modern-table--dashboard' : 'modern-table'}>
        <table>
          <thead>
            <tr>
              {isDashboard ? (
                <>
                  <th
                    scope="col"
                    aria-sort={
                      dashboardSortKey === 'invoiceNumber'
                        ? dashboardSortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="modern-table__sort-th"
                      onClick={() => toggleDashboardSort('invoiceNumber')}
                    >
                      Invoice Number
                      {dashboardSortIcon('invoiceNumber')}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={
                      dashboardSortKey === 'client'
                        ? dashboardSortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="modern-table__sort-th"
                      onClick={() => toggleDashboardSort('client')}
                    >
                      Client
                      {dashboardSortIcon('client')}
                    </button>
                  </th>
                  <th
                    className="modern-table__col-email"
                    scope="col"
                    aria-sort={
                      dashboardSortKey === 'email'
                        ? dashboardSortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="modern-table__sort-th"
                      onClick={() => toggleDashboardSort('email')}
                    >
                      Email
                      {dashboardSortIcon('email')}
                    </button>
                  </th>
                  <th scope="col">Amount</th>
                  <th
                    scope="col"
                    aria-sort={
                      dashboardSortKey === 'dueDate'
                        ? dashboardSortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="modern-table__sort-th"
                      onClick={() => toggleDashboardSort('dueDate')}
                    >
                      Due Date
                      {dashboardSortIcon('dueDate')}
                    </button>
                  </th>
                  <th
                    className="modern-table__col-status"
                    scope="col"
                    aria-sort={
                      dashboardSortKey === 'status'
                        ? dashboardSortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="modern-table__sort-th"
                      onClick={() => toggleDashboardSort('status')}
                    >
                      Status
                      {dashboardSortIcon('status')}
                    </button>
                  </th>
                </>
              ) : (
                <>
                  <th>Invoice ID</th>
                  <th>Client</th>
                  <th>Project / Notes</th>
                  <th>Issued</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th className="modern-table__col-status">Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={isDashboard ? 6 : 9}
                  style={{ textAlign: 'center', color: 'var(--text-secondary)' }}
                >
                  No invoices found. Create your first invoice to get started.
                </td>
              </tr>
            ) : isDashboard && filteredInvoices.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: 'center', color: 'var(--text-secondary)' }}
                >
                  No invoices match your filters. Adjust status or due date above.
                </td>
              </tr>
            ) : isDashboard ? (
              pagedInvoices.map((inv) => {
                const due = inv.dueDate ? formatDate(inv.dueDate) : 'Upon Receipt';
                const rowStatus = invoiceDisplayStatus(inv);
                return (
                  <tr
                    key={inv.id}
                    className="invoice-row-clickable"
                    onClick={() => openPreviewModal(inv)}
                  >
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.client.name}</td>
                    <td className="modern-table__col-email modern-table__cell-muted" title={inv.client.email ?? undefined}>
                      {inv.client.email?.trim() ? inv.client.email.trim() : '—'}
                    </td>
                    <td>{formatGhs(inv.total, 0)}</td>
                    <td>{due}</td>
                    <td className="modern-table__col-status">{dashboardStatusCell(rowStatus)}</td>
                  </tr>
                );
              })
            ) : (
              pagedInvoices.map((inv) => {
                let project = 'General Services';
                if (inv.notes && inv.notes.includes('Project:')) {
                  project = inv.notes.split('Project:')[1].split('\n')[0].trim();
                } else if (inv.notes) {
                  project =
                    inv.notes.substring(0, 20) + (inv.notes.length > 20 ? '...' : '');
                }

                const issued = formatDate(inv.issueDate);
                const due = inv.dueDate ? formatDate(inv.dueDate) : 'Upon Receipt';

                const isPaid = inv.status === 'PAID';
                const hasReceipt = !!inv.receipt;
                const canCheckout =
                  inv.status === 'FINAL' || inv.status === 'PARTIALLY_PAID';
                const rowStatus = invoiceDisplayStatus(inv);

                return (
                  <tr
                    key={inv.id}
                    className="invoice-row-clickable"
                    onClick={() => openPreviewModal(inv)}
                  >
                    <td>
                      {inv.invoiceNumber}
                    </td>
                    <td>
                      {inv.client.name}{' '}
                      {inv.client.company ? `(${inv.client.company})` : ''}
                    </td>
                    <td>{project}</td>
                    <td>{issued}</td>
                    <td>{due}</td>
                    <td>
                      ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="modern-table__col-status">
                      {rowStatus === 'PAID' && (
                        <span className="status-badge paid">Paid</span>
                      )}
                      {rowStatus === 'OVERDUE' && (
                        <span className="status-badge overdue">Overdue</span>
                      )}
                      {rowStatus === 'PROFORMA' && (
                        <span className="status-badge draft">Proforma</span>
                      )}
                      {rowStatus === 'FINAL' && (
                        <span className="status-badge pending">Pending</span>
                      )}
                      {rowStatus === 'PARTIALLY_PAID' && (
                        <span className="status-badge partial">Partial</span>
                      )}
                    </td>
                    <td>
                      {hasReceipt || isPaid ? (
                        hasReceipt ? (
                          <button
                            type="button"
                            className="receipt-pill-link receipt-pill-link--compact"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewReceiptId(inv.receipt!.id);
                            }}
                            aria-label="View receipt"
                            title="View receipt"
                          >
                            <FileText size={15} strokeWidth={2} aria-hidden />
                            <span>View Receipt</span>
                          </button>
                        ) : (
                          <span className="payment-complete-chip" title="Paid in full">Paid</span>
                        )
                      ) : canCheckout ? (
                        <button
                          type="button"
                          className="checkout-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPaymentModal(inv);
                          }}
                          aria-label="Checkout invoice"
                          title="Checkout invoice"
                        >
                          <span className="checkout-btn-icon-ring" aria-hidden>
                            <Check className="checkout-btn-icon-check" size={7} strokeWidth={3.75} />
                          </span>
                          <span>Checkout</span>
                        </button>
                      ) : (
                        <span className="payment-na-chip">N/A</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="row-action-btn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {itemsPerPage != null && countForPagination > 0 && (
        <PaginationBar
          currentPage={safeTablePage}
          totalItems={countForPagination}
          pageSize={itemsPerPage}
          onPageChange={setTablePage}
          itemLabel="Invoices"
        />
      )}

      {selected &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="invoice-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={modalMode === 'preview' ? 'Invoice preview' : 'Record payment'}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
          <div
            className={`invoice-modal ${modalMode === 'preview' ? 'invoice-preview-modal' : 'invoice-payment-modal'}`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="invoice-modal-preview-close-wrap">
              <button
                type="button"
                className="invoice-modal-close"
                onClick={closeModal}
                aria-label="Close invoice"
              >
                &times;
              </button>
            </div>

            {modalMode === 'preview' ? (
              <div className="invoice-modal-body invoice-modal-body-preview">
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
                  </div>
                  <div className={`status-chip status-${(selectedChipStatus ?? selected.status).toLowerCase()}`}>
                    {getPreviewStatusLabel(selectedChipStatus ?? selected.status)}
                  </div>
                </div>

                <p className="preview-sub">
                  Type <span>{getInvoiceTypeLabel(selected.status)}</span>
                </p>
                <p className="preview-sub preview-sub-invoice-number">
                  Invoice Number <span>{selected.invoiceNumber}</span>
                </p>

                <div className="preview-columns">
                  <div>
                    <p className="preview-label">Billed by</p>
                    <p className="preview-strong">FinTrack</p>
                    <p className="preview-muted">billing@fintrack.com</p>
                  </div>
                  <div>
                    <p className="preview-label">Billed to</p>
                    <p className="preview-strong">
                      {selected.client.name} {selected.client.company ? `(${selected.client.company})` : ''}
                    </p>
                    <p className="preview-muted">
                      {selected.client.address || 'Client Address'}
                    </p>
                  </div>
                </div>

                <div className="preview-columns dates">
                  <div>
                    <p className="preview-label">Issue Date</p>
                    <p className="preview-strong">{formatDate(selected.issueDate)}</p>
                  </div>
                  <div>
                    <p className="preview-label">Valid Until</p>
                    <p className="preview-strong">
                      {selected.dueDate ? formatDate(selected.dueDate) : 'Upon Receipt'}
                    </p>
                  </div>
                  {extractExpectedDelivery(selected.notes) && (
                    <div>
                      <p className="preview-label">Expected Delivery</p>
                      <p className="preview-strong">
                        {extractExpectedDelivery(selected.notes)}
                      </p>
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
                  {selected.items.map((item) => (
                    <div key={item.id} className="preview-table-row">
                      <span>{item.description}</span>
                      <span>{item.quantity}</span>
                      <span>{item.unitPrice.toFixed(2)}</span>
                      <span>{(item.quantity * item.unitPrice).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="preview-totals">
                  <div className="preview-total-row">
                    <span>Sub Total</span>
                    <span>₵{selected.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="preview-total-row">
                    <span>Discount</span>
                    <span>₵{selected.discount.toFixed(2)}</span>
                  </div>
                  <div className="preview-total-row">
                    <span>Tax</span>
                    <span>₵{selected.tax.toFixed(2)}</span>
                  </div>
                  <div className="preview-total-row grand">
                    <span>Grand Total</span>
                    <span>₵{selected.total.toFixed(2)}</span>
                  </div>
                  {selected.status !== 'PROFORMA' && (
                    <>
                      <div className="preview-total-row">
                        <span>Amount Paid</span>
                        <span>₵{Math.max(0, displayAmountPaid).toFixed(2)}</span>
                      </div>
                      <div
                        className={`preview-total-row ${
                          displayAmountDue > 0
                            ? 'due-highlight'
                            : displayAmountDue < 0
                              ? 'owed-highlight'
                              : ''
                        }`}
                      >
                        <span>{dueRowLabel}</span>
                        <span>₵{dueDisplayValue.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {selected.status !== 'PROFORMA' && selected.paymentTerms && (
                  <div className="preview-notes">
                    <p className="preview-label">Payment Terms</p>
                    <p className="preview-muted">{selected.paymentTerms}</p>
                  </div>
                )}

                {extractCustomerNotes(selected.notes) && (
                  <div className="preview-notes">
                    <p className="preview-label">Notes</p>
                    <p className="preview-muted">{extractCustomerNotes(selected.notes)}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="invoice-modal-body payment-modal-body">
                  <section className="payment-modal-brand">
                    <div className="payment-logo-circle">
                      <span>FT</span>
                    </div>
                    <div className="payment-company-meta">
                      <p className="payment-company-name">FinTrack</p>
                      <p className="payment-company-tagline">Modern Finance & Invoicing</p>
                    </div>
                  </section>

                  <section className="payment-modal-meta-grid">
                    <div className="payment-meta-card">
                      <p className="summary-label">Invoice</p>
                      <p className="summary-value">{selected.invoiceNumber}</p>
                    </div>
                    <div className="payment-meta-card">
                      <p className="summary-label">Issued</p>
                      <p className="summary-value">{formatDate(selected.issueDate)}</p>
                    </div>
                    <div className="payment-meta-card">
                      <p className="summary-label">Due Date</p>
                      <p className="summary-value">
                        {selected.dueDate ? formatDate(selected.dueDate) : 'Upon Receipt'}
                      </p>
                    </div>
                    <div className="payment-meta-card">
                      <p className="summary-label">Status</p>
                      <span className={`status-chip status-${(selectedChipStatus ?? selected.status).toLowerCase()}`}>
                        {getPreviewStatusLabel(selectedChipStatus ?? selected.status)}
                      </span>
                    </div>
                  </section>

                  <section className="payment-modal-parties">
                    <div>
                      <p className="summary-label">Billed by</p>
                      <p className="summary-value">FinTrack</p>
                      <p className="payment-party-muted">billing@fintrack.com</p>
                    </div>
                    <div>
                      <p className="summary-label">Bill to</p>
                      <p className="summary-value">
                        {selected.client.name}
                        {selected.client.company ? ` (${selected.client.company})` : ''}
                      </p>
                      <p className="payment-party-muted">
                        {selected.client.address || 'Client Address'}
                      </p>
                    </div>
                  </section>

                  <section className="invoice-modal-items payment-items-card">
                    <div className="items-header-row">
                      <span>Description</span>
                      <span>Qty</span>
                      <span>Price</span>
                      <span>Amount</span>
                    </div>
                    {selected.items.map((item) => (
                      <div key={item.id} className="items-row">
                        <span>{item.description}</span>
                        <span>{item.quantity}</span>
                        <span>${item.unitPrice.toFixed(2)}</span>
                        <span>${(item.quantity * item.unitPrice).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="items-summary-block">
                      <div className="items-summary-row">
                        <span>Sub Total</span>
                        <span>₵{selected.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="items-summary-row">
                        <span>Discount</span>
                        <span>₵{selected.discount.toFixed(2)}</span>
                      </div>
                      <div className="items-summary-row">
                        <span>Tax</span>
                        <span>₵{selected.tax.toFixed(2)}</span>
                      </div>
                      <div className="items-summary-row grand">
                        <span>Grand Total</span>
                        <span>₵{selected.total.toFixed(2)}</span>
                      </div>
                      {selected.status !== 'PROFORMA' && (
                        <>
                          <div className="items-summary-row">
                            <span>Amount Paid</span>
                            <span>₵{Math.max(0, displayAmountPaid).toFixed(2)}</span>
                          </div>
                          <div
                            className={`items-summary-row ${
                              displayAmountDue > 0
                                ? 'due-highlight'
                                : displayAmountDue < 0
                                  ? 'owed-highlight'
                                  : ''
                            }`}
                          >
                            <span>{dueRowLabel}</span>
                            <span>₵{dueDisplayValue.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </section>
                </div>

                <div className="invoice-modal-footer payment-footer-shell">
                  {selected.receipt ? (
                    <button
                      type="button"
                      className="receipt-pill-link"
                      onClick={() => setViewReceiptId(selected.receipt!.id)}
                    >
                      <FileText size={17} strokeWidth={2} aria-hidden />
                      <span>View Receipt</span>
                    </button>
                  ) : (
                    <form
                      action={`/api/invoices/${selected.id}/pay`}
                      method="POST"
                      className="invoice-modal-pay-form"
                    >
                      <div className="payment-footer-top">
                        <div className="payment-kind-row">
                          <label
                            className={`payment-kind-option ${
                              paymentKind === 'full' ? 'is-selected' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentKind"
                              value="full"
                              checked={paymentKind === 'full'}
                              onChange={() => {
                                setPaymentKind('full');
                                setAmount(Math.max(0, persistedDue).toFixed(2));
                              }}
                            />
                            <span>Full payment</span>
                          </label>
                          <label
                            className={`payment-kind-option ${
                              paymentKind === 'partial' ? 'is-selected' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentKind"
                              value="partial"
                              checked={paymentKind === 'partial'}
                              onChange={() => {
                                setPaymentKind('partial');
                                setAmount('');
                              }}
                            />
                            <span>Partial payment</span>
                          </label>
                        </div>
                        <div
                          className={`payment-due-pill ${
                            displayAmountDue < 0 ? 'owed' : 'due'
                          }`}
                        >
                          {duePillLabel} ${dueDisplayValue.toFixed(2)}
                        </div>
                      </div>

                      <div className="payment-footer-inputs">
                        <div
                          className={`pay-amount-group ${
                            paymentKind === 'full' ? 'full-width' : ''
                          }`}
                        >
                          <span className="pay-label">
                            {paymentKind === 'full' ? 'Amount to pay (full)' : 'Amount paid now'}
                          </span>
                          <div className="pay-input-row">
                            <span className="currency-prefix">$</span>
                            {paymentKind === 'full' ? (
                              <input
                                type="number"
                                name="amount"
                                min={0}
                                step={0.01}
                              value={amount}
                                readOnly
                                required
                              />
                            ) : (
                              <input
                                type="number"
                                name="amount"
                                min={0.01}
                                step={0.01}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={persistedDue > 0 ? persistedDue.toFixed(2) : '0.00'}
                                required
                              />
                            )}
                          </div>
                        </div>

                        {paymentKind === 'partial' && displayAmountDue > 0 && (
                          <div className="pay-amount-group">
                            <span className="pay-label">Next deadline (remaining amount)</span>
                            <div className="pay-input-row">
                              <input
                                type="date"
                                name="nextDueDate"
                                value={nextDueDate}
                                onChange={(e) => setNextDueDate(e.target.value)}
                                required={paymentKind === 'partial' && displayAmountDue > 0}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="payment-method-summary">
                        <div className="payment-method-summary-body">
                          <span className="payment-method-summary-label">
                            Payment method
                          </span>
                          {paymentMethodReady ? (
                            <div className="payment-method-summary-row">
                              <div
                                className={`payment-method-summary-mark payment-method-summary-mark--${paymentMethodBadgeClass}`}
                                aria-hidden
                              >
                                {paymentChoice === 'CASH' && (
                                  <Banknote
                                    className="payment-method-summary-mark-icon payment-method-summary-mark-icon--cash"
                                    strokeWidth={2}
                                  />
                                )}
                                {paymentChoice === 'MTN_MOMO' && (
                                  <img
                                    src="/Assets/Mtn_momo.svg"
                                    alt=""
                                    className="payment-method-summary-mark-img"
                                  />
                                )}
                                {paymentChoice === 'TELECEL_CASH' && (
                                  <img
                                    src="/Assets/Telecel_cash.png"
                                    alt=""
                                    className="payment-method-summary-mark-img payment-method-summary-mark-img--telecel"
                                  />
                                )}
                                {paymentChoice === 'BANK_TRANSFER' && (
                                  <Landmark
                                    className="payment-method-summary-mark-icon payment-method-summary-mark-icon--bank"
                                    strokeWidth={2}
                                  />
                                )}
                              </div>
                              <div className="payment-method-summary-details">
                                <p className="payment-method-summary-name">
                                  {paymentMethodLabel}
                                </p>
                                {transactionRef && (
                                  <p className="payment-method-summary-meta">
                                    <span className="payment-method-summary-meta-label">
                                      Reference
                                    </span>
                                    <span className="payment-method-summary-meta-value">
                                      {transactionRef}
                                    </span>
                                  </p>
                                )}
                                {paymentChoice === 'BANK_TRANSFER' && (
                                  <p className="payment-method-summary-meta payment-method-summary-meta--bank">
                                    <span className="payment-method-summary-meta-label">
                                      Account
                                    </span>
                                    <span className="payment-method-summary-meta-value">
                                      {bankName} · {accountNumber}
                                      <span className="payment-method-summary-meta-hint">
                                        {' '}
                                        ({accountName})
                                      </span>
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="payment-method-summary-placeholder">
                              No payment method selected
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="payment-method-trigger-btn"
                          onClick={openMethodFlow}
                        >
                          {paymentMethodReady ? 'Change method' : 'Add payment method'}
                        </button>
                      </div>

                      <input
                        type="hidden"
                        name="paymentMethod"
                        value={selectedPaymentMethod}
                      />
                      <input
                        type="hidden"
                        name="paymentProvider"
                        value={paymentChoice}
                      />
                      <input
                        type="hidden"
                        name="transactionRef"
                        value={transactionRef}
                      />
                      <input
                        type="hidden"
                        name="bankName"
                        value={bankName}
                      />
                      <input
                        type="hidden"
                        name="accountNumber"
                        value={accountNumber}
                      />
                      <input
                        type="hidden"
                        name="accountName"
                        value={accountName}
                      />
                      <div className="payment-footer-actions">
                        <button
                          type="submit"
                          className="btn btn-primary pay-button payment-submit-btn"
                          disabled={!paymentMethodReady}
                        >
                          {paymentKind === 'full' ? 'Pay full amount' : 'Confirm partial payment'}
                        </button>
                      </div>
                    </form>
                  )}
                  {methodFlowOpen && (
                    <div className="payment-method-flow-overlay" onClick={closeMethodFlow}>
                      <div
                        className="payment-method-flow-card"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="payment-method-flow-header">
                          <div>
                            <h4>Add Payment Method</h4>
                            <p>Choose method and enter required details.</p>
                          </div>
                          <span className="payment-method-flow-step-pill">
                            Step {methodFlowStep === 'select' ? '1' : '2'} of 2
                          </span>
                        </div>

                        {methodFlowStep === 'select' ? (
                          <>
                            <div className="payment-method-flow-list">
                              {(
                                [
                                  {
                                    id: 'CASH' as const,
                                    title: 'Cash',
                                    subtitle: 'Pay with physical cash',
                                    mark: 'cash' as const,
                                  },
                                  {
                                    id: 'MTN_MOMO' as const,
                                    title: 'MTN Momo',
                                    subtitle: 'Mobile money via MTN',
                                    mark: 'mtn' as const,
                                  },
                                  {
                                    id: 'TELECEL_CASH' as const,
                                    title: 'Telecel Cash',
                                    subtitle: 'Mobile money via Telecel',
                                    mark: 'telecel' as const,
                                  },
                                  {
                                    id: 'BANK_TRANSFER' as const,
                                    title: 'Bank Transfer',
                                    subtitle: 'Direct transfer from bank account',
                                    mark: 'bank' as const,
                                  },
                                ] as const
                              ).map((option) => (
                                <label
                                  key={option.id}
                                  className={`payment-method-flow-item ${
                                    draftPaymentChoice === option.id ? 'is-selected' : ''
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="draftPaymentChoice"
                                    value={option.id}
                                    checked={draftPaymentChoice === option.id}
                                    onChange={() =>
                                      setDraftPaymentChoice(option.id as PaymentChoice)
                                    }
                                  />
                                  <div>
                                    <p>{option.title}</p>
                                    <span className="payment-method-flow-subtitle">
                                      {option.subtitle}
                                    </span>
                                  </div>
                                  <div
                                    className="payment-method-flow-logo-mark"
                                    aria-hidden
                                  >
                                    {option.mark === 'cash' && (
                                      <Banknote
                                        className="payment-method-flow-mark-icon payment-method-flow-mark-icon--cash"
                                        strokeWidth={2}
                                        aria-hidden
                                      />
                                    )}
                                    {option.mark === 'mtn' && (
                                      <img
                                        src="/Assets/Mtn_momo.svg"
                                        alt=""
                                        className="payment-method-flow-mark-img"
                                      />
                                    )}
                                    {option.mark === 'telecel' && (
                                      <img
                                        src="/Assets/Telecel_cash.png"
                                        alt=""
                                        className="payment-method-flow-mark-img payment-method-flow-mark-img--telecel"
                                      />
                                    )}
                                    {option.mark === 'bank' && (
                                      <Landmark
                                        className="payment-method-flow-mark-icon payment-method-flow-mark-icon--bank"
                                        strokeWidth={2}
                                        aria-hidden
                                      />
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                            <div className="payment-method-flow-actions">
                              <button
                                type="button"
                                className="btn btn-outline payment-method-flow-btn secondary"
                                onClick={closeMethodFlow}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary payment-method-flow-btn primary"
                                onClick={() => {
                                  if (draftPaymentChoice === 'CASH') {
                                    setDraftTransactionRef('');
                                    setDraftBankName('');
                                    setDraftAccountNumber('');
                                    setDraftAccountName('');
                                    commitPaymentMethod();
                                  } else {
                                    setMethodFlowStep('details');
                                  }
                                }}
                              >
                                Continue
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="payment-method-flow-fields">
                              <p className="payment-method-flow-details-title">
                                {draftPaymentChoice === 'BANK_TRANSFER'
                                  ? 'Enter bank transfer details'
                                  : 'Enter mobile money reference'}
                              </p>
                              {(draftPaymentChoice === 'MTN_MOMO' ||
                                draftPaymentChoice === 'TELECEL_CASH') && (
                                <div className="pay-amount-group">
                                  <span className="pay-label">Reference number</span>
                                  <div className="pay-input-row">
                                    <input
                                      type="text"
                                      value={draftTransactionRef}
                                      onChange={(e) =>
                                        setDraftTransactionRef(e.target.value)
                                      }
                                      placeholder="Enter transaction reference"
                                    />
                                  </div>
                                </div>
                              )}
                              {draftPaymentChoice === 'BANK_TRANSFER' && (
                                <div className="bank-details-grid">
                                  <div className="pay-amount-group">
                                    <span className="pay-label">Bank name</span>
                                    <div className="pay-input-row">
                                      <input
                                        type="text"
                                        value={draftBankName}
                                        onChange={(e) => setDraftBankName(e.target.value)}
                                        placeholder="e.g. GCB Bank"
                                      />
                                    </div>
                                  </div>
                                  <div className="pay-amount-group">
                                    <span className="pay-label">Account number</span>
                                    <div className="pay-input-row">
                                      <input
                                        type="text"
                                        value={draftAccountNumber}
                                        onChange={(e) =>
                                          setDraftAccountNumber(e.target.value)
                                        }
                                        placeholder="Enter account number"
                                      />
                                    </div>
                                  </div>
                                  <div className="pay-amount-group full-width">
                                    <span className="pay-label">Account name</span>
                                    <div className="pay-input-row">
                                      <input
                                        type="text"
                                        value={draftAccountName}
                                        onChange={(e) => setDraftAccountName(e.target.value)}
                                        placeholder="Enter account name"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="payment-method-flow-actions">
                              <button
                                type="button"
                                className="btn btn-outline payment-method-flow-btn secondary"
                                onClick={() => setMethodFlowStep('select')}
                              >
                                Back
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary payment-method-flow-btn primary"
                                onClick={commitPaymentMethod}
                                disabled={!draftDetailsValid}
                              >
                                Continue
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
          document.body,
        )}

      <ReceiptModal receiptId={viewReceiptId} onClose={() => setViewReceiptId(null)} />
    </>
  );
}

