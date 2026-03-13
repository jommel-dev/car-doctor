import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-vehicle-management',
  templateUrl: './vehicle-management.component.html',
})
export class VehicleManagementComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  vehicles: any[] = [];
  customers: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadVehicles();
    void this.loadCustomers();
  }

  async loadCustomers() {
    try {
      const response = await this.api.getCustomers();
      this.customers = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.customers = [];
    }
  }

  async loadVehicles() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getVehicles();
      this.vehicles = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load vehicles';
    } finally {
      this.isLoading = false;
    }
  }

  async createVehicle(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      customerId: Number(formData.get('customerId') ?? this.customers[0]?.id ?? 1),
      plateNumber: String(formData.get('plateNumber') ?? ''),
      make: String(formData.get('make') ?? ''),
      model: String(formData.get('model') ?? ''),
      engineInfo: String(formData.get('engineInfo') ?? ''),
      chassisInfo: String(formData.get('chassisInfo') ?? ''),
    };

    await this.api.createVehicle(payload);
    await this.loadVehicles();
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
