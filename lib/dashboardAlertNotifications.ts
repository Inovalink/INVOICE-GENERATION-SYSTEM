import type { DashboardAlertRow } from '@/lib/dashboardAlerts';

type InvoiceCreatedInput = {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
};

/** Stub: previously pushed live alert dock events; kept for CreateInvoice compatibility. */
export function buildInvoiceCreatedAlertRow(_input: InvoiceCreatedInput): DashboardAlertRow {
  return {
    id: `invoice-created-${_input.invoiceId}`,
    kind: 'system',
    title: 'Invoice saved',
    description: `${_input.invoiceNumber} · ${_input.clientName}`,
    at: new Date().toISOString(),
    unread: true,
    iconVariant: 'bill',
    href: `/invoices/${_input.invoiceId}`,
  };
}

export function dispatchNewAlertPushes(_rows: DashboardAlertRow[]): void {
  // No-op: real-time dock was removed from the project snapshot.
}
