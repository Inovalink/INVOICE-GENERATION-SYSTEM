import { NextResponse } from 'next/server';
import { PrismaClient, PaymentMethod } from '@prisma/client';
import { RECEIPT_DEFAULT_NOTE } from '@/lib/receiptDefaultNotes';
import { getDefaultUserId } from '@/lib/auth/getCurrentUser';
import { indexInvoiceById } from '@/lib/search/invoiceSearch';

const prisma = new PrismaClient();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;
    const body = await request.formData();
    const paymentKindRaw = (body.get('paymentKind') as string) || 'full';
    const paymentKind = paymentKindRaw === 'partial' ? 'partial' : 'full';
    const amountRaw = body.get('amount') as string;
    const amount = parseFloat(amountRaw);
    const paymentMethod = body.get('paymentMethod') as PaymentMethod;
    const nextDueDateRaw = (body.get('nextDueDate') as string) || '';
    const paymentProviderRaw = (body.get('paymentProvider') as string) || '';
    const transactionRef = ((body.get('transactionRef') as string) || '').trim();
    const bankName = ((body.get('bankName') as string) || '').trim();
    const accountNumber = ((body.get('accountNumber') as string) || '').trim();
    const accountName = ((body.get('accountName') as string) || '').trim();

    if (!paymentMethod) {
      return NextResponse.json({ message: 'Invalid payment data' }, { status: 400 });
    }

    const isMobileMoney = paymentMethod === 'MOBILE_MONEY';
    const isBankTransfer = paymentMethod === 'BANK_TRANSFER';

    if (
      isMobileMoney &&
      paymentProviderRaw !== 'MTN_MOMO' &&
      paymentProviderRaw !== 'TELECEL_CASH'
    ) {
      return NextResponse.json({ message: 'Invalid mobile money provider.' }, { status: 400 });
    }

    if (isMobileMoney && !transactionRef) {
      return NextResponse.json(
        { message: 'Reference number is required for mobile money.' },
        { status: 400 },
      );
    }

    if (isBankTransfer && (!bankName || !accountNumber || !accountName)) {
      return NextResponse.json(
        { message: 'Bank name, account number and account name are required for bank transfer.' },
        { status: 400 },
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice || (invoice.status !== 'FINAL' && invoice.status !== 'PARTIALLY_PAID')) {
      return NextResponse.json({ message: 'Cannot process payment for this invoice' }, { status: 400 });
    }

    const safeTotal = Number.isFinite(Number(invoice.total)) ? Number(invoice.total) : 0;
    const safeDeposit = Number.isFinite(Number(invoice.depositAmount))
      ? Number(invoice.depositAmount)
      : 0;
    const safeDue = Number.isFinite(Number(invoice.amountDue))
      ? Number(invoice.amountDue)
      : Math.max(0, safeTotal - safeDeposit);

    const outstandingDue = safeDue > 0 ? safeDue : Math.max(0, safeTotal - safeDeposit);
    const paymentAmount = paymentKind === 'full' ? outstandingDue : amount;
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ message: 'Invalid payment amount' }, { status: 400 });
    }

    if (paymentKind === 'partial' && paymentAmount <= outstandingDue && !nextDueDateRaw) {
      return NextResponse.json(
        { message: 'A new deadline is required for partial payment.' },
        { status: 400 },
      );
    }

    const nextDeposit = safeDeposit + paymentAmount;
    const nextDue = safeTotal - nextDeposit;
    const nextPaymentStatus = nextDue <= 0 ? 'paid' : 'partial';
    const nextInvoiceStatus = nextDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    const parsedNextDueDate =
      paymentKind === 'partial' && nextDueDateRaw ? new Date(nextDueDateRaw) : null;

    if (
      paymentKind === 'partial' &&
      nextDue > 0 &&
      (!parsedNextDueDate || Number.isNaN(parsedNextDueDate.getTime()))
    ) {
      return NextResponse.json({ message: 'Invalid deadline date.' }, { status: 400 });
    }

    // 1. Create Payment Record
    const paymentNotes =
      paymentMethod === 'CASH'
        ? nextDue <= 0
          ? 'Full cash payment received'
          : 'Partial cash payment received'
        : paymentMethod === 'MOBILE_MONEY'
          ? `${paymentProviderRaw === 'MTN_MOMO' ? 'MTN Momo' : 'Telecel Cash'} payment`
          : `Bank transfer (${bankName}, ${accountName}, ${accountNumber})`;

    await prisma.payment.create({
      data: {
        invoiceId,
        amount: paymentAmount,
        paymentMethod,
        transactionRef: isMobileMoney ? transactionRef : null,
        notes: paymentNotes,
      },
    });

    // 2. Update invoice payment tracking values
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: nextInvoiceStatus,
        depositAmount: nextDeposit,
        amountDue: nextDue,
        paymentStatus: nextPaymentStatus,
        dueDate:
          paymentKind === 'partial' && nextDue > 0 && parsedNextDueDate
            ? parsedNextDueDate
            : invoice.dueDate,
      },
    });
    await indexInvoiceById(invoiceId);

    // For partial payments, go back to invoices list.
    if (nextDue > 0) {
      const partialUrl = new URL('/invoices', request.url);
      partialUrl.searchParams.set('ft_toast', 'partial_payment');
      partialUrl.searchParams.set('invoiceId', invoiceId);
      return NextResponse.redirect(partialUrl, 303);
    }

    // 3. Generate or update receipt for fully paid invoice
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.receipt.count();
    const receiptNumber = `REC-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

    const defaultUserId = await getDefaultUserId();
    if (!defaultUserId) throw new Error('User required');

    const existingReceipt = await prisma.receipt.findUnique({
      where: { invoiceId: invoice.id },
    });

    const receipt =
      existingReceipt ??
      (await prisma.receipt.create({
        data: {
          receiptNumber,
          invoiceId: invoice.id,
          userId: defaultUserId,
          totalAmount: nextDeposit,
          notes: RECEIPT_DEFAULT_NOTE,
        },
      }));

    if (existingReceipt) {
      await prisma.receipt.update({
        where: { id: existingReceipt.id },
        data: { totalAmount: nextDeposit },
      });
    }
    await indexInvoiceById(invoiceId);

    // Return to invoice list and auto-open receipt modal there.
    const receiptUrl = new URL('/invoices', request.url);
    receiptUrl.searchParams.set('ft_toast', 'receipt_from_payment');
    receiptUrl.searchParams.set('invoiceId', invoice.id);
    receiptUrl.searchParams.set('paymentAmount', String(paymentAmount));
    receiptUrl.searchParams.set('receiptId', receipt.id);
    return NextResponse.redirect(receiptUrl, 303);
  } catch (error) {
    console.error('Failed to process payment:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
