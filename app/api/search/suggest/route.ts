import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchSuggestions } from '@/lib/search/globalSearch';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const limitRaw = parseInt(searchParams.get('limit') ?? '10', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 10;

  try {
    const suggestions = await searchSuggestions(prisma, q, limit);
    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error('search suggest', e);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
