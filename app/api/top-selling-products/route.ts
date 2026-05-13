import { NextResponse } from 'next/server';
import {
  getTopSellingProducts,
  isTopSellingSort,
  type TopSellingLimit,
} from '@/lib/topSellingProducts';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function parseLimit(raw: string | null): TopSellingLimit {
  if (raw === '5') return 5;
  return 10;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sortRaw = searchParams.get('sort');
  const limitRaw = searchParams.get('limit');

  const sort = isTopSellingSort(sortRaw) ? sortRaw : 'revenue';
  const limit = parseLimit(limitRaw);

  try {
    const products = await getTopSellingProducts(prisma, { sort, limit });
    return NextResponse.json({ sort, limit, products });
  } catch (e) {
    console.error('top-selling-products', e);
    return NextResponse.json({ message: 'Failed to load top selling products' }, { status: 500 });
  }
}
