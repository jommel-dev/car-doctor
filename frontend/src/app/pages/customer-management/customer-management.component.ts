import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

interface Customer {
  id: number;
  name: string;
  contact: string;
  email?: string;
  address?: string;
  vehicles?: Vehicle[];
}

interface Vehicle {
  id: number;
  plateNumber: string;
  make: string;
  model: string;
  engineType?: string;
  odometerReading?: number;
  fuelType?: string;
  warrantyStatus?: string;
  previousServiceDocs?: string;
  milestones: Milestone[];
  jobOrders: any[];
}

interface Milestone {
  id: number;
  milestone: string;
  tasks: string;
}

@Component({
  selector: 'app-customer-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-management.component.html',
})
export class CustomerManagementComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  isLoading = false;
  errorMessage = '';

  // New UI state
  searchQuery = '';
  selectedCustomer: Customer | null = null;
  selectedVehicle: Vehicle | null = null;
  viewMode: 'list' | 'tree' = 'list';

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
      this.filteredCustomers = [...this.customers];
    } catch {
      this.errorMessage = 'Unable to load customers';
      this.customers = [];
      this.filteredCustomers = [];
    } finally {
      this.isLoading = false;
    }
  }

  onSearchChange() {
    if (!this.searchQuery.trim()) {
      this.filteredCustomers = [...this.customers];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredCustomers = this.customers.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        customer.contact.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        (customer.vehicles && customer.vehicles.some(vehicle =>
          vehicle.plateNumber.toLowerCase().includes(query) ||
          vehicle.make.toLowerCase().includes(query) ||
          vehicle.model.toLowerCase().includes(query)
        ))
      );
    }
  }

  selectCustomer(customer: Customer) {
    this.selectedCustomer = customer;
    this.selectedVehicle = null;
  }

  selectVehicle(vehicle: Vehicle) {
    this.selectedVehicle = vehicle;
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'list' ? 'tree' : 'list';
  }

  async createCustomer(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') ?? ''),
      contact: String(formData.get('contact') ?? ''),
      email: String(formData.get('email') ?? ''),
      address: String(formData.get('address') ?? ''),
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

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'for_payment':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
}
