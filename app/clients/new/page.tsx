import { redirect } from 'next/navigation';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createClient(formData: FormData) {
  'use server';

  const name = formData.get('name') as string;
  const company = formData.get('company') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const address = formData.get('address') as string;

  await prisma.client.create({
    data: { name, company, email, phone, address }
  });

  redirect('/clients?ft_toast=client_added');
}

export default function NewClientPage() {
  return (
    <div>
      <div className="mb-8">
        <h1>Add New Client</h1>
        <p>Create a new client profile</p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <form action={createClient}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">Client Name *</label>
            <input type="text" id="name" name="name" className="form-input" required />
          </div>

          <div className="form-group">
            <label htmlFor="company" className="form-label">Company Name</label>
            <input type="text" id="company" name="company" className="form-input" />
          </div>

          <div className="flex gap-4 mb-4">
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="email" className="form-label">Email Address</label>
              <input type="email" id="email" name="email" className="form-input" />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="phone" className="form-label">Phone Number</label>
              <input type="tel" id="phone" name="phone" className="form-input" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address" className="form-label">Billing Address</label>
            <textarea id="address" name="address" className="form-input" rows={3}></textarea>
          </div>

          <div className="flex justify-between mt-8">
            <a href="/clients" className="btn btn-outline" style={{ textDecoration: 'none' }}>Cancel</a>
            <button type="submit" className="btn btn-primary">Save Client</button>
          </div>
        </form>
      </div>
    </div>
  );
}
