import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPaymentMethodTitle } from '@/lib/paymentDisplay';
import { RECEIPT_DEFAULT_NOTE } from '@/lib/receiptDefaultNotes';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ReceiptViewPage({ params }: { params: { id: string } }) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: {
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
    notFound();
  }

  // Find the specific payment (Assuming 1 complete payment for simplicity, or sum them)
  const payments = receipt.invoice.payments;
  const paymentMethodLabel =
    payments.length > 0
      ? getPaymentMethodTitle({
          paymentMethod: payments[0].paymentMethod,
          notes: payments[0].notes,
        })
      : 'Unknown';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/receipts" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
            ← Back to Receipts
          </Link>
          <h1 className="mt-4">Receipt {receipt.receiptNumber}</h1>
          <p>For Invoice {receipt.invoice.invoiceNumber}</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-outline" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem', position: 'relative', overflow: 'hidden' }}>
        
        {/* Paid Stamp Watermark */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-30deg)',
          fontSize: '8rem',
          fontWeight: 'bold',
          color: 'rgba(16, 185, 129, 0.05)', // Very faint green
          zIndex: 0,
          pointerEvents: 'none'
        }}>
          PAID
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex justify-between mb-8" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '2rem' }}>
            <div>
              <h2 style={{ color: 'var(--success)', marginBottom: '1rem', fontSize: '2.5rem' }}>RECEIPT</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}><strong>Date:</strong> {new Date(receipt.issueDate).toLocaleDateString()}</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}><strong>Receipt No:</strong> {receipt.receiptNumber}</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}><strong>Payment Method:</strong> {paymentMethodLabel}</p>
            </div>
            <div className="text-right">
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>FinTrack Inc.</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>123 Business Road</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Tech City, TX 75001</p>
            </div>
          </div>

          <div className="flex justify-between mb-8">
            <div>
              <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Received From:</h4>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{receipt.invoice.client.name}</p>
              {receipt.invoice.client.company && <p style={{ margin: 0 }}>{receipt.invoice.client.company}</p>}
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{receipt.invoice.client.email}</p>
            </div>
            
            <div style={{ textAlign: 'right', backgroundColor: 'var(--bg-primary)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Amount Received</p>
              <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                ${receipt.totalAmount.toFixed(2)}
              </p>
            </div>
          </div>

          <h4 style={{ marginBottom: '1rem' }}>Payment For:</h4>
          <table style={{ marginBottom: '2rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 0' }}>Description</th>
                <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipt.invoice.items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 0' }}>{item.description}</td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>${item.subtotal.toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '1rem 0', fontWeight: 'bold', textAlign: 'right' }}>Total Invoice Amount:</td>
                <td style={{ padding: '1rem 0', fontWeight: 'bold', textAlign: 'right' }}>${receipt.invoice.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              marginTop: '2rem',
              padding: '1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              borderRadius: 'var(--radius-md)',
              color: '#94a3b8',
            }}
          >
            <p style={{ margin: 0, textAlign: 'center', fontWeight: '400', whiteSpace: 'pre-line' }}>
              {RECEIPT_DEFAULT_NOTE}
            </p>
          </div>
        </div>
      </div>

{/* 
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .card, .card *, .card::before {
            visibility: visible;
          }
          .card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
            padding: 0;
          }
          .btn {
            display: none !important;
          }
        }
      `}} /> */}
    </div>
  );
}
