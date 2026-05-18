import { NextResponse } from 'next/server';
import { getCurrentContext } from '@/lib/auth/getCurrentUser';
import { invoiceTenantWhere, scopeFromContext } from '@/lib/auth/tenantScope';
import { indexInvoiceById } from '@/lib/search/invoiceSearch';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;
    const ctx = await getCurrentContext();
    if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const scope = scopeFromContext(ctx);

    // Check if invoice exists and is PROFORMA
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, ...invoiceTenantWhere(scope) }
    });

    if (!invoice) {
        return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status !== 'PROFORMA') {
        return NextResponse.json({ message: 'Only Proforma invoices can be converted' }, { status: 400 });
    }

    // Convert to Final
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'FINAL'
      }
    });
    await indexInvoiceById(updatedInvoice.id);

    // In Next.js App Router, we usually redirect back to the invoice page or return success to a client component.
    // Since we used a simple HTML form action in the Server Component page, returning redirect response is best.
    return NextResponse.redirect(
      new URL(`/invoices/${invoiceId}?ft_toast=invoice_finalized`, request.url),
      303,
    );
  } catch (error) {
    console.error('Failed to convert invoice:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
