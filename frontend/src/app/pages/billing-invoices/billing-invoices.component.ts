import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-billing-invoices',
  templateUrl: './billing-invoices.component.html',
})
export class BillingInvoicesComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  invoices: any[] = [];
  customers: any[] = [];
  jobOrders: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadInvoices();
    void this.loadLookups();
  }

  async loadLookups() {
    try {
      const [customersResponse, jobOrdersResponse] = await Promise.all([
        this.api.getCustomers(),
        this.api.getJobOrders(),
      ]);
      this.customers = Array.isArray(customersResponse.data) ? customersResponse.data : [];
      this.jobOrders = Array.isArray(jobOrdersResponse.data) ? jobOrdersResponse.data : [];
    } catch {
      this.customers = [];
      this.jobOrders = [];
    }
  }

  async loadInvoices() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getInvoices();
      this.invoices = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load invoices';
    } finally {
      this.isLoading = false;
    }
  }

  async createInvoice(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      customerId: Number(formData.get('customerId') ?? this.customers[0]?.id ?? 1),
      jobOrderId: Number(formData.get('jobOrderId') ?? this.jobOrders[0]?.id ?? 1),
      totalAmount: Number(formData.get('totalAmount') ?? 0),
      status: 'UNPAID',
    };

    await this.api.createInvoice(payload);
    await this.loadInvoices();
    this.closePanels();
    form.reset();
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
}
