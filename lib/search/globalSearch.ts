import type { PrismaClient } from '@prisma/client';
import { formatGhs } from '@/lib/formatGhs';

export type SearchSuggestion = {
  id: string;
  kind: 'invoice' | 'payment' | 'receipt' | 'client' | 'service' | 'task' | 'keyword';
  label: string;
  subLabel?: string;
  href: string;
  badge?: string;
};

const clampLimit = (n: number) => Math.min(25, Math.max(1, Math.floor(n)));

export async function searchSuggestions(
  prisma: PrismaClient,
  rawQ: string,
  limitTotal: number,
): Promise<SearchSuggestion[]> {
  const q = rawQ.trim();
  if (q.length < 2) return [];

  const limit = clampLimit(limitTotal);
  const perKind = Math.max(3, Math.ceil(limit / 4));

  const [invoices, clients, services, tasks] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: q } },
          { client: { name: { contains: q } } },
          { client: { company: { contains: q } } },
        ],
      },
      take: perKind,
      orderBy: { createdAt: 'desc' },
      include: { client: true },
    }),
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { company: { contains: q } },
          { email: { contains: q } },
        ],
      },
      take: perKind,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.service.findMany({
      where: {
        OR: [{ name: { contains: q } }, { category: { contains: q } }],
      },
      take: perKind,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.findMany({
      where: { title: { contains: q } },
      take: perKind,
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  const out: SearchSuggestion[] = [];

  for (const inv of invoices) {
    out.push({
      id: `inv-${inv.id}`,
      kind: 'invoice',
      label: inv.invoiceNumber,
      subLabel: inv.client.name,
      href: `/invoices/${inv.id}`,
      badge: formatGhs(inv.total),
    });
  }

  for (const c of clients) {
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

  return out.slice(0, limit);
}
