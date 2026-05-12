import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchSuggestions } from '@/lib/search/globalSearch';
import { getTemporalSuggestions } from '@/lib/search/temporalSuggestions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const limitRaw = parseInt(searchParams.get('limit') ?? '10', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 10;

  try {
    const temporal = getTemporalSuggestions(q, new Date());
    const entity = q.trim().length >= 1 ? await searchSuggestions(prisma, q, limit) : [];
    // Temporal results lead; deduplicate ids just in case
    const seen = new Set(temporal.map(s => s.id));
    const merged = [...temporal, ...entity.filter(s => !seen.has(s.id))].slice(0, limit + 6);
    return NextResponse.json({ suggestions: merged });
  } catch (e) {
    console.error('search suggest', e);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
