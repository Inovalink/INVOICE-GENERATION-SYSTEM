import Link from 'next/link';
import { PrismaClient } from '@prisma/client';
import { Edit, Trash2, UserPlus } from 'lucide-react';
import './clients.css';

const prisma = new PrismaClient();

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="clients-page">
      <div className="clients-header">
        <div className="clients-title-block">
          <h1>Clients</h1>
          <p className="clients-subtitle">Manage your business clients</p>
        </div>
        <Link href="/clients/new" className="btn btn-primary clients-add-btn">
          <UserPlus size={15} /> Add Client
        </Link>
      </div>

      <div className="card clients-card">
        <div className="table-container">
          <table className="clients-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No clients found. Add your first client to get started.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id}>
                    <td className="client-name-cell">{client.name}</td>
                    <td>{client.company || '-'}</td>
                    <td>{client.email || '-'}</td>
                    <td>{client.phone || '-'}</td>
                    <td className="client-actions-cell">
                      <Link href={`/clients/${client.id}/edit`} className="client-action-link" title="Edit">
                        <Edit size={15} />
                      </Link>
                      <button className="client-action-delete" title="Delete">
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
