import Link from 'next/link';
import ReceiptViewButton from '@/components/receipts/ReceiptViewButton';
import { prisma } from '@/lib/prisma';
import './receipts.css';

export const dynamic = 'force-dynamic';

export default async function ReceiptsPage() {
  const receipts = await prisma.receipt.findMany({
    orderBy: { createdAt: 'desc' },
    include: { 
      invoice: {
        include: {
          client: true
        }
      } 
    }
  });

  return (
    <div className="receipts-page">
      <div className="receipts-header">
        <div className="receipts-title-block">
          <h1>Receipts</h1>
          <p className="receipts-subtitle">View your payment history and generated receipts</p>
        </div>
      </div>

      <div className="card receipts-card">
        <div className="table-container">
          <table className="receipts-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Date Paid</th>
                <th>Amount Paid</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No receipts found. Generate one by recording a payment on an invoice.
                  </td>
                </tr>
              ) : (
                receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td className="receipt-number-cell">{receipt.receiptNumber}</td>
                    <td>
                      <Link href={`/invoices/${receipt.invoiceId}`} className="receipt-invoice-link">
                        {receipt.invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td>{receipt.invoice.client.name}</td>
                    <td>{new Date(receipt.issueDate).toLocaleDateString()}</td>
                    <td className="receipt-amount-cell">
                      ${receipt.totalAmount.toFixed(2)}
                    </td>
                    <td>
                      <ReceiptViewButton
                        receiptId={receipt.id}
                        className="receipt-pill-link receipt-pill-link--compact"
                        compact
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
