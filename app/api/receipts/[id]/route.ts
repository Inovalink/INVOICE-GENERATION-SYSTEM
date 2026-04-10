import { NextResponse } from 'next/server';
import { RECEIPT_DEFAULT_NOTE } from '@/lib/receiptDefaultNotes';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        invoice: {
          include: {
            client: true,
            items: true,
            payments: { orderBy: { paymentDate: 'desc' } },
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ message: 'Receipt not found' }, { status: 404 });
    }

    const inv = receipt.invoice;

    return NextResponse.json({
      receipt: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        issueDate: receipt.issueDate.toISOString(),
        totalAmount: receipt.totalAmount,
        notes: RECEIPT_DEFAULT_NOTE,
      },
      issuer: {
        name: receipt.user.name,
        email: receipt.user.email,
      },
      invoice: {
        invoiceNumber: inv.invoiceNumber,
        subtotal: inv.subtotal,
        tax: inv.tax,
        discount: inv.discount,
        total: inv.total,
        amountDue: inv.amountDue,
        client: {
          name: inv.client.name,
          company: inv.client.company,
          email: inv.client.email,
          address: inv.client.address,
        },
        items: inv.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
      },
      payments: inv.payments.map((p) => ({
        paymentMethod: p.paymentMethod,
        transactionRef: p.transactionRef,
        notes: p.notes,
      })),
    });
  } catch {
    return NextResponse.json({ message: 'Failed to load receipt' }, { status: 500 });
  }
}
