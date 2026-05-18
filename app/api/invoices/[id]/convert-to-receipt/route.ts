import { NextResponse } from 'next/server';
import { RECEIPT_DEFAULT_NOTE } from '@/lib/receiptDefaultNotes';
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

    // Fetch the invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, ...invoiceTenantWhere(scope) },
      include: { receipt: true }
    });

    if (!invoice) {
      return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.receipt) {
      return NextResponse.redirect(
        new URL(`/receipts/${invoice.receipt.id}?ft_toast=receipt_generated`, request.url),
        303,
      );
    }

    // Must be PAID (or PARTIALLY_PAID depending on business logic, but typically PAID goes to receipt)
    // Even if not PAID, we can allow conversion. Let's allow it but warn if not FULLY PAID? 
    // Wait, the user wants to convert to receipt manually. Let's just create it based on current invoice total.

    // Generate Receipt Number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.receipt.count({ where: { invoice: invoiceTenantWhere(scope) } });
    const receiptNumber = `REC-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

    const defaultUserId = ctx.user.id;

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        invoiceId: invoice.id,
        userId: defaultUserId,
        totalAmount: invoice.total,
        notes: RECEIPT_DEFAULT_NOTE,
      }
    });

    // Optionally update invoice status if needed, but 'convert to receipt' implies they've paid it.
    if (invoice.status !== 'PAID') {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID' }
      });
      // Also might want to record a payment here if they are converting manually without the Record Payment button.
      // But standard way is to create a dummy payment to ensure consistency
      await prisma.payment.create({
          data: {
              invoiceId,
              amount: invoice.total,
              paymentMethod: 'OTHER',
              notes: 'Auto-generated payment on receipt conversion'
          }
      });
    }
    await indexInvoiceById(invoiceId);

    return NextResponse.redirect(
      new URL(`/receipts/${receipt.id}?ft_toast=receipt_generated`, request.url),
      303,
    );
  } catch (error) {
    console.error('Failed to convert to receipt:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
