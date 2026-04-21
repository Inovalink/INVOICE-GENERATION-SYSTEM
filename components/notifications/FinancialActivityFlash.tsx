'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardAlertRow } from '@/lib/dashboardAlerts';
import { useFinancialAlertNotifications } from '@/components/notifications/FinancialAlertNotifications';
import { formatGhs } from '@/lib/formatGhs';

const COPY: Record<
  string,
  {
    title: string;
    description: string;
    kind: DashboardAlertRow['kind'];
    useReceiptPathAsHref?: boolean;
    useInvoicePathAsHref?: boolean;
  }
> = {
  partial_payment: {
    title: 'Partial payment recorded',
    description: 'The invoice was updated with this payment.',
    kind: 'payment',
  },
  receipt_from_payment: {
    title: 'Payment complete',
    description: 'Your receipt has been generated.',
    kind: 'receipt',
    useReceiptPathAsHref: true,
  },
  invoice_finalized: {
    title: 'Invoice finalized',
    description: 'Proforma was converted to a final invoice.',
    kind: 'system',
    useInvoicePathAsHref: true,
  },
  receipt_generated: {
    title: 'Receipt created',
    description: 'A receipt was generated from this invoice.',
    kind: 'receipt',
    useReceiptPathAsHref: true,
  },
  invoice_created: {
    title: 'Invoice created',
    description: 'A new invoice was successfully issued.',
    kind: 'system',
    useInvoicePathAsHref: true,
  },
  client_added: {
    title: 'Client added',
    description: 'The client was saved to your directory.',
    kind: 'system',
  },
  service_added: {
    title: 'Service added',
    description: 'The service is ready to use on invoices.',
    kind: 'system',
  },
};

function stripFlashParams(u: URL): string {
  u.searchParams.delete('ft_toast');
  u.searchParams.delete('invoiceId');
  u.searchParams.delete('paymentAmount');
  u.searchParams.delete('receiptId');
  u.searchParams.delete('invoiceNumber');
  u.searchParams.delete('clientName');
  u.searchParams.delete('invoiceTotal');
  const q = u.searchParams.toString();
  return q ? `${u.pathname}?${q}` : u.pathname;
}

/**
 * Shows dock toasts from `?ft_toast=` after redirects (payment, receipt, etc.).
 * Reads `window.location` in an effect so it always matches the real browser URL after a 303.
 * Full payment fires two toasts: payment received, then receipt issued.
 */
export default function FinancialActivityFlash() {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const router = useRouter();
  const { pushActivityNotification } = useFinancialAlertNotifications();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const u = new URL(window.location.href);
    const key = u.searchParams.get('ft_toast');
    if (!key) return;

    const def = COPY[key];
    const cleanPath = stripFlashParams(new URL(window.location.href));
    /** Dedupe across React Strict Mode double-mount / fast re-renders */
    const dedupeId = `${window.location.pathname}${window.location.search}`;
    const storageKey = `ft_toast_shown:${dedupeId}`;

    const scheduleReplace = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (mountedRef.current) router.replace(cleanPath, { scroll: false });
        });
      });
    };

    if (!def) {
      scheduleReplace();
      return;
    }

    if (sessionStorage.getItem(storageKey)) {
      scheduleReplace();
      return;
    }
    sessionStorage.setItem(storageKey, '1');
    window.setTimeout(() => {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }, 15_000);

    const invoiceIdParam = u.searchParams.get('invoiceId');
    const paymentAmountRaw = u.searchParams.get('paymentAmount');
    const paymentAmount = paymentAmountRaw ? Number(paymentAmountRaw) : NaN;
    const receiptIdParam = u.searchParams.get('receiptId');
    const invoiceNumberParam = u.searchParams.get('invoiceNumber');
    const clientNameParam = u.searchParams.get('clientName');
    const invoiceTotalRaw = u.searchParams.get('invoiceTotal');
    const invoiceTotal = invoiceTotalRaw ? Number(invoiceTotalRaw) : NaN;

    if (key === 'receipt_from_payment') {
      const payDesc =
        Number.isFinite(paymentAmount) && paymentAmount > 0
          ? `${formatGhs(paymentAmount)} received and applied to this invoice.`
          : 'Your payment was recorded successfully.';
      pushActivityNotification({
        title: 'Payment received',
        description: payDesc,
        kind: 'payment',
        href: invoiceIdParam ? `/invoices/${invoiceIdParam}` : undefined,
      });
      window.setTimeout(() => {
        pushActivityNotification({
          title: 'Receipt issued',
          description: def.description,
          kind: 'receipt',
          href: receiptIdParam
            ? `/receipts/${receiptIdParam}`
            : /^\/receipts\/[^/]+$/.test(pathname)
              ? pathname
              : undefined,
        });
      }, 450);
      scheduleReplace();
      return;
    }

    if (key === 'invoice_created') {
      const createdDescParts = [
        invoiceNumberParam ? `Invoice #${invoiceNumberParam}` : 'A new invoice',
        clientNameParam ? `for ${clientNameParam}` : null,
        Number.isFinite(invoiceTotal) && invoiceTotal >= 0 ? `(${formatGhs(invoiceTotal)})` : null,
      ].filter(Boolean);

      pushActivityNotification({
        title: def.title,
        description: `${createdDescParts.join(' ')} has been added successfully.`,
        kind: 'system',
        href: invoiceIdParam ? `/invoices/${invoiceIdParam}` : '/invoices',
      });
      scheduleReplace();
      return;
    }

    let href: string | undefined;
    if (def.useReceiptPathAsHref && /^\/receipts\/[^/]+$/.test(pathname)) {
      href = pathname;
    }
    if (def.useInvoicePathAsHref && /^\/invoices\/[^/]+$/.test(pathname)) {
      href = pathname;
    }
    if (key === 'partial_payment' && invoiceIdParam) {
      href = `/invoices/${invoiceIdParam}`;
    }

    pushActivityNotification({
      title: def.title,
      description: def.description,
      kind: def.kind,
      href,
    });
    scheduleReplace();
  }, [pathname, searchParams, router, pushActivityNotification]);

  return null;
}
