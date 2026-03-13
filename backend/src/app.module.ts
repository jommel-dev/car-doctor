import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoginModule } from './auth/login/login.module';
import { DatabaseModule } from './database/database.module';
import { BrandsModule } from './inventory/brands/brands.module';
import { ProductsModule } from './inventory/products/products.module';
import { CapacityModule } from './inventory/capacity/capacity.module';
import { UsersModule } from './usermanage/users/users.module';
import { PurchaseModule } from './inventory/purchase/purchase.module';
import { VendorModule } from './inventory/vendor/vendor.module';
import { SerialNumberModule } from './inventory/serial-number/serial-number.module';
import { SalesOrderModule } from './sales/sales-order/sales-order.module';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SupabaseAuthModule } from './auth/supabase-auth/supabase-auth.module';
import { DashboardModule } from './core/dashboard/dashboard.module';
import { CustomersModule } from './customers/customers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { JobOrdersModule } from './service-operations/job-orders/job-orders.module';
import { ServiceHistoryModule } from './service-operations/service-history/service-history.module';
import { InventoryModule } from './inventory-management/inventory/inventory.module';
import { SuppliersModule } from './inventory-management/suppliers/suppliers.module';
import { PosModule } from './sales-billing/pos/pos.module';
import { InvoicesModule } from './sales-billing/invoices/invoices.module';
import { AccountsReceivableModule } from './finance/accounts-receivable/accounts-receivable.module';
import { ExpensesModule } from './finance/expenses/expenses.module';
import { AccountsPayableModule } from './finance/accounts-payable/accounts-payable.module';
import { ReportingModule } from './reporting/reporting.module';
import { UserManagementModule } from './system-admin/user-management/user-management.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SupabaseModule,
    DatabaseModule,
    LoginModule,
    SupabaseAuthModule,
    DashboardModule,
    CustomersModule,
    VehiclesModule,
    JobOrdersModule,
    ServiceHistoryModule,
    InventoryModule,
    SuppliersModule,
    PosModule,
    InvoicesModule,
    AccountsReceivableModule,
    ExpensesModule,
    AccountsPayableModule,
    ReportingModule,
    UserManagementModule,
    BrandsModule,
    ProductsModule,
    CapacityModule,
    UsersModule,
    PurchaseModule,
    VendorModule,
    SerialNumberModule,
    SalesOrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
