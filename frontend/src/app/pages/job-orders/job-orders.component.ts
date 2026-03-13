import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-job-orders',
  templateUrl: './job-orders.component.html',
})
export class JobOrdersComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  jobOrders: any[] = [];
  customers: any[] = [];
  vehicles: any[] = [];
  isSubmitting = false;

  plateSearchInput = '';
  plateSearchStatus: 'idle' | 'found' | 'not-found' = 'idle';
  selectedVehicle: any | null = null;
  selectedCustomer: any | null = null;
  selectedJobOrder: any | null = null;

  jobsDoneInput = '';
  remarksInput = '';
  additionalItemsInput = '';
  isUpdatingJobOrder = false;
  statusFilter: 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'FOR_PAYMENT' | 'COMPLETED' = 'ALL';

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadJobOrders();
    void this.loadLookups();
  }

  async loadLookups() {
    try {
      const [customersResponse, vehiclesResponse] = await Promise.all([
        this.api.getCustomers(),
        this.api.getVehicles(),
      ]);
      this.customers = Array.isArray(customersResponse.data) ? customersResponse.data : [];
      this.vehicles = Array.isArray(vehiclesResponse.data) ? vehiclesResponse.data : [];
    } catch {
      this.customers = [];
      this.vehicles = [];
    }
  }

  async loadJobOrders() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getJobOrders();
      this.jobOrders = Array.isArray(response.data) ? response.data : [];
      if (this.selectedJobOrder?.id) {
        this.selectedJobOrder = this.jobOrders.find((job) => Number(job.id) === Number(this.selectedJobOrder?.id)) ?? this.selectedJobOrder;
      }
    } catch {
      this.errorMessage = 'Unable to load job orders';
    } finally {
      this.isLoading = false;
    }
  }

  async createJobOrder(event: Event) {
    event.preventDefault();
    if (this.isSubmitting) {
      return;
    }

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const description = String(formData.get('description') ?? '').trim();
      if (!description) {
        throw new Error('Inspection and concern are required');
      }

      if (this.plateSearchStatus === 'idle') {
        throw new Error('Vehicle search is required');
      }

      let vehicleId: number;

      if (this.plateSearchStatus === 'found' && this.selectedVehicle?.id) {
        vehicleId = Number(this.selectedVehicle.id);
      } else {
        const customerName = String(formData.get('customerName') ?? '').trim();
        const customerContactInfo = String(formData.get('customerContactInfo') ?? '').trim();
        const make = String(formData.get('make') ?? '').trim();
        const model = String(formData.get('model') ?? '').trim();
        const engineInfo = String(formData.get('engineInfo') ?? '').trim();
        const chassisInfo = String(formData.get('chassisInfo') ?? '').trim();
        const plateNumber = this.plateSearchInput.trim();

        if (!plateNumber || !customerName || !make || !model) {
          throw new Error('Customer and vehicle details are required for a new plate number');
        }

        const createdCustomer = await this.api.createCustomer({
          name: customerName,
          contactInfo: customerContactInfo,
        });

        const createdCustomerId = Number(createdCustomer.data?.id);
        if (!createdCustomerId) {
          throw new Error('Unable to create customer');
        }

        const createdVehicle = await this.api.createVehicle({
          customerId: createdCustomerId,
          plateNumber,
          make,
          model,
          engineInfo,
          chassisInfo,
        });

        vehicleId = Number(createdVehicle.data?.id);
        if (!vehicleId) {
          throw new Error('Unable to create vehicle');
        }
      }

      await this.api.createJobOrder({
        vehicleId,
        description,
        status: 'PENDING',
      });

      await this.loadJobOrders();
      await this.loadLookups();
      this.closePanels();
      form.reset();
      this.resetCreationForm();
      this.successMessage = 'Job order created successfully.';
    } catch {
      this.errorMessage = 'Unable to create job order. Please review plate number, customer, vehicle, and concern details.';
    } finally {
      this.isSubmitting = false;
    }
  }

  searchPlateNumber() {
    const plateToFind = this.plateSearchInput.trim().toLowerCase();

    if (!plateToFind) {
      this.plateSearchStatus = 'idle';
      this.selectedVehicle = null;
      this.selectedCustomer = null;
      return;
    }

    const matchedVehicle = this.vehicles.find(
      (vehicle) => String(vehicle?.plateNumber ?? '').trim().toLowerCase() === plateToFind,
    );

    if (!matchedVehicle) {
      this.plateSearchStatus = 'not-found';
      this.selectedVehicle = null;
      this.selectedCustomer = null;
      return;
    }

    this.plateSearchStatus = 'found';
    this.selectedVehicle = matchedVehicle;
    this.selectedCustomer = matchedVehicle.customer ?? this.customers.find((customer) => Number(customer?.id) === Number(matchedVehicle?.customerId)) ?? null;
  }

  private resetCreationForm() {
    this.plateSearchInput = '';
    this.plateSearchStatus = 'idle';
    this.selectedVehicle = null;
    this.selectedCustomer = null;
  }

  openModal() {
    this.showModal = true;
    this.errorMessage = '';
    this.resetCreationForm();
  }

  openDrawer() {
    this.showDrawer = true;
  }

  openJobOrderDrawer(job: any) {
    this.selectedJobOrder = job;
    const latestService = Array.isArray(job?.services) && job.services.length > 0
      ? [...job.services].sort(
          (a, b) =>
            new Date(b?.serviceDate ?? 0).getTime() - new Date(a?.serviceDate ?? 0).getTime(),
        )[0]
      : null;

    const notes = String(latestService?.notes ?? '');
    this.jobsDoneInput = this.extractTaggedNote(notes, 'Jobs Done');
    this.remarksInput = this.extractTaggedNote(notes, 'Remarks');
    this.additionalItemsInput = String(latestService?.partsReplaced ?? '').trim();
    this.showDrawer = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  async saveJobOrderProgress(event: Event) {
    event.preventDefault();
    if (!this.selectedJobOrder?.id || this.isUpdatingJobOrder) {
      return;
    }

    if (!this.canUpdateProgress(this.selectedJobOrder)) {
      this.errorMessage = 'This job order can no longer be updated in this step.';
      return;
    }

    const jobsDone = this.jobsDoneInput.trim();
    const remarks = this.remarksInput.trim();
    const additionalItems = this.additionalItemsInput.trim();

    if (!jobsDone && !remarks && !additionalItems) {
      this.errorMessage = 'Please provide at least one update: jobs done, remarks, or additional items used.';
      return;
    }

    this.isUpdatingJobOrder = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.api.createServiceHistory({
        vehicleId: Number(this.selectedJobOrder.vehicleId),
        jobOrderId: Number(this.selectedJobOrder.id),
        partsReplaced: additionalItems || null,
        notes: this.buildProgressNotes(jobsDone, remarks),
        serviceDate: new Date().toISOString(),
      });

      await this.api.updateJobOrder(Number(this.selectedJobOrder.id), {
        status: 'IN_PROGRESS',
      });

      await this.loadJobOrders();
      this.successMessage = 'Job order progress saved.';
    } catch {
      this.errorMessage = 'Unable to update job order progress.';
    } finally {
      this.isUpdatingJobOrder = false;
    }
  }

  async moveToCashier() {
    if (!this.selectedJobOrder?.id || this.isUpdatingJobOrder) {
      return;
    }

    if (!this.canMoveToCashier(this.selectedJobOrder)) {
      this.errorMessage = 'Only in-progress job orders can be moved to cashier.';
      return;
    }

    const hasProgressInput =
      this.jobsDoneInput.trim() || this.remarksInput.trim() || this.additionalItemsInput.trim();
    const hasSavedProgress = this.getProgressHistory(this.selectedJobOrder).length > 0;

    if (!hasProgressInput && !hasSavedProgress) {
      this.errorMessage = 'Please save jobs done, remarks, or additional items before moving to cashier.';
      return;
    }

    this.isUpdatingJobOrder = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.api.updateJobOrder(Number(this.selectedJobOrder.id), {
        status: 'FOR_PAYMENT',
      });
      await this.loadJobOrders();
      this.successMessage = 'Job order moved to cashier for payment.';
      this.selectedJobOrder = this.jobOrders.find((job) => Number(job.id) === Number(this.selectedJobOrder?.id)) ?? this.selectedJobOrder;
    } catch {
      this.errorMessage = 'Unable to move job order to cashier for payment.';
    } finally {
      this.isUpdatingJobOrder = false;
    }
  }

  closePanels() {
    this.showModal = false;
    this.showDrawer = false;
    this.selectedJobOrder = null;
    this.jobsDoneInput = '';
    this.remarksInput = '';
    this.additionalItemsInput = '';
    this.resetCreationForm();
  }

  setStatusFilter(status: 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'FOR_PAYMENT' | 'COMPLETED') {
    this.statusFilter = status;
  }

  getDisplayedJobOrders(): any[] {
    if (this.statusFilter === 'ALL') {
      return this.jobOrders;
    }
    return this.jobOrders.filter(
      (job) => String(job?.status ?? '').trim().toUpperCase() === this.statusFilter,
    );
  }

  canUpdateProgress(job: any): boolean {
    const status = String(job?.status ?? '').trim().toUpperCase();
    return status === 'PENDING' || status === 'IN_PROGRESS';
  }

  canMoveToCashier(job: any): boolean {
    const status = String(job?.status ?? '').trim().toUpperCase();
    return status === 'IN_PROGRESS';
  }

  getProgressHistory(job: any): any[] {
    if (!Array.isArray(job?.services)) {
      return [];
    }

    return [...job.services].sort(
      (a, b) =>
        new Date(b?.serviceDate ?? 0).getTime() - new Date(a?.serviceDate ?? 0).getTime(),
    );
  }

  getCustomerName(job: any): string {
    const directName = String(job?.vehicle?.customer?.name ?? '').trim();
    if (directName) {
      return directName;
    }

    const customerId = Number(job?.vehicle?.customerId ?? 0);
    if (!customerId) {
      return '-';
    }

    const matchedCustomer = this.customers.find((customer) => Number(customer?.id) === customerId);
    return String(matchedCustomer?.name ?? '-');
  }

  getVehicleLabel(job: any): string {
    const plate = String(job?.vehicle?.plateNumber ?? '').trim();
    const make = String(job?.vehicle?.make ?? '').trim();
    const model = String(job?.vehicle?.model ?? '').trim();
    const details = [make, model].filter(Boolean).join(' ');

    if (plate && details) {
      return `${plate} - ${details}`;
    }

    if (plate) {
      return plate;
    }

    return job?.vehicleId ? `Vehicle #${job.vehicleId}` : '-';
  }

  getStatusLabel(status: unknown): string {
    const normalized = String(status ?? '').trim().toLowerCase();
    if (!normalized) {
      return '-';
    }
    return normalized
      .split('_')
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
      .join(' ');
  }

  getStatusBadgeClass(status: unknown): string {
    const normalized = String(status ?? '').trim().toUpperCase();

    if (normalized === 'PENDING') {
      return 'border-warning-200 bg-warning-50 text-warning-700';
    }

    if (normalized === 'IN_PROGRESS') {
      return 'border-brand-200 bg-brand-50 text-brand-700';
    }

    if (normalized === 'FOR_PAYMENT') {
      return 'border-success-200 bg-success-50 text-success-700';
    }

    if (normalized === 'COMPLETED') {
      return 'border-gray-300 bg-gray-100 text-gray-700';
    }

    return 'border-gray-300 bg-gray-100 text-gray-700';
  }

  formatDateTime(value: unknown): string {
    if (!value) {
      return '-';
    }
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString();
  }

  private buildProgressNotes(jobsDone: string, remarks: string): string {
    return [`Jobs Done: ${jobsDone || '-'}`, `Remarks: ${remarks || '-'}`].join('\n');
  }

  private extractTaggedNote(notes: string, tag: 'Jobs Done' | 'Remarks'): string {
    const pattern = new RegExp(`${tag}:\\s*(.*)`, 'i');
    const match = notes.match(pattern);
    return String(match?.[1] ?? '').trim();
  }
}
