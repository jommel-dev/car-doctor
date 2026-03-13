import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-supplier-management',
  templateUrl: './supplier-management.component.html',
})
export class SupplierManagementComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  suppliers: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadSuppliers();
  }

  async loadSuppliers() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getSuppliers();
      this.suppliers = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load suppliers';
    } finally {
      this.isLoading = false;
    }
  }

  async createSupplier(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') ?? ''),
      contactInfo: String(formData.get('contactInfo') ?? ''),
      paymentTerms: String(formData.get('paymentTerms') ?? '30 days'),
    };

    await this.api.createSupplier(payload);
    await this.loadSuppliers();
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
