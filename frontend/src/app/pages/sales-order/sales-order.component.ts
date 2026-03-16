import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ButtonComponent } from '../../shared/components/ui/button/button.component';
import { CanDirective } from '../../shared/directives/can.directive';

interface SalesOrderRow {
  id: number;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

@Component({
  selector: 'app-sales-order',
  imports: [CommonModule, PageBreadcrumbComponent, ButtonComponent, CanDirective],
  templateUrl: './sales-order.component.html',
  styles: ``,
})
export class SalesOrderComponent implements OnInit {
  salesOrders: SalesOrderRow[] = [];
  showModal = false;
  showDrawer = false;
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadSalesOrders();
  }

  async loadSalesOrders() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getSalesOrders();
      this.salesOrders = Array.isArray(response.data) ? response.data.map((order: any) => ({
        id: order.id,
        orderNumber: `SO-${order.id.toString().padStart(4, '0')}`,
        customerName: order.customer?.name || 'Unknown Customer',
        totalAmount: order.totalAmount || 0,
        status: order.status || 'PENDING',
        createdAt: order.created_at ? new Date(order.created_at).toLocaleDateString() : ''
      })) : [];
    } catch {
      this.errorMessage = 'Unable to load sales orders';
    } finally {
      this.isLoading = false;
    }
  }

  openModal() {
    this.showModal = true;
  }

  openDrawer() {
    this.showDrawer = true;
  }

  closePanels() {
    this.showModal = false;
    this.showDrawer = false;
  }

  async createSalesOrder(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      customerId: Number(formData.get('customerId') ?? 0),
      totalAmount: Number(formData.get('totalAmount') ?? 0),
      status: String(formData.get('status') ?? 'PENDING'),
    };

    try {
      await this.api.createSalesOrder(payload);
      await this.loadSalesOrders();
      this.closePanels();
      form.reset();
    } catch (error) {
      console.error('Error creating sales order:', error);
      this.errorMessage = 'Failed to create sales order';
    }
  }
}
