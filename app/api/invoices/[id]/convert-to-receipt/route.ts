import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { RECEIPT_DEFAULT_NOTE } from '@/lib/receiptDefaultNotes';
import { getDefaultUserId } from '@/lib/auth/getCurrentUser';
import { indexInvoiceById } from '@/lib/search/invoiceSearch';

const prisma = new PrismaClient();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;

    // Fetch the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { receipt: true }
    });

    if (!invoice) {
      return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.receipt) {
      // Receipt already exists, redirect to it
      return NextResponse.redirect(new URL(`/receipts/${invoice.receipt.id}`, request.url), 303);
    }

    // Must be PAID (or PARTIALLY_PAID depending on business logic, but typically PAID goes to receipt)
    // Even if not PAID, we can allow conversion. Let's allow it but warn if not FULLY PAID? 
    // Wait, the user wants to convert to receipt manually. Let's just create it based on current invoice total.

    // Generate Receipt Number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.receipt.count();
    const receiptNumber = `REC-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

    const defaultUserId = await getDefaultUserId();
    if (!defaultUserId) throw new Error('User required');

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

    // Redirect to the newly created receipt
    return NextResponse.redirect(new URL(`/receipts/${receipt.id}`, request.url), 303);
  } catch (error) {
    console.error('Failed to convert to receipt:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
