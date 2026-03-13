import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-accounts-payable',
  templateUrl: './accounts-payable.component.html',
})
export class AccountsPayableComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  payables: any[] = [];
  suppliers: any[] = [];
  purchases: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadPayables();
    void this.loadLookups();
  }

  async loadLookups() {
    try {
      const [suppliersResponse, purchasesResponse] = await Promise.all([
        this.api.getSuppliers(),
        this.api.getPurchases(),
      ]);
      this.suppliers = Array.isArray(suppliersResponse.data) ? suppliersResponse.data : [];
      this.purchases = Array.isArray(purchasesResponse.data) ? purchasesResponse.data : [];
    } catch {
      this.suppliers = [];
      this.purchases = [];
    }
  }

  async loadPayables() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getPayables();
      this.payables = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load payables';
    } finally {
      this.isLoading = false;
    }
  }

  async createPayable(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      supplierId: Number(formData.get('supplierId') ?? this.suppliers[0]?.id ?? 1),
      purchaseId: Number(formData.get('purchaseId') ?? this.purchases[0]?.id ?? 1),
      balance: Number(formData.get('balance') ?? 0),
      dueDate: formData.get('dueDate') || new Date().toISOString(),
    };

    await this.api.createPayable(payload as Record<string, unknown>);
    await this.loadPayables();
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
