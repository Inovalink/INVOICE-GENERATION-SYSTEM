import type { DashboardAlertRow } from '@/lib/dashboardAlerts';
import { formatGhs } from '@/lib/formatGhs';

type InvoiceCreatedInput = {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
};

type Listener = (rows: DashboardAlertRow[]) => void;

let listener: Listener | null = null;
/** Rows dispatched before the provider mounted its listener (e.g. very fast POST after navigation). */
let pendingRows: DashboardAlertRow[] = [];

/** Wired by `FinancialAlertNotificationsProvider` so any screen can fire dock toasts. */
export function setDashboardAlertPushListener(fn: Listener | null) {
  listener = fn;
}

/** Called once when the listener is registered; replays any early dispatches. */
export function flushPendingDashboardAlertPushes(emit: (row: DashboardAlertRow) => void): void {
  if (pendingRows.length === 0) return;
  for (const row of pendingRows) {
    emit(row);
  }
  pendingRows = [];
}

export function buildInvoiceCreatedAlertRow(input: InvoiceCreatedInput): DashboardAlertRow {
  return {
    /** Must match `buildDashboardAlerts` recent-invoice id so polling does not duplicate the toast. */
    id: `sys-inv-${input.invoiceId}`,
    kind: 'system',
    title: 'Invoice issued',
    description: `Invoice #${input.invoiceNumber} for ${input.clientName} (${formatGhs(input.total)}).`,
    at: new Date().toISOString(),
    unread: true,
    iconVariant: 'shield',
    href: `/invoices/${input.invoiceId}`,
  };
}

export function dispatchNewAlertPushes(rows: DashboardAlertRow[]): void {
  if (listener) {
    listener(rows);
  } else {
    pendingRows.push(...rows);
  }
}
