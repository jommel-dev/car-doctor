import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface QuotationDraft {
  customerId: number | null;
  vehicleId: number | null;
  concern: string;
  laborAmount: number | null;
  items: QuotationItem[];
}

interface QuotationRecord {
  id: number;
  customerName: string;
  vehicleLabel: string;
  concern: string;
  laborAmount: number;
  partsAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'PRESENTED' | 'APPROVED';
  createdAt: string;
  items: QuotationItem[];
}

@Component({
  selector: 'app-quotation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quotation.component.html',
})
export class QuotationComponent implements OnInit {
  showDrawer = false;
  customers: any[] = [];
  vehicles: any[] = [];
  quotations: QuotationRecord[] = [];
  selectedQuotation: QuotationRecord | null = null;
  isLoading = false;
  errorMessage = '';

  draft: QuotationDraft = {
    customerId: null,
    vehicleId: null,
    concern: '',
    laborAmount: null,
    items: [{ description: '', quantity: 1, unitPrice: 0 }],
  };

  ngOnInit(): void {
    void this.loadData();
    this.loadSavedQuotations();
  }

  constructor(private readonly api: CarShopApiService) {}

  async loadData() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const [customersResponse, vehiclesResponse] = await Promise.all([
        this.api.getCustomers(),
        this.api.getVehicles(),
      ]);

      this.customers = Array.isArray(customersResponse.data) ? customersResponse.data : [];
      this.vehicles = Array.isArray(vehiclesResponse.data) ? vehiclesResponse.data : [];
    } catch {
      this.errorMessage = 'Unable to load customers and vehicles.';
      this.customers = [];
      this.vehicles = [];
    } finally {
      this.isLoading = false;
    }
  }

  openDrawer() {
    this.resetDraft();
    this.showDrawer = true;
  }

  closeDrawer() {
    this.showDrawer = false;
  }

  addItem() {
    this.draft.items.push({ description: '', quantity: 1, unitPrice: 0 });
  }

  removeItem(index: number) {
    this.draft.items.splice(index, 1);
    if (this.draft.items.length === 0) {
      this.addItem();
    }
  }

  createQuotation() {
    if (!this.draft.customerId || !this.draft.vehicleId || !this.draft.concern.trim()) {
      this.errorMessage = 'Customer, vehicle, and service concern are required.';
      return;
    }

    const items = this.draft.items
      .map((item) => ({
        description: String(item.description ?? '').trim(),
        quantity: Number(item.quantity ?? 0) || 0,
        unitPrice: Number(item.unitPrice ?? 0) || 0,
      }))
      .filter((item) => item.description && item.quantity > 0);

    const laborAmount = Number(this.draft.laborAmount ?? 0) || 0;
    const partsAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const customer = this.customers.find((row) => Number(row?.id) === Number(this.draft.customerId));
    const vehicle = this.vehicles.find((row) => Number(row?.id) === Number(this.draft.vehicleId));

    const quotation: QuotationRecord = {
      id: Date.now(),
      customerName: String(customer?.name ?? 'Unknown Customer'),
      vehicleLabel: this.getVehicleLabel(vehicle),
      concern: this.draft.concern.trim(),
      laborAmount,
      partsAmount,
      totalAmount: laborAmount + partsAmount,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      items,
    };

    this.quotations = [quotation, ...this.quotations];
    this.saveQuotations();
    this.closeDrawer();
  }

  markPresented(quotation: QuotationRecord) {
    quotation.status = 'PRESENTED';
    this.saveQuotations();
  }

  markApproved(quotation: QuotationRecord) {
    quotation.status = 'APPROVED';
    this.saveQuotations();
  }

  viewQuotation(quotation: QuotationRecord) {
    this.selectedQuotation = quotation;
  }

  closePreview() {
    this.selectedQuotation = null;
  }

  formatCurrency(value: number): string {
    return `₱${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  getStatusClass(status: QuotationRecord['status']): string {
    if (status === 'APPROVED') {
      return 'border-success-200 bg-success-50 text-success-700';
    }
    if (status === 'PRESENTED') {
      return 'border-brand-200 bg-brand-50 text-brand-700';
    }
    return 'border-warning-200 bg-warning-50 text-warning-700';
  }

  private getVehicleLabel(vehicle: any): string {
    const plate = String(vehicle?.plateNumber ?? vehicle?.plate_number ?? '').trim();
    const make = String(vehicle?.make ?? '').trim();
    const model = String(vehicle?.model ?? '').trim();
    const details = [make, model].filter(Boolean).join(' ');

    if (plate && details) {
      return `${plate} - ${details}`;
    }

    if (plate) {
      return plate;
    }

    return vehicle?.id ? `Vehicle #${vehicle.id}` : 'Unknown Vehicle';
  }

  private resetDraft() {
    this.errorMessage = '';
    this.draft = {
      customerId: this.customers[0]?.id ? Number(this.customers[0].id) : null,
      vehicleId: this.vehicles[0]?.id ? Number(this.vehicles[0].id) : null,
      concern: '',
      laborAmount: null,
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    };
  }

  private saveQuotations() {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('quotations-v1', JSON.stringify(this.quotations));
  }

  private loadSavedQuotations() {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = window.localStorage.getItem('quotations-v1');
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.quotations = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.quotations = [];
    }
  }
}
