import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create branches
  const branch = await prisma.tblbranches.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      branchName: 'Main Branch',
      branchAddress: '123 Main St, City',
    },
  });

  // Create roles
  const adminRole = await prisma.tblrbac.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      roleName: 'ADMIN',
      roleMenus: '["dashboard","customers","vehicles","job-orders","inventory","sales","finance","reports","user-management"]',
      rolePermission: '{"read":true,"write":true,"delete":true}',
      created_by: 1,
    },
  });

  const serviceAdvisorRole = await prisma.tblrbac.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      roleName: 'SERVICE_ADVISOR',
      roleMenus: '["dashboard","customers","vehicles","job-orders","sales","reports"]',
      rolePermission: '{"read":true,"write":true}',
      created_by: 1,
    },
  });

  const technicianRole = await prisma.tblrbac.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      roleName: 'TECHNICIAN',
      roleMenus: '["dashboard","job-orders","inventory"]',
      rolePermission: '{"read":true,"write":false}',
      created_by: 1,
    },
  });

  const cashierRole = await prisma.tblrbac.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      roleName: 'CASHIER',
      roleMenus: '["dashboard","sales","billing","reports"]',
      rolePermission: '{"read":true,"write":true}',
      created_by: 1,
    },
  });

  // Create admin user
  await prisma.tblusers.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: 'd033e22ae348aeb5660fc2140aec35850c4da997', // SHA1 hash of 'admin'
      fullname: 'System Administrator',
      email: 'admin@cardoctor.local',
      status: 1,
      roleId: adminRole.id,
      branchId: branch.id,
    },
  });

  // Create supplier
  const supplier = await prisma.tblsuppliers.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'AutoParts Pro Supply',
      contactInfo: '0917-000-0000',
      paymentTerms: '30 days',
    },
  });

  // Create customer
  const customer = await prisma.tblcustomers.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Juan Dela Cruz',
      contact: '0917-111-1111',
      address: '456 Customer St, City',
      email: 'juan.delacruz@email.com',
    },
  });

  // Create technician
  const technician = await prisma.tbltechnicians.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Mark Santos',
      contactInfo: '0917-222-2222',
      performanceMetrics: '{"completedJobs":120,"avgTurnaroundHours":6}',
    },
  });

  // Create vehicle with new fields
  const vehicle = await prisma.tblvehicles.upsert({
    where: { plateNumber: 'ABC-1234' },
    update: {},
    create: {
      customerId: customer.id,
      plateNumber: 'ABC-1234',
      make: 'Toyota',
      model: 'Vios',
      engineInfo: '1.3L Gasoline',
      chassisInfo: 'CHASSIS-001',
      engineType: 'Gasoline',
      odometerReading: 50000,
      fuelType: 'Gasoline',
      warrantyStatus: 'Active',
      previousServiceDocs: 'Last service: 40K km maintenance',
    },
  });

  // Create milestone for vehicle
  await prisma.tblmilestones.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      vehicleId: vehicle.id,
      milestone: '10K ODO',
      tasks: '["Oil change","Filter replacement","Tire rotation","Brake inspection"]',
    },
  });

  // Create inventory
  const inventory = await prisma.tblinventory.upsert({
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

  // Create job order with new fields
  const jobOrder = await prisma.tbljoborders.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      vehicleId: vehicle.id,
      technicianId: technician.id,
      description: 'Preventive maintenance and brake check',
      status: 'IN_PROGRESS',
      billingPrice: 3500,
    },
  });

  // Add supplies to job order
  await prisma.tbljoborder_supplies.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      jobOrderId: jobOrder.id,
      supplyType: 'inventory',
      inventoryId: inventory.id,
      description: 'Brake Pad Set',
      quantity: 1,
      billingPrice: 3500,
    },
  });

  // Create invoice
  const invoice = await prisma.tblinvoices.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      customerId: customer.id,
      jobOrderId: jobOrder.id,
      totalAmount: 3500,
      status: 'UNPAID',
      type: 'initial_billing',
    },
  });

  // Create sale
  await prisma.tblsales.upsert({
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

  // Create accounts receivable
  await prisma.tblaccounts_receivable.upsert({
    where: { invoiceId: invoice.id },
    update: {},
    create: {
      customerId: customer.id,
      invoiceId: invoice.id,
      balance: 3500,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Create purchase
  const purchase = await prisma.tblpurchases.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      supplierId: supplier.id,
      amount: 12000,
    },
  });

  // Create accounts payable
  await prisma.tblaccounts_payable.upsert({
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

  // Create expense
  await prisma.tblexpenses.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      category: 'Utilities',
      description: 'Electricity bill',
      amount: 4200,
    },
  });

  console.log('Database seeded successfully!');
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
