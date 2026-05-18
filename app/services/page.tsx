import Link from 'next/link';
import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentContext, scopeFromContext, serviceTenantWhere } from '@/lib/auth/tenantScope';
import { Edit, Trash2, PlusCircle } from 'lucide-react';
import './services.css';


export default async function ServicesPage() {
  await connection();
  const context = await requireCurrentContext();
  const scope = scopeFromContext(context);

  const services = await prisma.service.findMany({
    where: serviceTenantWhere(scope),
    orderBy: { category: 'asc' }
  });

  return (
    <div className="services-page">
      <div className="services-header">
        <div className="services-title-block">
          <h1>Service Catalog</h1>
          <p className="services-subtitle">Manage the services and products you offer</p>
        </div>
        <Link href="/services/new" className="btn btn-primary services-add-btn">
          <PlusCircle size={15} /> Add Service
        </Link>
      </div>

      <div className="card services-card">
        <div className="table-container">
          <table className="services-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Category</th>
                <th>Description</th>
                <th>Pricing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No services found. Add your first service to get started.
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.id}>
                    <td className="service-name-cell">{service.name}</td>
                    <td>
                      <span className="service-category-badge">
                        {service.category}
                      </span>
                    </td>
                    <td className="service-description-cell">
                      {service.description ? (service.description.length > 50 ? `${service.description.substring(0, 50)}...` : service.description) : '-'}
                    </td>
                    <td className="service-price-cell">
                      ${service.price.toFixed(2)} {service.isHourly ? '/ hr' : '(Fixed)'}
                    </td>
                    <td className="service-actions-cell">
                      <Link href={`/services/${service.id}/edit`} className="service-action-link" title="Edit">
                        <Edit size={15} />
                      </Link>
                      <button className="service-action-delete" title="Delete">
                        <Trash2 size={15} />
                      </button>
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
