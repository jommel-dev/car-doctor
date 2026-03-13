import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-accounts-receivable',
  templateUrl: './accounts-receivable.component.html',
})
export class AccountsReceivableComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  receivables: any[] = [];
  customers: any[] = [];
  invoices: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadReceivables();
    void this.loadLookups();
  }

  async loadLookups() {
    try {
      const [customersResponse, invoicesResponse] = await Promise.all([
        this.api.getCustomers(),
        this.api.getInvoices(),
      ]);
      this.customers = Array.isArray(customersResponse.data) ? customersResponse.data : [];
      this.invoices = Array.isArray(invoicesResponse.data) ? invoicesResponse.data : [];
    } catch {
      this.customers = [];
      this.invoices = [];
    }
  }

  async loadReceivables() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getReceivables();
      this.receivables = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load receivables';
    } finally {
      this.isLoading = false;
    }
  }

  async createReceivable(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      customerId: Number(formData.get('customerId') ?? this.customers[0]?.id ?? 1),
      invoiceId: Number(formData.get('invoiceId') ?? this.invoices[0]?.id ?? 1),
      balance: Number(formData.get('balance') ?? 0),
      dueDate: formData.get('dueDate') || new Date().toISOString(),
    };

    await this.api.createReceivable(payload as Record<string, unknown>);
    await this.loadReceivables();
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
