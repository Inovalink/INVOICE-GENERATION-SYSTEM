import Link from 'next/link';
import CreateInvoice from '@/components/invoices/CreateInvoice';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, company: true, email: true, phone: true, address: true },
  });

  const services = await prisma.service.findMany({
    select: { id: true, name: true, price: true, category: true },
  });

  return (
    <div className="invoice-create-page-wrap">
      <div className="flex items-center justify-between mb-4" style={{ fontSize: '0.8rem' }}>
        <Link href="/invoices" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
          &larr; Back to home
        </Link>
      </div>
      <CreateInvoice clients={clients} services={services} />
    </div>
  );
}
