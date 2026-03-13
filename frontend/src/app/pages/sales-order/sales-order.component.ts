import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ButtonComponent } from '../../shared/components/ui/button/button.component';
import { CanDirective } from '../../shared/directives/can.directive';

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  role: string;
  status: 'Active' | 'Inactive';
}

@Component({
  selector: 'app-sales-order',
  imports: [CommonModule, PageBreadcrumbComponent, ButtonComponent, CanDirective],
  templateUrl: './sales-order.component.html',
  styles: ``,
})
export class SalesOrderComponent {
  users: UserRow[] = [
    { id: 1, username: 'superadmin', fullName: 'Super Administrator', role: 'Super Admin', status: 'Active' },
    { id: 2, username: 'admin01', fullName: 'Main Admin', role: 'Admin', status: 'Active' },
    { id: 3, username: 'sales01', fullName: 'Sales Staff One', role: 'Sales Staff', status: 'Active' },
    { id: 4, username: 'warehouse01', fullName: 'Warehouse Team', role: 'Warehouseman', status: 'Inactive' },
  ];
}
