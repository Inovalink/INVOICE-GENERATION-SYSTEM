import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, CheckCircle, FileText } from 'lucide-react';
import PrintButton from '@/components/invoices/PrintButton';
import ReceiptViewButton from '@/components/receipts/ReceiptViewButton';
import { invoiceDisplayStatus } from '@/lib/invoiceDue';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function InvoiceViewPage({ params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      receipt: true,
      items: {
        include: {
          service: true
        }
      }
    }
  });

  if (!invoice) {
    notFound();
  }

  // Find the specific payment (Assuming 1 complete payment for simplicity, or sum them)
  const payments = await prisma.payment.findMany({ where: { invoiceId: invoice.id } });
  const paymentMethod = payments.length > 0 ? payments[0].paymentMethod : 'Unknown';

  const displayStatus = invoiceDisplayStatus({
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    dueDate: invoice.dueDate,
    amountDue: invoice.amountDue,
  });

  const statusBadgeClass: Record<string, string> = {
    OVERDUE: 'invoice-status-overdue',
    PAID: 'invoice-status-paid',
    PROFORMA: 'invoice-status-proforma',
    PARTIALLY_PAID: 'invoice-status-partial',
    FINAL: 'invoice-status-pending',
    CANCELLED: 'invoice-status-cancelled',
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-8" style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-4">
          <Link href="/invoices" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> Back
          </Link>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>Invoice {invoice.invoiceNumber}</h1>
          <span
            className={`invoice-status-badge ${statusBadgeClass[displayStatus] ?? 'invoice-status-pending'}`}
          >
            {displayStatus.replace(/_/g, ' ')}
          </span>
        </div>
        
        <div className="flex gap-4 items-center">
          <PrintButton />
          
          {invoice.status === 'PROFORMA' && (
            <form action={`/api/invoices/${invoice.id}/convert`} method="POST" style={{ display: 'inline' }}>
              <button type="submit" className="btn btn-primary flex items-center gap-2">
                Convert to Final
              </button>
            </form>
          )}

          {(invoice.status === 'FINAL' || invoice.status === 'PARTIALLY_PAID') && (
            <form action={`/api/invoices/${invoice.id}/pay`} method="POST" style={{ display: 'inline' }}>
              <input type="hidden" name="paymentKind" value="full" />
              <input type="hidden" name="amount" value={invoice.amountDue} />
              <input type="hidden" name="paymentMethod" value="CASH" />
              <button type="submit" className="btn btn-primary flex items-center gap-2" style={{ backgroundColor: 'var(--success)' }}>
                <CheckCircle size={16} /> Record Full Payment
              </button>
            </form>
          )}

          {!invoice.receipt && invoice.status !== 'PROFORMA' && (
            <form action={`/api/invoices/${invoice.id}/convert-to-receipt`} method="POST" style={{ display: 'inline' }}>
              <button type="submit" className="btn btn-primary flex items-center gap-2" style={{ backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none' }}>
                <FileText size={16} /> Convert to Receipt
              </button>
            </form>
          )}

          {invoice.receipt && (
            <ReceiptViewButton receiptId={invoice.receipt.id} className="receipt-pill-link" />
          )}
        </div>
      </div>

      {/* The Premium Invoice Document */}
      <div className="invoice-document" style={{ 
            backgroundColor: '#ffffff', 
            color: '#1a1a1a', 
            padding: '4rem 5rem', 
            borderRadius: '16px', 
            boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
            minHeight: '800px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            
            {/* PAID watermark if paid */}
            {invoice.status === 'PAID' && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-30deg)',
                    fontSize: '12rem',
                    fontWeight: 900,
                    color: 'rgba(16, 185, 129, 0.05)',
                    zIndex: 0,
                    pointerEvents: 'none'
                }}>
                    PAID
                </div>
            )}

            <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, margin: 0, color: '#1a1a1a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                            Invoice
                        </h1>
                        <p style={{ color: '#666', fontSize: '1.25rem', marginTop: '0.5rem', fontWeight: 500 }}>
                            # {invoice.invoiceNumber}
                        </p>
                    </div>
                    <div>
                        <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#1a1a1a', letterSpacing: '-1px' }}>
                            FinTrack
                        </h2>
                    </div>
                </div>

                <div className="flex justify-between mb-12" style={{ fontSize: '0.95rem' }}>
                    <div>
                        <p style={{ color: '#666', marginBottom: '0.25rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>Project</p>
                        <p style={{ fontWeight: 600, margin: 0, color: '#1a1a1a', fontSize: '1rem' }}>{invoice.notes?.includes('Project:') ? invoice.notes.split('Project:')[1].split('\n')[0].trim() : invoice.items[0]?.description.split(' ')[0] + ' Services' || 'General Services'}</p>
                    </div>
                    <div className="flex gap-10 text-right">
                        <div>
                            <p style={{ color: '#666', marginBottom: '0.25rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Issued Date</p>
                            <p style={{ fontWeight: 600, margin: 0, color: '#1a1a1a', fontSize: '0.9rem' }}>
                                {new Date(invoice.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                        <div>
                            <p style={{ color: '#666', marginBottom: '0.25rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Due Date</p>
                            <p style={{ fontWeight: 600, margin: 0, color: '#1a1a1a', fontSize: '0.9rem' }}>
                                Upon Receipt
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between mb-12" style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
                    <div>
                        <p style={{ color: '#666', marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>From</p>
                        <p style={{ fontWeight: 600, margin: 0, color: '#1a1a1a', fontSize: '1.1rem' }}>FinTrack Demo Inc.</p>
                        <p style={{ margin: 0, color: '#666' }}>123 Business Road</p>
                        <p style={{ margin: 0, color: '#666' }}>Tech City, TX 75001</p>
                        <p style={{ margin: 0, color: '#1a1a1a', marginTop: '0.75rem', fontWeight: 500 }}>billing@fintrack.com</p>
                        <p style={{ margin: 0, color: '#1a1a1a', fontWeight: 500 }}>+1 555 123 4567</p>
                    </div>
                    <div className="text-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                        <p style={{ color: '#666', marginBottom: '0.2rem', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>To</p>
                        <p style={{ fontWeight: 600, margin: 0, color: '#1a1a1a', fontSize: '1rem' }}>{invoice.client.name}</p>
                        {invoice.client.company && <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>{invoice.client.company}</p>}
                        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>{invoice.client.address || 'Address Not Provided'}</p>
                        <p style={{ margin: 0, color: '#1a1a1a', marginTop: '0.4rem', fontWeight: 500, fontSize: '0.9rem' }}>{invoice.client.email}</p>
                        <p style={{ margin: 0, color: '#1a1a1a', fontWeight: 500, fontSize: '0.9rem' }}>{invoice.client.phone || ''}</p>
                    </div>
                </div>

                {/* Table */}
                <div style={{ marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', fontSize: '0.875rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <div style={{ flex: 3 }}>Description</div>
                        <div style={{ flex: 1, textAlign: 'center' }}>Units</div>
                        <div style={{ flex: 1, textAlign: 'right' }}>Price</div>
                        <div style={{ flex: 1.5, textAlign: 'right' }}>Amount</div>
                    </div>

                    {invoice.items.map((item, idx) => (
                        <div key={item.id} style={{ display: 'flex', padding: '1rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.95rem', color: '#1a1a1a', fontWeight: 500 }}>
                            <div style={{ flex: 3 }}>{item.description}</div>
                            <div style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</div>
                            <div style={{ flex: 1, textAlign: 'right' }}>${item.unitPrice.toFixed(2)}</div>
                            <div style={{ flex: 1.5, textAlign: 'right', fontWeight: 600 }}>${(item.quantity * item.unitPrice).toFixed(2)}</div>
                        </div>
                    ))}
                    
                    {/* Totals Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: '1.5rem', paddingRight: '1rem', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', width: '250px', justifyContent: 'space-between', color: '#666' }}>
                            <span>Subtotal</span>
                            <span style={{ color: '#1a1a1a', fontWeight: 600 }}>${invoice.subtotal.toFixed(2)}</span>
                        </div>
                        {invoice.discount > 0 && (
                            <div style={{ display: 'flex', width: '250px', justifyContent: 'space-between', color: '#666' }}>
                                <span>Discount</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>-${invoice.discount.toFixed(2)}</span>
                            </div>
                        )}
                        {invoice.tax > 0 && (
                            <div style={{ display: 'flex', width: '250px', justifyContent: 'space-between', color: '#666' }}>
                                <span>Tax</span>
                                <span style={{ color: '#1a1a1a', fontWeight: 600 }}>${invoice.tax.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center mb-10" style={{ padding: '1.25rem 2rem', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                    <div>
                        <span style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '1.1rem' }}>Grand Total</span>
                        {invoice.status === 'PAID' && <span style={{ display: 'block', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>Payment Received in Full</span>}
                    </div>
                    <span style={{ fontWeight: 800, color: '#1a1a1a', fontSize: '1.75rem' }}>${invoice.total.toFixed(2)}</span>
                </div>

                {invoice.notes && (
                    <div style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '3rem', fontSize: '0.95rem', color: '#444', backgroundColor: '#ffffff' }}>
                        <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#1a1a1a' }}>Note:</strong> 
                        <p style={{ margin: 0, lineHeight: 1.6 }}>{invoice.notes}</p>
                    </div>
                )}

                <div className="flex justify-between items-end mt-16" style={{ fontSize: '0.95rem' }}>
                    <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Details</h4>
                        <p style={{ margin: '0 0 0.25rem 0', color: '#666' }}>{invoice.paymentTerms || 'Standard Terms'}</p>
                        <p style={{ margin: '0 0 0.25rem 0', color: '#666' }}><strong>Account Name :</strong> FinTrack Holdings</p>
                        <p style={{ margin: 0, color: '#666' }}><strong>Account No :</strong> 991188343445123</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ height: '50px', width: '150px', borderBottom: '2px solid #1a1a1a', margin: '0 0 0.75rem auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                            <span style={{ fontStyle: 'italic', fontWeight: 500, fontSize: '2rem', color: '#1a1a1a', transform: 'translateY(10px)' }}>Signature</span>
                        </div>
                        <p style={{ margin: 0, fontWeight: 700, color: '#1a1a1a', fontSize: '1rem' }}>FinTrack Admin</p>
                    </div>
                </div>

            </div>
        </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
            background-color: transparent !important;
          }
          .invoice-document, .invoice-document * {
            visibility: visible;
          }
          .invoice-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            box-shadow: none !important;
          }
          .app-layout .main-content { margin-left: 0; }
          .app-layout .sidebar { display: none; }
          .topbar { display: none; }
        }
      `}} />
    </div>
  );
}
