import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const supplier = await prisma.supplier.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'AutoParts Pro Supply',
      contactInfo: '0917-000-0000',
      paymentTerms: '30 days',
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Juan Dela Cruz',
      contactInfo: '0917-111-1111',
    },
  });

  const technician = await prisma.technician.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Mark Santos',
      contactInfo: '0917-222-2222',
      performanceMetrics: { completedJobs: 120, avgTurnaroundHours: 6 },
    },
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { plateNumber: 'ABC-1234' },
    update: {},
    create: {
      customerId: customer.id,
      plateNumber: 'ABC-1234',
      make: 'Toyota',
      model: 'Vios',
      engineInfo: '1.3L Gasoline',
      chassisInfo: 'CHASSIS-001',
    },
  });

  const inventory = await prisma.inventory.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      partName: 'Brake Pad Set',
      stockQty: 25,
      lowStockThreshold: 10,
      supplierId: supplier.id,
    },
  });

  const jobOrder = await prisma.jobOrder.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      vehicleId: vehicle.id,
      technicianId: technician.id,
      description: 'Preventive maintenance and brake check',
      status: 'IN_PROGRESS',
    },
  });

  const invoice = await prisma.invoice.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      customerId: customer.id,
      jobOrderId: jobOrder.id,
      totalAmount: 3500,
      status: 'UNPAID',
    },
  });

  await prisma.sale.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      jobOrderId: jobOrder.id,
      inventoryId: inventory.id,
      invoiceId: invoice.id,
      amount: 3500,
    },
  });

  await prisma.accountReceivable.upsert({
    where: { invoiceId: invoice.id },
    update: {},
    create: {
      customerId: customer.id,
      invoiceId: invoice.id,
      balance: 3500,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const purchase = await prisma.purchase.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      supplierId: supplier.id,
      amount: 12000,
    },
  });

  await prisma.accountPayable.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      supplierId: supplier.id,
      purchaseId: purchase.id,
      balance: 12000,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.expense.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      category: 'Utilities',
      description: 'Electricity bill',
      amount: 4200,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@cardoctor.local' },
    update: {},
    create: {
      email: 'admin@cardoctor.local',
      passwordHash: 'supabase-managed',
      role: Role.ADMIN,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
