import { NextResponse } from 'next/server';
import { getCurrentContext } from '@/lib/auth/getCurrentUser';
import { indexInvoiceById } from '@/lib/search/invoiceSearch';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    const ctx = await getCurrentContext();
    const defaultUser = ctx?.user ?? (await prisma.user.findFirst());
    if (!defaultUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const invoices = await prisma.invoice.findMany({
      where: {
        userId: defaultUser.id,
        ...(clientId ? { clientId } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        dueDate: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(
      invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        total: inv.total,
        dueDate: inv.dueDate?.toISOString() ?? null,
        clientName: inv.client.name,
      })),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Failed to load invoices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      clientId,
      items,
      issueDate,
      dueDate,
      status,
      subtotal,
      tax,
      discount,
      total,
      totalAmount,
      depositAmount,
      amountDue,
      paymentStatus,
      notes,
      paymentTerms,
      expectedDeliveryDate,
    } = body;

    // Validate request
    if (!clientId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'Invalid invoice data' }, { status: 400 });
    }

    // Generate Invoice Number (e.g., INV-YYYYMMDD-XXXX)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

    const ctx = await getCurrentContext();
    const defaultUser = ctx?.user ?? (await prisma.user.findFirst());
    if (!defaultUser) {
      return NextResponse.json(
        { message: 'Sign in or create an account to create invoices.' },
        { status: 401 },
      );
    }
    const workspaceId = ctx?.workspace?.id ?? null;

    const allowedStatuses = ['PROFORMA', 'FINAL', 'PAID', 'PARTIALLY_PAID', 'CANCELLED'];
    const resolvedStatus = allowedStatuses.includes(status) ? status : 'PROFORMA';
    const allowedPaymentStatuses = ['pending', 'partial', 'paid'];
    const resolvedPaymentStatus = allowedPaymentStatuses.includes(paymentStatus)
      ? paymentStatus
      : 'pending';
    const resolvedTotalAmount = typeof totalAmount === 'number' ? totalAmount : total;
    const resolvedDepositAmount = typeof depositAmount === 'number' ? depositAmount : 0;
    const resolvedAmountDue = typeof amountDue === 'number' ? amountDue : total;

    const resolvedExpectedDelivery =
      typeof expectedDeliveryDate === 'string' && expectedDeliveryDate.trim()
        ? new Date(expectedDeliveryDate)
        : null;
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId,
        userId: defaultUser.id,
        workspaceId,
        status: resolvedStatus,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        expectedDeliveryDate:
          resolvedExpectedDelivery && !Number.isNaN(resolvedExpectedDelivery.getTime())
            ? resolvedExpectedDelivery
            : null,
        subtotal,
        tax,
        discount,
        total,
        notes,
        paymentTerms,
        items: {
          create: items.map((item: { serviceId?: string; description: string; quantity: number; unitPrice: number }) => ({
            serviceId: item.serviceId || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice
          }))
        }
      },
      include: {
        items: true
      }
    });

    // Keep deposit and amount-due tracking persisted even when Prisma Client is older than schema.
    await prisma.$executeRaw`
      UPDATE "Invoice"
      SET
        "totalAmount" = ${resolvedTotalAmount},
        "depositAmount" = ${resolvedDepositAmount},
        "amountDue" = ${resolvedAmountDue},
        "paymentStatus" = ${resolvedPaymentStatus}
      WHERE "id" = ${invoice.id}
    `;

    await indexInvoiceById(invoice.id);

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Failed to create invoice:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
