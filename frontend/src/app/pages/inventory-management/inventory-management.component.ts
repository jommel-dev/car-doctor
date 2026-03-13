import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-inventory-management',
  templateUrl: './inventory-management.component.html',
})
export class InventoryManagementComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  inventory: any[] = [];
  suppliers: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadInventory();
    void this.loadSuppliers();
  }

  async loadSuppliers() {
    try {
      const response = await this.api.getSuppliers();
      this.suppliers = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.suppliers = [];
    }
  }

  async loadInventory() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getInventory();
      this.inventory = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load inventory';
    } finally {
      this.isLoading = false;
    }
  }

  async createInventory(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      partName: String(formData.get('partName') ?? ''),
      stockQty: Number(formData.get('stockQty') ?? 0),
      lowStockThreshold: Number(formData.get('lowStockThreshold') ?? 5),
      supplierId: Number(formData.get('supplierId') ?? this.suppliers[0]?.id ?? 1),
    };

    await this.api.createInventoryItem(payload);
    await this.loadInventory();
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
