import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

async function createService(formData: FormData) {
  'use server';

  const name = formData.get('name') as string;
  const category = formData.get('category') as string;
  const description = formData.get('description') as string;
  const price = parseFloat(formData.get('price') as string);
  const isHourly = formData.get('pricingType') === 'hourly';

  await prisma.service.create({
    data: { name, category, description, price, isHourly }
  });

  redirect('/services?ft_toast=service_added');
}

export default function NewServicePage() {
  const categories = [
    'Software Development', 'Graphic Design', 'Brand Design & Development',
    'Logo Design', 'Flyer/Banner Design', 'Motion Design (Video Animation)',
    'Website & Web App Development', 'UI/UX Design', 'Mobile App Design',
    'Systems Design', 'IT Services', 'Event Planning', 'Other'
  ];

  return (
    <div>
      <div className="mb-8">
        <h1>Add New Service</h1>
        <p>Define a new service or product for your business</p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <form action={createService}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">Service Name *</label>
            <input type="text" id="name" name="name" className="form-input" required />
          </div>

          <div className="form-group">
            <label htmlFor="category" className="form-label">Category *</label>
            <select id="category" name="category" className="form-input" required>
              <option value="">Select a category...</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">Description</label>
            <textarea id="description" name="description" className="form-input" rows={3} placeholder="Briefly describe what this service entails..."></textarea>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="price" className="form-label">Rate / Price ($) *</label>
              <input type="number" id="price" name="price" step="0.01" min="0" className="form-input" required />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="pricingType" className="form-label">Pricing Type</label>
              <select id="pricingType" name="pricingType" className="form-input">
                <option value="fixed">Fixed Price</option>
                <option value="hourly">Hourly Rate</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between mt-8">
            <a href="/services" className="btn btn-outline" style={{ textDecoration: 'none' }}>Cancel</a>
            <button type="submit" className="btn btn-primary">Save Service</button>
          </div>
        </form>
      </div>
    </div>
  );
}
