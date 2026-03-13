import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-customer-management',
  templateUrl: './customer-management.component.html',
})
export class CustomerManagementComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  customers: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadCustomers();
  }

  async loadCustomers() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getCustomers();
      this.customers = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load customers';
    } finally {
      this.isLoading = false;
    }
  }

  async createCustomer(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') ?? ''),
      contactInfo: String(formData.get('contactInfo') ?? ''),
    };

    await this.api.createCustomer(payload);
    await this.loadCustomers();
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
