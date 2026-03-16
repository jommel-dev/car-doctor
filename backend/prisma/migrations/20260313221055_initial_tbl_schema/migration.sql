-- CreateTable
CREATE TABLE "tblusers" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "fullname" TEXT,
    "birthdate" DATE,
    "address" TEXT,
    "email" TEXT,
    "contact" TEXT,
    "status" SMALLINT,
    "is_deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT DEFAULT 1,
    "roleId" BIGINT,
    "branchId" BIGINT,

    CONSTRAINT "tblusers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblrbac" (
    "id" BIGSERIAL NOT NULL,
    "roleName" TEXT,
    "roleMenus" TEXT,
    "rolePermission" TEXT,
    "created_by" BIGINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tblrbac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblbranches" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchName" TEXT,
    "branchAddress" TEXT,

    CONSTRAINT "tblbranches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblcustomers" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "address" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tblcustomers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblvehicles" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "engine_info" TEXT,
    "chassis_info" TEXT,
    "engineType" TEXT,
    "odometer_reading" INTEGER,
    "fuel_type" TEXT,
    "warranty_status" TEXT,
    "previous_service_docs" TEXT,

    CONSTRAINT "tblvehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblmilestones" (
    "id" BIGSERIAL NOT NULL,
    "vehicle_id" BIGINT NOT NULL,
    "milestone" TEXT NOT NULL,
    "tasks" TEXT NOT NULL,

    CONSTRAINT "tblmilestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbltechnicians" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact_info" TEXT,
    "performance_metrics" TEXT,

    CONSTRAINT "tbltechnicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbljoborders" (
    "id" BIGSERIAL NOT NULL,
    "vehicle_id" BIGINT NOT NULL,
    "technician_id" BIGINT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "customer_review" TEXT,
    "billing_price" DECIMAL(12,2),

    CONSTRAINT "tbljoborders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbljoborder_supplies" (
    "id" BIGSERIAL NOT NULL,
    "job_order_id" BIGINT NOT NULL,
    "supplyType" TEXT NOT NULL,
    "inventory_id" BIGINT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "cost_price" DECIMAL(12,2),
    "billing_price" DECIMAL(12,2),

    CONSTRAINT "tbljoborder_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblservice_history" (
    "id" BIGSERIAL NOT NULL,
    "vehicle_id" BIGINT NOT NULL,
    "job_order_id" BIGINT NOT NULL,
    "parts_replaced" TEXT,
    "notes" TEXT,
    "service_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tblservice_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblsuppliers" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact_info" TEXT,
    "payment_terms" TEXT,

    CONSTRAINT "tblsuppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblinventory" (
    "id" BIGSERIAL NOT NULL,
    "part_name" TEXT NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "supplier_id" BIGINT,

    CONSTRAINT "tblinventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblpurchases" (
    "id" BIGSERIAL NOT NULL,
    "supplier_id" BIGINT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tblpurchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblinvoices" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "job_order_id" BIGINT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "type" TEXT NOT NULL DEFAULT 'initial_billing',
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "tblinvoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblsales" (
    "id" BIGSERIAL NOT NULL,
    "job_order_id" BIGINT,
    "inventory_id" BIGINT,
    "invoice_id" BIGINT,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tblsales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblaccounts_receivable" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tblaccounts_receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblexpenses" (
    "id" BIGSERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tblexpenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tblaccounts_payable" (
    "id" BIGSERIAL NOT NULL,
    "supplier_id" BIGINT NOT NULL,
    "purchase_id" BIGINT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tblaccounts_payable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tblusers_username_key" ON "tblusers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "tblvehicles_plate_number_key" ON "tblvehicles"("plate_number");

-- CreateIndex
CREATE INDEX "tblvehicles_customer_id_idx" ON "tblvehicles"("customer_id");

-- CreateIndex
CREATE INDEX "tblmilestones_vehicle_id_idx" ON "tblmilestones"("vehicle_id");

-- CreateIndex
CREATE INDEX "tbljoborders_vehicle_id_idx" ON "tbljoborders"("vehicle_id");

-- CreateIndex
CREATE INDEX "tbljoborders_technician_id_idx" ON "tbljoborders"("technician_id");

-- CreateIndex
CREATE INDEX "tbljoborder_supplies_job_order_id_idx" ON "tbljoborder_supplies"("job_order_id");

-- CreateIndex
CREATE INDEX "tbljoborder_supplies_inventory_id_idx" ON "tbljoborder_supplies"("inventory_id");

-- CreateIndex
CREATE INDEX "tblservice_history_vehicle_id_idx" ON "tblservice_history"("vehicle_id");

-- CreateIndex
CREATE INDEX "tblservice_history_job_order_id_idx" ON "tblservice_history"("job_order_id");

-- CreateIndex
CREATE INDEX "tblinventory_supplier_id_idx" ON "tblinventory"("supplier_id");

-- CreateIndex
CREATE INDEX "tblpurchases_supplier_id_idx" ON "tblpurchases"("supplier_id");

-- CreateIndex
CREATE INDEX "tblinvoices_customer_id_idx" ON "tblinvoices"("customer_id");

-- CreateIndex
CREATE INDEX "tblinvoices_job_order_id_idx" ON "tblinvoices"("job_order_id");

-- CreateIndex
CREATE INDEX "tblsales_job_order_id_idx" ON "tblsales"("job_order_id");

-- CreateIndex
CREATE INDEX "tblsales_inventory_id_idx" ON "tblsales"("inventory_id");

-- CreateIndex
CREATE INDEX "tblsales_invoice_id_idx" ON "tblsales"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "tblaccounts_receivable_invoice_id_key" ON "tblaccounts_receivable"("invoice_id");

-- CreateIndex
CREATE INDEX "tblaccounts_receivable_customer_id_idx" ON "tblaccounts_receivable"("customer_id");

-- CreateIndex
CREATE INDEX "tblaccounts_payable_supplier_id_idx" ON "tblaccounts_payable"("supplier_id");

-- CreateIndex
CREATE INDEX "tblaccounts_payable_purchase_id_idx" ON "tblaccounts_payable"("purchase_id");

-- AddForeignKey
ALTER TABLE "tblusers" ADD CONSTRAINT "tblusers_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "tblrbac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblusers" ADD CONSTRAINT "tblusers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "tblbranches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblvehicles" ADD CONSTRAINT "tblvehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "tblcustomers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblmilestones" ADD CONSTRAINT "tblmilestones_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "tblvehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbljoborders" ADD CONSTRAINT "tbljoborders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "tblvehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbljoborders" ADD CONSTRAINT "tbljoborders_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "tbltechnicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbljoborder_supplies" ADD CONSTRAINT "tbljoborder_supplies_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "tbljoborders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbljoborder_supplies" ADD CONSTRAINT "tbljoborder_supplies_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "tblinventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblservice_history" ADD CONSTRAINT "tblservice_history_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "tblvehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblservice_history" ADD CONSTRAINT "tblservice_history_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "tbljoborders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblinventory" ADD CONSTRAINT "tblinventory_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "tblsuppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblpurchases" ADD CONSTRAINT "tblpurchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "tblsuppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblinvoices" ADD CONSTRAINT "tblinvoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "tblcustomers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblinvoices" ADD CONSTRAINT "tblinvoices_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "tbljoborders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblsales" ADD CONSTRAINT "tblsales_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "tbljoborders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblsales" ADD CONSTRAINT "tblsales_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "tblinventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblsales" ADD CONSTRAINT "tblsales_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tblinvoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblaccounts_receivable" ADD CONSTRAINT "tblaccounts_receivable_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "tblcustomers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblaccounts_receivable" ADD CONSTRAINT "tblaccounts_receivable_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tblinvoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblaccounts_payable" ADD CONSTRAINT "tblaccounts_payable_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "tblsuppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tblaccounts_payable" ADD CONSTRAINT "tblaccounts_payable_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "tblpurchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
