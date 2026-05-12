import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export type TopSellingSort = 'revenue' | 'quantity';
export type TopSellingLimit = 5 | 10;

export type TopSellingProduct = {
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
};

export function isTopSellingSort(value: unknown): value is TopSellingSort {
  return value === 'revenue' || value === 'quantity';
}

/** Product key: service name when linked, else line description. Skips cancelled invoices. */
export async function getTopSellingProducts(
  prisma: PrismaClient,
  options: {
    sort: TopSellingSort;
    limit: TopSellingLimit;
    /** When set, only invoice line items on invoices issued in this half-open local day. */
    issueDay?: { start: Date; end: Date };
  },
): Promise<TopSellingProduct[]> {
  const orderBy =
    options.sort === 'revenue'
      ? Prisma.sql`totalRevenue DESC`
      : Prisma.sql`totalQuantity DESC`;

  const day = options.issueDay;
  const issueFilter =
    day === undefined
      ? Prisma.empty
      : Prisma.sql`AND inv.issueDate >= ${day.start} AND inv.issueDate < ${day.end}`;

  const rows = await prisma.$queryRaw<
    { productName: string; totalQuantity: unknown; totalRevenue: unknown }[]
  >`
    SELECT * FROM (
      SELECT
        COALESCE(
          NULLIF(TRIM(s.name), ''),
          NULLIF(TRIM(ii.description), ''),
          '(Unnamed)'
        ) AS productName,
        SUM(ii.quantity) AS totalQuantity,
        SUM(
          CASE
            WHEN inv.subtotal > 0
            THEN (ii.quantity * ii.unitPrice / inv.subtotal) * inv.total
            ELSE ii.quantity * ii.unitPrice
          END
        ) AS totalRevenue
      FROM InvoiceItem ii
      LEFT JOIN Service s ON ii.serviceId = s.id
      INNER JOIN Invoice inv ON ii.invoiceId = inv.id
      WHERE inv.status != 'CANCELLED'
      ${issueFilter}
      GROUP BY 1
    ) AS agg
    ORDER BY ${orderBy}
    LIMIT ${options.limit}
  `;

  return rows.map((row) => ({
    productName: row.productName,
    totalQuantity: Number(row.totalQuantity),
    totalRevenue: Number(row.totalRevenue),
  }));
}
