'use client';

import { useEffect, useMemo, useState } from 'react';
import { invoiceDisplayStatus } from '@/lib/invoiceDue';
import { clampPage } from '@/lib/pagination';
import PaginationBar from '@/components/ui/PaginationBar';

export type DashboardInvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientEmail: string;
  clientName: string;
  total: number;
  dueDate: string | null;
  status: string;
  paymentStatus: string;
  amountDue: number;
  depositAmount: number;
};

const PAGE_SIZE = 10;

export default function DashboardInvoiceList({
  invoices,
}: {
  invoices: DashboardInvoiceRow[];
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [invoices.length, totalPages]);

  const safePage = clampPage(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return invoices.slice(start, start + PAGE_SIZE);
  }, [invoices, safePage]);

  return (
    <>
      <div className="dashboard-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Email</th>
              <th>Client</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-row">
                  No invoices found yet. Create your first invoice to get started.
                </td>
              </tr>
            ) : (
              pageRows.map((inv) => {
                const displayStatus = invoiceDisplayStatus({
                  status: inv.status,
                  paymentStatus: inv.paymentStatus,
                  dueDate: inv.dueDate,
                  amountDue: Number(inv.amountDue),
                  total: Number(inv.total),
                  depositAmount: Number(inv.depositAmount),
                });

                let statusClass = 'status-pill-pending';
                if (displayStatus === 'OVERDUE') {
                  statusClass = 'status-pill-overdue';
                } else {
                  if (inv.status === 'PAID') statusClass = 'status-pill-paid';
                  if (inv.status === 'PROFORMA') statusClass = 'status-pill-draft';
                  if (inv.status === 'PARTIALLY_PAID') statusClass = 'status-pill-partial';
                }

                const statusLabelMap: Record<string, string> = {
                  PROFORMA: 'Proforma',
                  FINAL: 'Pending',
                  PAID: 'Paid',
                  PARTIALLY_PAID: 'Partially Paid',
                  CANCELLED: 'Cancelled',
                  OVERDUE: 'Overdue',
                };
                const statusLabel =
                  statusLabelMap[displayStatus] ??
                  displayStatus
                    .toLowerCase()
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                return (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.clientEmail}</td>
                    <td>{inv.clientName}</td>
                    <td>${inv.total.toLocaleString('en-US')}</td>
                    <td>
                      {inv.dueDate
                        ? new Date(inv.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Upon receipt'}
                    </td>
                    <td>
                      <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {invoices.length > 0 && (
        <PaginationBar
          currentPage={safePage}
          totalItems={invoices.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="Invoices"
        />
      )}
    </>
  );
}
