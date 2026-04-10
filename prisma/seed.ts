import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with mock data...');

  // 1. Create Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@invoicesystem.com' },
    update: {},
    create: {
      name: 'System Admin',
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@invoicesystem.com',
      password: 'hashed_password_placeholder', // In real app, hash this
      accountType: 'SOLO',
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: 'accountant@invoicesystem.com' },
    update: {},
    create: {
      name: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'accountant@invoicesystem.com',
      password: 'hashed_password_placeholder',
      accountType: 'SOLO',
    },
  });

  // 2. Create Clients
  const client1 = await prisma.client.create({
    data: {
      name: 'Alice Smith',
      company: 'TechCorp',
      email: 'alice@techcorp.com',
      phone: '+1234567890',
      address: '123 Tech Lane, Silicon Valley',
    },
  });

  const client2 = await prisma.client.create({
    data: {
      name: 'Bob Johnson',
      company: 'DesignWorks',
      email: 'bob@designworks.com',
      phone: '+9876543210',
      address: '456 Art Ave, New York',
    },
  });

  // 3. Create Services
  const webDev = await prisma.service.create({
    data: {
      name: 'Website & Web App Development',
      category: 'Software Development',
      description: 'Full-stack web application development',
      price: 5000,
      isHourly: false,
    },
  });

  const uiDesign = await prisma.service.create({
    data: {
      name: 'UI/UX Design',
      category: 'Design',
      description: 'User interface and experience design',
      price: 150,
      isHourly: true,
    },
  });

  const graphicDesign = await prisma.service.create({
    data: {
      name: 'Logo Design',
      category: 'Graphic Design',
      description: 'Custom logo design and brand kit',
      price: 800,
      isHourly: false,
    },
  });

  console.log('Database seeded successfully!');
  console.log({ admin, accountant, client1, client2, webDev, uiDesign, graphicDesign });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
