import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { indexInvoiceById } from '@/lib/search/invoiceSearch';

const prisma = new PrismaClient();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;

    // Check if invoice exists and is PROFORMA
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
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
