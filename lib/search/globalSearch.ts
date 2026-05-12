import type { InvoiceStatus, Prisma, PrismaClient } from '@prisma/client';
import { formatGhs } from '@/lib/formatGhs';

export type SearchSuggestion = {
  id: string;
  kind: 'invoice' | 'payment' | 'receipt' | 'client' | 'service' | 'task' | 'keyword' | 'date' | 'period';
  label: string;
  subLabel?: string;
  href: string;
  badge?: string;
};

const clampLimit = (n: number) => Math.min(25, Math.max(1, Math.floor(n)));

type SearchFilterOptions = {
  from?: Date;
  to?: Date;
};

function normalizeLower(input: string): string {
  return input.trim().toLowerCase();
}

function toTokenSet(input: string): Set<string> {
  return new Set(
    normalizeLower(input)
      .split(/[\s,./_-]+/)
      .map((t) => t.trim())
      .filter(Boolean),
  );
}

function initialsFor(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .toLowerCase();
}

function compactAlnum(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function dateRange(field: 'createdAt' | 'issueDate' | 'paymentDate' | 'dueDate', filters?: SearchFilterOptions) {
  if (!filters?.from && !filters?.to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (filters.from) range.gte = filters.from;
  if (filters.to) range.lte = filters.to;
  return { [field]: range } as Prisma.InvoiceWhereInput &
    Prisma.ClientWhereInput &
    Prisma.ServiceWhereInput &
    Prisma.TaskWhereInput &
    Prisma.PaymentWhereInput &
    Prisma.ReceiptWhereInput;
}

export async function searchSuggestions(
  prisma: PrismaClient,
  rawQ: string,
  limitTotal: number,
  filters?: SearchFilterOptions,
): Promise<SearchSuggestion[]> {
  const q = rawQ.trim();
  if (q.length < 1) return [];

  const limit = clampLimit(limitTotal);
  const perKind = Math.max(4, Math.ceil(limit / 6));

  // Single-char queries use prefix (startsWith) to avoid matching everything;
  // multi-char queries use contains for broader fuzzy matching.
  const prefix = q.length === 1;
  const tokens = toTokenSet(q);
  const normalized = normalizeLower(q);
  const compactQuery = compactAlnum(q);

  const wantsReceipt = tokens.has('receipt') || tokens.has('receipts');
  const wantsRevenue = tokens.has('revenue') || tokens.has('revenues') || tokens.has('sales');
  const wantsPayment =
    tokens.has('payment') ||
    tokens.has('payments') ||
    tokens.has('paid') ||
    tokens.has('pending') ||
    tokens.has('partially') ||
    tokens.has('partial') ||
    normalized.includes('pending payment') ||
    normalized.includes('partially paid');

  const statusHints: InvoiceStatus[] = [];
  if (tokens.has('paid') && !tokens.has('partial') && !tokens.has('partially')) statusHints.push('PAID');
  if (tokens.has('partial') || tokens.has('partially') || normalized.includes('partially paid')) {
    statusHints.push('PARTIALLY_PAID');
  }
  if (tokens.has('pending') || tokens.has('unpaid') || normalized.includes('pending payment')) {
    statusHints.push('FINAL');
  }

  const paymentStatusHints: string[] = [];
  if (tokens.has('paid')) paymentStatusHints.push('paid');
  if (tokens.has('pending') || tokens.has('unpaid')) paymentStatusHints.push('pending');
  if (tokens.has('partial') || tokens.has('partially')) paymentStatusHints.push('partial');

  const invoiceOr: Prisma.InvoiceWhereInput[] = prefix
    ? [
        { invoiceNumber: { startsWith: q } },
        { client: { name: { startsWith: q } } },
        { client: { company: { startsWith: q } } },
      ]
    : [
        { invoiceNumber: { contains: q } },
        { client: { name: { contains: q } } },
        { client: { company: { contains: q } } },
      ];

  if (statusHints.length > 0) invoiceOr.push({ status: { in: statusHints } });
  if (paymentStatusHints.length > 0) invoiceOr.push({ paymentStatus: { in: paymentStatusHints } });
  if (wantsReceipt) invoiceOr.push({ receipt: { isNot: null } });

  const [invoices, clients, services, tasks, payments, receipts] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        AND: [{ OR: invoiceOr }, dateRange('issueDate', filters) ?? {}],
      },
      take: Math.max(perKind * 2, 10),
      orderBy: { createdAt: 'desc' },
      include: { client: true },
    }),
    prisma.client.findMany({
      where: {
        AND: [
          {
            OR: prefix
              ? [{ name: { startsWith: q } }, { company: { startsWith: q } }]
              : [{ name: { contains: q } }, { company: { contains: q } }, { email: { contains: q } }],
          },
          dateRange('createdAt', filters) ?? {},
        ],
      },
      take: Math.max(perKind * 2, 10),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.service.findMany({
      where: {
        AND: [
          {
            OR: prefix
              ? [{ name: { startsWith: q } }, { category: { startsWith: q } }]
              : [{ name: { contains: q } }, { category: { contains: q } }],
          },
          dateRange('createdAt', filters) ?? {},
        ],
      },
      take: perKind,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.findMany({
      where: {
        AND: [{ title: prefix ? { startsWith: q } : { contains: q } }, dateRange('dueDate', filters) ?? {}],
      },
      take: perKind,
      orderBy: { dueDate: 'asc' },
    }),
    prisma.payment.findMany({
      where: {
        AND: [
          {
            OR: prefix
              ? [
                  { invoice: { invoiceNumber: { startsWith: q } } },
                  { invoice: { client: { name: { startsWith: q } } } },
                  { notes: { startsWith: q } },
                ]
              : [
                  { invoice: { invoiceNumber: { contains: q } } },
                  { invoice: { client: { name: { contains: q } } } },
                  { notes: { contains: q } },
                ],
          },
          dateRange('paymentDate', filters) ?? {},
        ],
      },
      include: { invoice: { include: { client: true } } },
      take: wantsPayment || statusHints.length > 0 ? perKind * 2 : perKind,
      orderBy: { paymentDate: 'desc' },
    }),
    prisma.receipt.findMany({
      where: {
        AND: [
          {
            OR: prefix
              ? [
                  { receiptNumber: { startsWith: q } },
                  { invoice: { invoiceNumber: { startsWith: q } } },
                  { invoice: { client: { name: { startsWith: q } } } },
                ]
              : [
                  { receiptNumber: { contains: q } },
                  { invoice: { invoiceNumber: { contains: q } } },
                  { invoice: { client: { name: { contains: q } } } },
                ],
          },
          dateRange('issueDate', filters) ?? {},
        ],
      },
      include: { invoice: { include: { client: true } } },
      take: wantsReceipt ? perKind * 2 : perKind,
      orderBy: { issueDate: 'desc' },
    }),
  ]);

  const out: SearchSuggestion[] = [];

  for (const inv of invoices.filter((row) => {
    if (!compactQuery) return true;
    const nameInitials = initialsFor(row.client.name);
    const companyInitials = row.client.company ? initialsFor(row.client.company) : '';
    const invoiceCompact = compactAlnum(row.invoiceNumber);
    return (
      invoiceCompact.includes(compactQuery) ||
      nameInitials.startsWith(compactQuery) ||
      companyInitials.startsWith(compactQuery)
    );
  })) {
    const isOverdue =
      !!inv.dueDate &&
      inv.dueDate.getTime() < Date.now() &&
      inv.paymentStatus.toLowerCase() !== 'paid' &&
      inv.status !== 'PAID';
    const paymentStatusLabel = isOverdue
      ? 'overdue'
      : inv.paymentStatus.toLowerCase() === 'partial'
        ? 'partially paid'
        : inv.paymentStatus.toLowerCase();
    out.push({
      id: `inv-${inv.id}`,
      kind: 'invoice',
      label: inv.invoiceNumber,
      subLabel: `${inv.client.name} · ${paymentStatusLabel}`,
      href: `/invoices/${inv.id}`,
      badge: formatGhs(inv.total),
    });
  }

  for (const c of clients.filter((row) => {
    if (!compactQuery) return true;
    return initialsFor(row.name).startsWith(compactQuery) || compactAlnum(row.name).includes(compactQuery);
  })) {
    out.push({
      id: `cli-${c.id}`,
      kind: 'client',
      label: c.name,
      subLabel: c.company ?? c.email ?? undefined,
      href: `/clients`,
      badge: 'Client',
    });
  }

  for (const s of services) {
    out.push({
      id: `svc-${s.id}`,
      kind: 'service',
      label: s.name,
      subLabel: s.category,
      href: `/services`,
      badge: formatGhs(s.price),
    });
  }

  for (const t of tasks) {
    out.push({
      id: `tsk-${t.id}`,
      kind: 'task',
      label: t.title,
      subLabel: t.dueDate.toLocaleDateString('en-GB'),
      href: `/tasks`,
      badge: t.completed ? 'Done' : 'Open',
    });
  }

  for (const p of payments) {
    out.push({
      id: `pay-${p.id}`,
      kind: 'payment',
      label: `Payment for ${p.invoice.invoiceNumber}`,
      subLabel: `${p.invoice.client.name} · ${p.paymentDate.toLocaleDateString('en-GB')}`,
      href: `/invoices/${p.invoice.id}`,
      badge: formatGhs(p.amount),
    });
  }

  for (const r of receipts) {
    out.push({
      id: `rcp-${r.id}`,
      kind: 'receipt',
      label: r.receiptNumber,
      subLabel: `${r.invoice.client.name} · ${r.issueDate.toLocaleDateString('en-GB')}`,
      href: `/receipts/${r.id}`,
      badge: formatGhs(r.totalAmount),
    });
  }

  if (wantsRevenue) {
    out.push({
      id: `kw-revenue-${q}`,
      kind: 'keyword',
      label: 'Revenue dashboard',
      subLabel: 'Open revenue trends and financial performance',
      href: '/finance',
      badge: 'Revenue',
    });
  }

  return out.slice(0, limit);
}
