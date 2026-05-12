import Link from 'next/link';
import { Download, Wallet, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { formatGhs } from '@/lib/formatGhs';
import { getFinanceSummaryMetrics } from '@/lib/financeSummaryMetrics';
import { getInvoiceTotalCardData } from '@/lib/invoiceTotalSeries';
import { getTopSellingProducts } from '@/lib/topSellingProducts';
import { buildDashboardAlerts } from '@/lib/dashboardAlerts';
import { getSessionClaims } from '@/lib/auth/getCurrentUser';
import MetricSummaryCard from '@/components/dashboard/MetricSummaryCard';
import DashboardAlerts from '@/components/dashboard/DashboardAlerts';
import RevenueTrendsSection from '@/components/finance/RevenueTrendsSection';
import InvoiceTotalCard from '@/components/finance/InvoiceTotalCard';
import TopSellingProductsCard from '@/components/finance/TopSellingProductsCard';
import InvoicesTable, { InvoiceSummary } from '@/components/invoices/InvoicesTable';
import '../dashboard.css';
import './finance.css';
import '../invoices/invoices.css';
import { prisma } from '@/lib/prisma';

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const dynamic = 'force-dynamic';

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default async function FinancePage() {
  const session = await getSessionClaims();
  const todayStr = localDateString(new Date());

  const [financeMetrics, invoiceTotalCardData, initialTopSelling, dismissedRows, invoices] =
    await Promise.all([
      getFinanceSummaryMetrics(prisma),
      getInvoiceTotalCardData(prisma),
      getTopSellingProducts(prisma, { sort: 'revenue', limit: 10 }),
      session
        ? prisma.dismissedAlert.findMany({
            where: { userId: session.sub, dismissedDate: todayStr },
            select: { alertId: true },
          })
        : Promise.resolve([]),
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          client: true,
          receipt: true,
          items: true,
        },
      }),
    ]);

  const dismissedIds = new Set(dismissedRows.map((r) => r.alertId));
  const dashboardAlerts = await buildDashboardAlerts(prisma, { dismissedAlertIds: dismissedIds });

  const invoicesForClient: InvoiceSummary[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    subtotal: safeNumber(inv.subtotal),
    discount: safeNumber(inv.discount),
    tax: safeNumber(inv.tax),
    total: safeNumber(inv.total),
    totalAmount: safeNumber(inv.totalAmount),
    depositAmount: safeNumber(inv.depositAmount),
    amountDue: safeNumber(inv.amountDue),
    paymentStatus: inv.paymentStatus,
    status: inv.status,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    paymentTerms: inv.paymentTerms,
    notes: inv.notes,
    client: {
      name: inv.client.name,
      company: inv.client.company,
      address: inv.client.address ?? null,
      email: inv.client.email ?? null,
    },
    items: inv.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    })),
    receipt: inv.receipt ? { id: inv.receipt.id } : null,
  }));

  return (
    <div className="financial-dashboard">
      <div className="page-header">
        <div>
          <h1>Financial</h1>
          <p>Manage finances, transactions, and invoices</p>
        </div>
        <Link href="/invoices" className="btn btn-outline">
          All invoices
        </Link>
      </div>

      <div className="tabs-container">
        <div className="page-tabs">
          <Link href="/finance" className="tab active">
            Overview
          </Link>
          <button type="button" className="tab">
            Transactions
          </button>
          <Link href="/invoices" className="tab">
            Invoices
          </Link>
        </div>
        <button type="button" className="btn btn-outline export-btn">
          <Download size={14} /> Export
        </button>
      </div>

      <section className="dashboard-metrics-row" aria-label="Revenue and payment summary">
        <MetricSummaryCard
          label="Total revenue"
          value={formatGhs(financeMetrics.totalRevenueLifetime)}
          accent="primary"
          icon={Wallet}
          trendLabel={financeMetrics.revenueMoM.label}
          trendTone={financeMetrics.revenueMoM.tone}
          trendDirection={financeMetrics.revenueMoM.direction}
        />
        <MetricSummaryCard
          label="Monthly revenue trends"
          value={formatGhs(financeMetrics.thisMonthRevenue)}
          accent="trend"
          icon={TrendingUp}
          trendLabel={`Last month · ${formatGhs(financeMetrics.lastMonthRevenue)}`}
          trendTone="neutral"
          trendDirection="flat"
        />
        <MetricSummaryCard
          label="Outstanding (Pending) payments"
          value={formatGhs(financeMetrics.outstandingAmount)}
          accent="pending"
          icon={Clock}
          trendLabel={
            financeMetrics.pendingPaymentInvoiceCount === 1
              ? '1 invoice awaiting payment'
              : `${financeMetrics.pendingPaymentInvoiceCount.toLocaleString('en-US')} invoices awaiting payment`
          }
          trendTone="neutral"
          trendDirection="flat"
        />
        <MetricSummaryCard
          label="Overdue invoices"
          value={formatGhs(financeMetrics.overdueAmountDue)}
          accent="overdue"
          icon={AlertTriangle}
          trendLabel={
            financeMetrics.overdueCount === 0
              ? 'No invoices past due'
              : financeMetrics.overdueCount === 1
                ? '1 invoice past due'
                : `${financeMetrics.overdueCount.toLocaleString('en-US')} invoices past due`
          }
          trendTone={financeMetrics.overdueCount > 0 ? 'negative' : 'neutral'}
          trendDirection="flat"
        />
      </section>

      <div className="financial-charts-alerts" aria-label="Revenue trends, analytics, and alerts">
        <div className="financial-charts-alerts__trends">
          <RevenueTrendsSection />
        </div>
        <div className="financial-charts-alerts__analytics">
          <div className="finance-analytics-row">
            <TopSellingProductsCard initialProducts={initialTopSelling} layout="split" />
            <InvoiceTotalCard data={invoiceTotalCardData} variant="split" />
          </div>
        </div>
        <aside className="financial-charts-alerts__sidebar">
          <DashboardAlerts alerts={dashboardAlerts} />
        </aside>

        <section
          className="financial-charts-alerts__invoice-list finance-invoice-list-card content-card"
          aria-label="Invoice list"
        >
          <InvoicesTable
            variant="dashboard"
            dashboardTitle="Invoice list"
            invoices={invoicesForClient}
            itemsPerPage={10}
          />
        </section>
      </div>
    </div>
  );
}
