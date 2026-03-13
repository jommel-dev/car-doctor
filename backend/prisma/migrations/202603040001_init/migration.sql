CREATE TYPE "Role" AS ENUM ('ADMIN', 'SERVICE_ADVISOR', 'TECHNICIAN', 'CASHIER');

CREATE TABLE "customers" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "contact_info" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "vehicles" (
  "id" SERIAL PRIMARY KEY,
  "customer_id" INTEGER NOT NULL,
  "plate_number" TEXT NOT NULL UNIQUE,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "engine_info" TEXT,
  "chassis_info" TEXT,
  CONSTRAINT "vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "technicians" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "contact_info" TEXT,
  "performance_metrics" JSONB
);

CREATE TABLE "job_orders" (
  "id" SERIAL PRIMARY KEY,
  "vehicle_id" INTEGER NOT NULL,
  "technician_id" INTEGER,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "job_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_orders_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "service_history" (
  "id" SERIAL PRIMARY KEY,
  "vehicle_id" INTEGER NOT NULL,
  "job_order_id" INTEGER NOT NULL,
  "parts_replaced" TEXT,
  "notes" TEXT,
  "service_date" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_history_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "service_history_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "suppliers" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "contact_info" TEXT,
  "payment_terms" TEXT
);

CREATE TABLE "inventory" (
  "id" SERIAL PRIMARY KEY,
  "part_name" TEXT NOT NULL,
  "stock_qty" INTEGER NOT NULL DEFAULT 0,
  "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
  "supplier_id" INTEGER,
  CONSTRAINT "inventory_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "purchases" (
  "id" SERIAL PRIMARY KEY,
  "supplier_id" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "invoices" (
  "id" SERIAL PRIMARY KEY,
  "customer_id" INTEGER NOT NULL,
  "job_order_id" INTEGER,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNPAID',
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3),
  CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "invoices_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "sales" (
  "id" SERIAL PRIMARY KEY,
  "job_order_id" INTEGER,
  "inventory_id" INTEGER,
  "invoice_id" INTEGER,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "sales_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "sales_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "accounts_receivable" (
  "id" SERIAL PRIMARY KEY,
  "customer_id" INTEGER NOT NULL,
  "invoice_id" INTEGER NOT NULL UNIQUE,
  "balance" DECIMAL(12,2) NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounts_receivable_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "accounts_receivable_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "expenses" (
  "id" SERIAL PRIMARY KEY,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "accounts_payable" (
  "id" SERIAL PRIMARY KEY,
  "supplier_id" INTEGER NOT NULL,
  "purchase_id" INTEGER NOT NULL,
  "balance" DECIMAL(12,2) NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounts_payable_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "accounts_payable_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
