import Link from 'next/link';
import { connection } from 'next/server';
import CreateInvoice from '@/components/invoices/CreateInvoice';
import { prisma } from '@/lib/prisma';
import { clientTenantWhere, requireCurrentContext, scopeFromContext, serviceTenantWhere } from '@/lib/auth/tenantScope';


export default async function NewInvoicePage() {
  await connection();
  const context = await requireCurrentContext();
  const scope = scopeFromContext(context);

  const clients = await prisma.client.findMany({
    where: clientTenantWhere(scope),
    select: { id: true, name: true, company: true, email: true, phone: true, address: true },
  });

  const services = await prisma.service.findMany({
    where: serviceTenantWhere(scope),
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
