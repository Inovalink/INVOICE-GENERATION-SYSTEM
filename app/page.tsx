import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { getCurrentContext, getSessionClaims } from '@/lib/auth/getCurrentUser';
import { Wallet, FileText, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatGhs } from '@/lib/formatGhs';
import { formatUserDisplayName } from '@/lib/formatUserDisplayName';
import { getFinanceDayMetrics, getFinanceSummaryMetrics } from '@/lib/financeSummaryMetrics';
import { getTopSellingProducts } from '@/lib/topSellingProducts';
import { buildDashboardAlerts } from '@/lib/dashboardAlerts';
import { parseLocalDayBounds } from '@/lib/financeDayBounds';
import { prisma } from '@/lib/prisma';
import { DASHBOARD_HOME_INVOICE_LIMIT } from '@/lib/dashboardHome';
import { getInvoiceTotalCardData } from '@/lib/invoiceTotalSeries';
import MetricSummaryCard from '@/components/dashboard/MetricSummaryCard';
import DashboardLiveRefresh from '@/components/dashboard/DashboardLiveRefresh';
import FinanceGreetingSection from '@/components/finance/FinanceGreetingSection';
import type { InvoiceSummary } from '@/components/invoices/InvoicesTable';
import './dashboard.css';
import './finance/finance.css';
import './invoices/invoices.css';

/** Code-split heavy client widgets (Server Components cannot use `dynamic(..., { ssr: false })`) */
const RevenueTrendsSection = nextDynamic(() => import('@/components/finance/RevenueTrendsSection'), {
  loading: () => <div className="dashboard-chunk-fallback dashboard-chunk-fallback--trends" aria-hidden />,
});

const TopSellingProductsCard = nextDynamic(() => import('@/components/finance/TopSellingProductsCard'), {
  loading: () => <div className="dashboard-chunk-fallback dashboard-chunk-fallback--split-card" aria-hidden />,
});

const InvoiceTotalCard = nextDynamic(() => import('@/components/finance/InvoiceTotalCard'), {
  loading: () => <div className="dashboard-chunk-fallback dashboard-chunk-fallback--split-card" aria-hidden />,
});

const DashboardAlerts = nextDynamic(() => import('@/components/dashboard/DashboardAlerts'), {
  loading: () => <div className="dashboard-chunk-fallback dashboard-chunk-fallback--alerts" aria-hidden />,
});

const InvoicesTable = nextDynamic(() => import('@/components/invoices/InvoicesTable'), {
  loading: () => (
    <div
      className="dashboard-chunk-fallback dashboard-chunk-fallback--table"
      role="status"
      aria-label="Loading invoices"
    />
  ),
});

type InvoiceDashboardRow = Prisma.InvoiceGetPayload<{
  include: { client: true; receipt: true; items: true };
}>;

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{ date?: string }>;
};

function mapInvoicesForTable(invoices: InvoiceDashboardRow[]): InvoiceSummary[] {
  return invoices.map((inv) => ({
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
}

const invoiceDashboardInclude = {
  client: true,
  receipt: true,
  items: true,
} as const;

export default async function Home({ searchParams }: PageProps) {
  const session = await getSessionClaims();
  if (!session) {
    redirect('/signup');
  }
  const context = await getCurrentContext();
  const user = context?.user;
  const displayName =
    user && (user.firstName.trim() || user.lastName.trim())
      ? formatUserDisplayName(user.firstName, user.lastName)
      : user?.name.trim() || '';
  const greetingFirstName = displayName.split(/\s+/).filter(Boolean)[0] ?? 'there';

  const sp = (await searchParams) ?? {};
  const rawDate = sp.date;
  if (rawDate && !parseLocalDayBounds(rawDate)) {
    redirect('/');
  }

  const dayScope = Boolean(rawDate && parseLocalDayBounds(rawDate));
  const bounds = dayScope ? parseLocalDayBounds(rawDate!)! : null;
  const issueDay = bounds ? { gte: bounds.start, lt: bounds.end } : undefined;

  if (dayScope && bounds) {
    const [dayMetrics, initialTopSelling, dashboardAlerts, invoices, invoiceTotalCardData] =
      await Promise.all([
        getFinanceDayMetrics(prisma, bounds),
        getTopSellingProducts(prisma, { sort: 'revenue', limit: 10, issueDay: bounds }),
        buildDashboardAlerts(prisma, { dayBounds: bounds }),
        prisma.invoice.findMany({
          where: { issueDate: issueDay },
          orderBy: { createdAt: 'desc' },
          take: DASHBOARD_HOME_INVOICE_LIMIT,
          include: invoiceDashboardInclude,
        }),
        getInvoiceTotalCardData(prisma),
      ]);

    const invoicesForClient = mapInvoicesForTable(invoices);
    const dm = dayMetrics;
    const dateLabel = bounds.start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <div className="financial-dashboard financial-dashboard--compact">
        <DashboardLiveRefresh />
        <Suspense fallback={<div className="finance-greeting-fallback" aria-hidden />}>
          <FinanceGreetingSection firstName={greetingFirstName} />
        </Suspense>

        <div className="tabs-container">
          <div className="page-tabs">
            <Link href={`/?date=${encodeURIComponent(rawDate!)}`} className="tab active">
              Overview
            </Link>
            <button type="button" className="tab">
              Transactions
            </button>
            <Link href="/invoices" className="tab">
              Invoices
            </Link>
          </div>
        </div>

        <section className="dashboard-metrics-row" aria-label="Revenue and payment summary">
          <MetricSummaryCard
            label="Payments received (actual revenue)"
            value={formatGhs(dm.paymentsTotal)}
            accent="primary"
            icon={Wallet}
            trendLabel={dm.paymentsVsPreviousDay.label}
            trendTone={dm.paymentsVsPreviousDay.tone}
            trendDirection={dm.paymentsVsPreviousDay.direction}
          />
          <MetricSummaryCard
            label="Expected revenue"
            value={formatGhs(dm.expectedRevenue)}
            accent="trend"
            icon={FileText}
            trendLabel={dm.expectedRevenueVsPreviousDay.label}
            trendTone={dm.expectedRevenueVsPreviousDay.tone}
            trendDirection={dm.expectedRevenueVsPreviousDay.direction}
          />
          <MetricSummaryCard
            label="Outstanding payments"
            value={formatGhs(dm.outstandingAmount)}
            accent="pending"
            icon={Clock}
            trendLabel={dm.outstandingVsPreviousDay.label}
            trendTone={dm.outstandingVsPreviousDay.tone}
            trendDirection={dm.outstandingVsPreviousDay.direction}
          />
          <MetricSummaryCard
            label="Overdue payments"
            value={formatGhs(dm.overdueAmountDue)}
            accent="overdue"
            icon={AlertTriangle}
            trendLabel={dm.overdueVsPreviousDay.label}
            trendTone={dm.overdueVsPreviousDay.tone}
            trendDirection={dm.overdueVsPreviousDay.direction}
            wiggleIcon={dm.overdueCount > 0}
          />
          <MetricSummaryCard
            label="Gross profit"
            value={formatGhs(dm.profit)}
            accent="profit"
            icon={TrendingUp}
            trendLabel={dm.profitVsPreviousDay.label}
            trendTone={dm.profitVsPreviousDay.tone}
            trendDirection={dm.profitVsPreviousDay.direction}
          />
        </section>

        <div className="financial-charts-alerts" aria-label="Revenue trends, analytics, and alerts">
          <div className="financial-charts-alerts__trends">
            <RevenueTrendsSection focusDate={rawDate} />
          </div>
          <div className="financial-charts-alerts__analytics">
            <div className="finance-analytics-row">
              <TopSellingProductsCard
                initialProducts={initialTopSelling}
                layout="split"
                financeDate={rawDate}
              />
              <InvoiceTotalCard data={invoiceTotalCardData} variant="split" />
            </div>
          </div>
          <div className="financial-charts-alerts__cluster">
            <aside className="financial-charts-alerts__sidebar">
              <DashboardAlerts alerts={dashboardAlerts} />
            </aside>

            <section
              className="financial-charts-alerts__invoice-list finance-invoice-list-card content-card"
              aria-label="Invoice list"
            >
              <InvoicesTable
                variant="dashboard"
                dashboardTitle={`Invoice list — ${dateLabel}`}
                invoices={invoicesForClient}
                itemsPerPage={10}
              />
            </section>
          </div>
        </div>
      </div>
    );
  }

  const [summary, initialTopSelling, dashboardAlerts, invoices, invoiceTotalCardData] =
    await Promise.all([
      getFinanceSummaryMetrics(prisma),
      getTopSellingProducts(prisma, { sort: 'revenue', limit: 10 }),
      buildDashboardAlerts(prisma),
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: DASHBOARD_HOME_INVOICE_LIMIT,
        include: invoiceDashboardInclude,
      }),
      getInvoiceTotalCardData(prisma),
    ]);

  const invoicesForClient = mapInvoicesForTable(invoices);
  const sm = summary;

  return (
    <div className="financial-dashboard">
      <DashboardLiveRefresh />
      <Suspense fallback={<div className="finance-greeting-fallback" aria-hidden />}>
        <FinanceGreetingSection firstName={greetingFirstName} />
      </Suspense>

      <div className="tabs-container">
        <div className="page-tabs">
          <Link href="/" className="tab active">
            Overview
          </Link>
          <button type="button" className="tab">
            Transactions
          </button>
          <Link href="/invoices" className="tab">
            Invoices
          </Link>
        </div>
      </div>

      <section className="dashboard-metrics-row" aria-label="Revenue and payment summary">
        <MetricSummaryCard
          label="Payments received (actual revenue)"
          value={formatGhs(sm.totalRevenueLifetime)}
          accent="primary"
          icon={Wallet}
          trendLabel={sm.revenueMoM.label}
          trendTone={sm.revenueMoM.tone}
          trendDirection={sm.revenueMoM.direction}
        />
        <MetricSummaryCard
          label="Expected revenue"
          value={formatGhs(sm.expectedRevenueLifetime)}
          accent="trend"
          icon={FileText}
          trendLabel={sm.expectedRevenueWoW.label}
          trendTone={sm.expectedRevenueWoW.tone}
          trendDirection={sm.expectedRevenueWoW.direction}
        />
        <MetricSummaryCard
          label="Outstanding payments"
          value={formatGhs(sm.outstandingAmount)}
          accent="pending"
          icon={Clock}
          trendLabel={sm.outstandingWoW.label}
          trendTone={sm.outstandingWoW.tone}
          trendDirection={sm.outstandingWoW.direction}
        />
        <MetricSummaryCard
          label="Overdue payments"
          value={formatGhs(sm.overdueAmountDue)}
          accent="overdue"
          icon={AlertTriangle}
          trendLabel={sm.overdueWoW.label}
          trendTone={sm.overdueWoW.tone}
          trendDirection={sm.overdueWoW.direction}
          wiggleIcon={sm.overdueCount > 0}
        />
        <MetricSummaryCard
          label="Gross profit"
          value={formatGhs(sm.profit)}
          accent="profit"
          icon={TrendingUp}
          trendLabel={sm.profitWoW.label}
          trendTone={sm.profitWoW.tone}
          trendDirection={sm.profitWoW.direction}
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
        <div className="financial-charts-alerts__cluster">
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
    </div>
  );
}
