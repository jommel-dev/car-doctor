import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';
import SignaturePad from 'signature_pad';

interface Milestone {
  id: number;
  milestone: string;
  tasks: string;
}

interface JobOrderForm {
  vehicleId: number;
  technicianId?: number;
  description: string;
  status: string;
  billingPrice?: number;
  customerReview?: string;
  supplies: SupplyItem[];
}

interface JobOrderEditForm {
  id: number;
  technicianId: number | null;
  description: string;
  status: string;
  billingPrice: number | null;
  supplies: SupplyItem[];
}

interface SupplyItem {
  supplyType: 'inventory' | 'customer_provided' | 'external_expense';
  inventoryId?: number;
  description: string;
  quantity: number;
  costPrice?: number;
  billingPrice?: number;
}

interface NewVehicleDraft {
  make: string;
  model: string;
  engineType: string;
  odometerReading: string;
  fuelType: string;
  warrantyStatus: string;
  previousServiceDocs: string;
}

interface NewCustomerDraft {
  name: string;
  contact: string;
  email: string;
  address: string;
}

interface SupplyPayload {
  supplyType: 'inventory' | 'customer_provided' | 'external_expense';
  inventoryId?: number;
  description: string;
  quantity: number;
  costPrice?: string;
  billingPrice?: string;
}

@Component({
  selector: 'app-job-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './job-orders.component.html',
})
export class JobOrdersComponent implements OnInit {
  private readonly createJobOrderDraftKey = 'job-orders-create-draft-v1';

  showModal = false;
  showDrawer = false;
  showApprovalDrawer = false;
  jobOrders: any[] = [];
  customers: any[] = [];
  vehicles: any[] = [];
  technicians: any[] = [];
  inventory: any[] = [];
  isSubmitting = false;

  // Enhanced form data
  plateSearchInput = '';
  plateSearchStatus: 'idle' | 'found' | 'not-found' = 'idle';
  selectedVehicle: any | null = null;
  selectedCustomer: any | null = null;
  selectedMilestones: Milestone[] = [];
  newVehicleDraft: NewVehicleDraft = {
    make: '',
    model: '',
    engineType: '',
    odometerReading: '',
    fuelType: '',
    warrantyStatus: '',
    previousServiceDocs: '',
  };
  newCustomerDraft: NewCustomerDraft = {
    name: '',
    contact: '',
    email: '',
    address: '',
  };

  // New Job Order form
  newJobOrder: JobOrderForm = {
    vehicleId: 0,
    description: '',
    status: 'PENDING',
    supplies: []
  };

  // Multiple Job Orders per vehicle
  jobOrdersList: JobOrderForm[] = [];

  // UI state
  currentStep: 'vehicle' | 'customer' | 'job-orders' | 'review' = 'vehicle';
  selectedJobOrder: any | null = null;
  editableJobOrder: JobOrderEditForm | null = null;

  // Legacy properties (keeping for compatibility)
  jobsDoneInput = '';
  remarksInput = '';
  isUpdatingJobOrder = false;
  isUpdatingJobOrderDetails = false;
  statusFilter: 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'FOR_PAYMENT' | 'COMPLETED' = 'ALL';

  isLoading = false;
  errorMessage = '';
  successMessage = '';
  approvalCustomerName = '';
  approvalSummaryNotes = '';
  initialSignatoryName = '';
  mechanicSignatoryName = '';

  @ViewChild('approvalSignatureCanvas')
  approvalSignatureCanvas?: ElementRef<HTMLCanvasElement>;

  @ViewChild('createInitialSignatureCanvas')
  createInitialSignatureCanvas?: ElementRef<HTMLCanvasElement>;

  @ViewChild('mechanicSignatureCanvas')
  mechanicSignatureCanvas?: ElementRef<HTMLCanvasElement>;

  private approvalSignaturePad: SignaturePad | null = null;
  private createInitialSignaturePad: SignaturePad | null = null;
  private mechanicSignaturePad: SignaturePad | null = null;

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadJobOrders();
    void this.loadLookups();
    this.clearCreateDraft();
  }

  ngAfterViewChecked(): void {
    this.initializeApprovalSignaturePad();
    this.initializeCreateSignaturePad();
    this.initializeMechanicSignaturePad();
  }

  async loadLookups() {
    this.errorMessage = '';

    const [customersResult, vehiclesResult, techniciansResult, inventoryResult] = await Promise.allSettled([
      this.api.getCustomers(),
      this.api.getVehicles(),
      this.api.getTechnicians(),
      this.api.getInventory(),
    ]);

    this.customers =
      customersResult.status === 'fulfilled' && Array.isArray(customersResult.value.data)
        ? customersResult.value.data
        : [];

    this.vehicles =
      vehiclesResult.status === 'fulfilled' && Array.isArray(vehiclesResult.value.data)
        ? vehiclesResult.value.data
        : [];

    this.technicians =
      techniciansResult.status === 'fulfilled' && Array.isArray(techniciansResult.value.data)
        ? techniciansResult.value.data.map((technician: any) => {
            const normalizedId = Number(technician?.id);
            return {
              ...technician,
              id: Number.isFinite(normalizedId) ? normalizedId : technician?.id,
            };
          })
        : [];

    this.inventory =
      inventoryResult.status === 'fulfilled' && Array.isArray(inventoryResult.value.data)
        ? inventoryResult.value.data
        : [];

    const failedCoreLookups =
      customersResult.status === 'rejected' || vehiclesResult.status === 'rejected';

    if (failedCoreLookups) {
      this.errorMessage = 'Unable to load customers/vehicles lookup data. Please ensure backend API is running.';
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
          contact: customerContactInfo,
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
      this.resetCreationForm();
      this.closeCreateDrawer(false);
      form.reset();
      this.successMessage = 'Job order created successfully.';
    } catch {
      this.errorMessage = 'Unable to create job order. Please review plate number, customer, vehicle, and concern details.';
    } finally {
      this.isSubmitting = false;
    }
  }

  async searchPlateNumber() {
    this.errorMessage = '';

    const vehiclesLoaded = await this.refreshVehiclesForSearch();
    if (!vehiclesLoaded) {
      this.plateSearchStatus = 'idle';
      this.selectedVehicle = null;
      this.selectedCustomer = null;
      this.selectedMilestones = [];
      this.errorMessage = 'Vehicle search is unavailable right now. Please check backend API connection and try again.';
      return;
    }

    const plateToFind = this.normalizePlateNumber(this.plateSearchInput);

    if (!plateToFind) {
      this.plateSearchStatus = 'idle';
      this.selectedVehicle = null;
      this.selectedCustomer = null;
      this.selectedMilestones = [];
      this.saveCreateDraft();
      return;
    }

    const matchedVehicle = this.vehicles.find((vehicle) => {
      const possiblePlate =
        vehicle?.plateNumber ??
        vehicle?.plate_number ??
        vehicle?.plateNo ??
        vehicle?.plate ??
        '';

      return this.normalizePlateNumber(possiblePlate) === plateToFind;
    });

    if (!matchedVehicle) {
      this.plateSearchStatus = 'not-found';
      this.selectedVehicle = null;
      this.selectedCustomer = null;
      this.selectedMilestones = [];
      this.newVehicleDraft = {
        make: '',
        model: '',
        engineType: '',
        odometerReading: '',
        fuelType: '',
        warrantyStatus: '',
        previousServiceDocs: '',
      };
      this.newCustomerDraft = {
        name: '',
        contact: '',
        email: '',
        address: '',
      };
      this.saveCreateDraft();
      return;
    }

    this.plateSearchStatus = 'found';
    this.selectedVehicle = matchedVehicle;
    this.selectedCustomer = matchedVehicle.customer ?? this.customers.find((customer) => Number(customer?.id) === Number(matchedVehicle?.customerId)) ?? null;
    this.selectedMilestones = matchedVehicle.milestones || [];
    this.saveCreateDraft();
  }

  private async refreshVehiclesForSearch(): Promise<boolean> {
    try {
      const vehiclesResponse = await this.api.getVehicles();
      this.vehicles = Array.isArray(vehiclesResponse.data) ? vehiclesResponse.data : [];
      return true;
    } catch {
      return false;
    }
  }

  // New enhanced methods
  nextStep() {
    this.errorMessage = '';

    if (this.currentStep === 'vehicle' && this.plateSearchStatus !== 'idle') {
      if (this.plateSearchStatus === 'not-found') {
        if (!this.newVehicleDraft.make.trim() || !this.newVehicleDraft.model.trim()) {
          this.errorMessage = 'Please fill in vehicle make and model for new plate number.';
          return;
        }
      }
      this.currentStep = 'customer';
      this.saveCreateDraft();
    } else if (this.currentStep === 'customer') {
      if (this.plateSearchStatus === 'not-found') {
        if (!this.newCustomerDraft.name.trim() || !this.newCustomerDraft.contact.trim()) {
          this.errorMessage = 'Please fill in customer name and contact details.';
          return;
        }
      }
      this.currentStep = 'job-orders';
      this.initializeJobOrders();
      this.saveCreateDraft();
    } else if (this.currentStep === 'job-orders') {
      if (this.jobOrdersList.some((job) => !job.description.trim())) {
        this.errorMessage = 'Each job order must include a description.';
        return;
      }
      this.currentStep = 'review';
      this.saveCreateDraft();
    }
  }

  previousStep() {
    if (this.currentStep === 'review') {
      this.currentStep = 'job-orders';
    } else if (this.currentStep === 'job-orders') {
      this.currentStep = 'customer';
    } else if (this.currentStep === 'customer') {
      this.currentStep = 'vehicle';
    }
    this.saveCreateDraft();
  }

  initializeJobOrders() {
    if (!this.jobOrdersList.length) {
      this.addJobOrder();
    }
  }

  addJobOrder() {
    const newJob: JobOrderForm = {
      vehicleId: this.selectedVehicle?.id || 0,
      description: '',
      status: 'PENDING',
      supplies: []
    };
    this.jobOrdersList.push(newJob);
    this.saveCreateDraft();
  }

  removeJobOrder(index: number) {
    if (this.jobOrdersList.length > 1) {
      this.jobOrdersList.splice(index, 1);
      this.saveCreateDraft();
    }
  }

  addSupplyToJob(jobIndex: number) {
    const supply: SupplyItem = {
      supplyType: 'inventory',
      description: '',
      quantity: 1,
      billingPrice: 0
    };
    this.jobOrdersList[jobIndex].supplies.push(supply);
    this.saveCreateDraft();
  }

  removeSupplyFromJob(jobIndex: number, supplyIndex: number) {
    this.jobOrdersList[jobIndex].supplies.splice(supplyIndex, 1);
    this.saveCreateDraft();
  }

  onSupplyTypeChange(jobIndex: number, supplyIndex: number) {
    const supply = this.jobOrdersList[jobIndex].supplies[supplyIndex];
    if (supply.supplyType !== 'inventory') {
      supply.inventoryId = undefined;
    }
    this.saveCreateDraft();
  }

  onSupplyInventoryChange(jobIndex: number, supplyIndex: number) {
    const supply = this.jobOrdersList[jobIndex].supplies[supplyIndex];
    if (supply.supplyType !== 'inventory') {
      return;
    }

    const selectedInventory = this.inventory.find(
      (item) => Number(item?.id) === Number(supply.inventoryId ?? 0),
    );

    if (selectedInventory) {
      this.applyInventoryPricingToSupply(supply, selectedInventory);
    }

    this.saveCreateDraft();
  }

  async createEnhancedJobOrder() {
    if (this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      if (!this.jobOrdersList.length) {
        throw new Error('At least one job order is required.');
      }

      let vehicleId = Number(this.selectedVehicle?.id ?? 0);

      if (this.plateSearchStatus === 'not-found') {
        if (!this.plateSearchInput.trim() || !this.newVehicleDraft.make.trim() || !this.newVehicleDraft.model.trim()) {
          throw new Error('Vehicle details are incomplete for new plate number.');
        }

        if (!this.newCustomerDraft.name.trim() || !this.newCustomerDraft.contact.trim()) {
          throw new Error('Customer details are incomplete for new plate number.');
        }

        const createdCustomer = await this.api.createCustomer({
          name: this.newCustomerDraft.name.trim(),
          contact: this.newCustomerDraft.contact.trim(),
          email: this.newCustomerDraft.email.trim() || undefined,
          address: this.newCustomerDraft.address.trim() || undefined,
        });

        const createdCustomerId = Number(createdCustomer.data?.id ?? 0);
        if (!createdCustomerId) {
          throw new Error('Unable to create customer.');
        }

        const createdVehicle = await this.api.createVehicle({
          customerId: createdCustomerId,
          plateNumber: this.plateSearchInput.trim(),
          make: this.newVehicleDraft.make.trim(),
          model: this.newVehicleDraft.model.trim(),
          engineType: this.newVehicleDraft.engineType.trim() || undefined,
          odometerReading: this.newVehicleDraft.odometerReading ? Number(this.newVehicleDraft.odometerReading) : undefined,
          fuelType: this.newVehicleDraft.fuelType.trim() || undefined,
          warrantyStatus: this.newVehicleDraft.warrantyStatus.trim() || undefined,
          previousServiceDocs: this.newVehicleDraft.previousServiceDocs.trim() || undefined,
        });

        vehicleId = Number(createdVehicle.data?.id ?? 0);
        if (!vehicleId) {
          throw new Error('Unable to create vehicle.');
        }
      }

      if (!vehicleId) {
        throw new Error('Vehicle is required before creating job orders.');
      }

      const signatoryName = this.initialSignatoryName.trim();
      if (!signatoryName) {
        throw new Error('Initial signatory name is required before creating job orders.');
      }

      if (!this.createInitialSignaturePad || this.createInitialSignaturePad.isEmpty()) {
        throw new Error('Initial signatory signature is required before creating job orders.');
      }

      const initialSignatory = {
        initialSignatoryName: signatoryName,
        initialSignedAt: new Date().toISOString(),
        initialSignatureDataUrl: this.getOptimizedCreateSignaturePngDataUrl(),
      };

      for (const jobOrder of this.jobOrdersList) {
        if (!jobOrder.description.trim()) {
          throw new Error('Each job order must include a description.');
        }

        const normalizedSupplies = this.normalizeSuppliesPayload(jobOrder.supplies);

        const payload = {
          vehicleId,
          technicianId: jobOrder.technicianId ? Number(jobOrder.technicianId) : undefined,
          description: jobOrder.description.trim(),
          status: 'PENDING',
          billingPrice: jobOrder.billingPrice ? Number(jobOrder.billingPrice).toFixed(2) : undefined,
          customerReview: JSON.stringify(initialSignatory),
          supplies: normalizedSupplies,
        };

        await this.api.createJobOrder(payload);
      }

      await this.loadJobOrders();
      await this.loadLookups();
      this.resetCreationForm();
      this.closeCreateDrawer(false);
      this.successMessage = 'Job orders created successfully.';
    } catch (error: unknown) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to create job orders. Please check all required fields.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private normalizeSuppliesPayload(supplies: SupplyItem[]): SupplyPayload[] {
    return supplies
      .map((supply) => {
        const inventoryId = supply.inventoryId ? Number(supply.inventoryId) : undefined;
        const inventoryItem = this.inventory.find((item) => Number(item?.id) === Number(inventoryId));
        const fallbackDescription = String(inventoryItem?.partName ?? inventoryItem?.name ?? '').trim();
        const normalizedQuantity = Number(supply.quantity ?? 0);
        const normalizedCostPrice = supply.costPrice != null && String(supply.costPrice).trim() !== ''
          ? Number(supply.costPrice)
          : null;
        const normalizedBillingPrice = supply.billingPrice != null && String(supply.billingPrice).trim() !== ''
          ? Number(supply.billingPrice)
          : null;

        const payload: SupplyPayload = {
          supplyType: supply.supplyType,
          inventoryId: supply.supplyType === 'inventory' ? inventoryId : undefined,
          description: supply.description?.trim() || fallbackDescription,
          quantity: Number.isFinite(normalizedQuantity) && normalizedQuantity > 0 ? normalizedQuantity : 1,
          costPrice: Number.isFinite(normalizedCostPrice) ? Number(normalizedCostPrice).toFixed(2) : undefined,
          billingPrice: Number.isFinite(normalizedBillingPrice) ? Number(normalizedBillingPrice).toFixed(2) : undefined,
        };

        if (!payload.description) {
          payload.description = supply.supplyType === 'inventory' ? 'Inventory item' : 'Supply item';
        }

        return payload;
      })
      .filter((supply) => Number(supply.quantity ?? 0) > 0);
  }

  private resetForm() {
    this.plateSearchInput = '';
    this.plateSearchStatus = 'idle';
    this.selectedVehicle = null;
    this.selectedCustomer = null;
    this.selectedMilestones = [];
    this.jobOrdersList = [];
    this.currentStep = 'vehicle';
  }

  private resetCreationForm() {
    this.plateSearchInput = '';
    this.plateSearchStatus = 'idle';
    this.selectedVehicle = null;
    this.selectedCustomer = null;
    this.selectedMilestones = [];
    this.newVehicleDraft = {
      make: '',
      model: '',
      engineType: '',
      odometerReading: '',
      fuelType: '',
      warrantyStatus: '',
      previousServiceDocs: '',
    };
    this.newCustomerDraft = {
      name: '',
      contact: '',
      email: '',
      address: '',
    };
    this.jobOrdersList = [];
    this.currentStep = 'vehicle';
    this.clearCreateDraft();
    this.initialSignatoryName = '';
    this.createInitialSignaturePad = null;
  }

  openModal() {
    this.showModal = true;
    this.errorMessage = '';
    this.initialSignatoryName = '';
    this.createInitialSignaturePad = null;
  }

  openDrawer() {
    this.showDrawer = true;
  }

  onCreateDraftChanged() {
    this.saveCreateDraft();
  }

  openJobOrderDrawer(job: any) {
    this.selectedJobOrder = job;
    const latestServiceNotes = this.getLatestProgressNotes(job);
    this.jobsDoneInput = String(job?.jobsDone ?? '').trim() || this.extractTaggedNote(latestServiceNotes, 'Jobs Done');
    this.remarksInput = String(job?.serviceRemarks ?? '').trim() || this.extractTaggedNote(latestServiceNotes, 'Remarks');
    this.mechanicSignatoryName = String(job?.mechanicSignatoryName ?? '').trim();
    this.editableJobOrder = this.buildEditableJobOrder(job);
    this.approvalCustomerName = this.getCustomerName(job) === '-' ? '' : this.getCustomerName(job);
    this.approvalSummaryNotes = '';
    this.approvalSignaturePad = null;
    this.mechanicSignaturePad = null;
    this.showApprovalDrawer = false;
    this.showDrawer = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  addSupplyToDetails() {
    if (!this.editableJobOrder) {
      return;
    }

    const supply: SupplyItem = {
      supplyType: 'inventory',
      description: '',
      quantity: 1,
      billingPrice: 0,
    };

    this.editableJobOrder.supplies.push(supply);
  }

  removeSupplyFromDetails(index: number) {
    if (!this.editableJobOrder) {
      return;
    }

    this.editableJobOrder.supplies.splice(index, 1);
  }

  onDetailsSupplyTypeChange(index: number) {
    if (!this.editableJobOrder) {
      return;
    }

    const supply = this.editableJobOrder.supplies[index];
    if (supply.supplyType !== 'inventory') {
      supply.inventoryId = undefined;
    }
  }

  onDetailsSupplyInventoryChange(index: number) {
    if (!this.editableJobOrder) {
      return;
    }

    const supply = this.editableJobOrder.supplies[index];
    if (supply.supplyType !== 'inventory') {
      return;
    }

    const selectedInventory = this.inventory.find(
      (item) => Number(item?.id) === Number(supply.inventoryId ?? 0),
    );

    if (selectedInventory) {
      this.applyInventoryPricingToSupply(supply, selectedInventory);
    }
  }

  async saveJobOrderProgress(event: Event) {
    event.preventDefault();
    if (!this.selectedJobOrder?.id || !this.editableJobOrder || this.isUpdatingJobOrder) {
      return;
    }

    const description = this.editableJobOrder.description.trim();
    if (!description) {
      this.errorMessage = 'Description is required.';
      return;
    }

    const jobsDone = this.jobsDoneInput.trim();
    const remarks = this.remarksInput.trim();
    const hasProgressNotes = !!jobsDone || !!remarks;
    const status = String(this.selectedJobOrder?.status ?? '').trim().toUpperCase();
    const mechanicSignatoryName = this.mechanicSignatoryName.trim() || String(this.selectedJobOrder?.mechanicSignatoryName ?? '').trim();
    const mechanicSignatureData = this.getMechanicSignatureDataForSave();
    const technicianId =
      this.editableJobOrder.technicianId != null && String(this.editableJobOrder.technicianId).trim() !== ''
        ? Number(this.editableJobOrder.technicianId)
        : null;
    const billingPriceRaw = this.editableJobOrder.billingPrice;
    const billingPriceNumber =
      billingPriceRaw != null && String(billingPriceRaw).trim() !== ''
        ? Number(billingPriceRaw)
        : null;

    this.isUpdatingJobOrder = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const normalizedSupplies = this.normalizeSuppliesPayload(this.editableJobOrder.supplies);

      await this.api.updateJobOrder(Number(this.selectedJobOrder.id), {
        technicianId: Number.isFinite(technicianId) ? technicianId : null,
        description,
        jobsDone: jobsDone || null,
        serviceRemarks: remarks || null,
        mechanicSignatoryName: mechanicSignatoryName || null,
        mechanicSignatureData: mechanicSignatureData,
        mechanicSignedAt: mechanicSignatureData ? new Date().toISOString() : this.selectedJobOrder?.mechanicSignedAt ?? null,
        billingPrice: Number.isFinite(billingPriceNumber)
          ? Number(billingPriceNumber).toFixed(2)
          : null,
        supplies: normalizedSupplies,
      });

      if (hasProgressNotes && this.hasProgressChanged(jobsDone, remarks)) {
        await this.api.createServiceHistory({
          vehicleId: Number(this.selectedJobOrder.vehicleId),
          jobOrderId: Number(this.selectedJobOrder.id),
          partsReplaced: null,
          notes: this.buildProgressNotes(jobsDone, remarks),
          serviceDate: new Date().toISOString(),
        });
      }

      await this.loadJobOrders();
      this.selectedJobOrder =
        this.jobOrders.find((job) => Number(job.id) === Number(this.selectedJobOrder?.id)) ??
        this.selectedJobOrder;
      this.jobsDoneInput = String(this.selectedJobOrder?.jobsDone ?? '').trim();
      this.remarksInput = String(this.selectedJobOrder?.serviceRemarks ?? '').trim();
      this.mechanicSignatoryName = String(this.selectedJobOrder?.mechanicSignatoryName ?? '').trim();
      this.editableJobOrder = this.buildEditableJobOrder(this.selectedJobOrder);
      this.successMessage = status === 'IN_PROGRESS'
        ? 'Job order details and mechanic completion notes saved.'
        : 'Job order details saved.';
    } catch (error: unknown) {
      const apiMessage =
        (error as any)?.response?.data?.message ??
        (error as any)?.message ??
        null;
      this.errorMessage = apiMessage
        ? `Unable to save job order updates: ${String(apiMessage)}`
        : 'Unable to save job order updates.';
    } finally {
      this.isUpdatingJobOrder = false;
    }
  }

  async moveToCashier() {
    if (!this.selectedJobOrder?.id || this.isUpdatingJobOrder) {
      return;
    }

    if (!this.canMoveToCashier(this.selectedJobOrder)) {
      this.errorMessage = 'Only customer-approved in-progress job orders can be moved to cashier.';
      return;
    }

    const jobsDone = this.jobsDoneInput.trim();
    const remarks = this.remarksInput.trim();
    const mechanicSignatoryName = this.mechanicSignatoryName.trim();
    const mechanicSignatureData = this.getMechanicSignatureDataForSave();

    if (!jobsDone) {
      this.errorMessage = 'Please enter the jobs done before moving to payment.';
      return;
    }

    if (!remarks) {
      this.errorMessage = 'Please enter the mechanic remarks before moving to payment.';
      return;
    }

    if (!mechanicSignatoryName) {
      this.errorMessage = 'Mechanic signatory name is required before moving to payment.';
      return;
    }

    if (!mechanicSignatureData) {
      this.errorMessage = 'Mechanic signature is required before moving to payment.';
      return;
    }

    this.isUpdatingJobOrder = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.api.updateJobOrder(Number(this.selectedJobOrder.id), {
        jobsDone,
        serviceRemarks: remarks,
        mechanicSignatoryName,
        mechanicSignatureData,
        mechanicSignedAt: new Date().toISOString(),
        status: 'FOR_PAYMENT',
        forPaymentAt: new Date().toISOString(),
      });

      if (this.hasProgressChanged(jobsDone, remarks)) {
        await this.api.createServiceHistory({
          vehicleId: Number(this.selectedJobOrder.vehicleId),
          jobOrderId: Number(this.selectedJobOrder.id),
          partsReplaced: null,
          notes: this.buildProgressNotes(jobsDone, remarks),
          serviceDate: new Date().toISOString(),
        });
      }

      await this.loadJobOrders();
      this.successMessage = 'Job order moved to cashier for payment.';
      this.selectedJobOrder = this.jobOrders.find((job) => Number(job.id) === Number(this.selectedJobOrder?.id)) ?? this.selectedJobOrder;
    } catch {
      this.errorMessage = 'Unable to move job order to cashier for payment.';
    } finally {
      this.isUpdatingJobOrder = false;
    }
  }

  closeCreateDrawer(saveDraft = true) {
    this.showModal = false;
    if (saveDraft) {
      this.saveCreateDraft();
    }
  }

  discardCreateDrawer() {
    this.showModal = false;
    this.resetCreationForm();
  }

  closeDetailsDrawer() {
    this.showDrawer = false;
    this.showApprovalDrawer = false;
    this.selectedJobOrder = null;
    this.editableJobOrder = null;
    this.jobsDoneInput = '';
    this.remarksInput = '';
    this.mechanicSignatoryName = '';
    this.approvalCustomerName = '';
    this.approvalSummaryNotes = '';
    this.approvalSignaturePad = null;
    this.mechanicSignaturePad = null;
  }

  getJobOrderAmount(job: any): number {
    const laborAmount = Number(job?.billingPrice ?? 0) || 0;
    const suppliesAmount = Array.isArray(job?.supplies)
      ? job.supplies.reduce((sum: number, supply: any) => {
          const quantity = Number(supply?.quantity ?? 0) || 0;
          const billingPrice = Number(supply?.billingPrice ?? 0) || 0;
          return sum + quantity * billingPrice;
        }, 0)
      : 0;

    return laborAmount + suppliesAmount;
  }

  getDisplayedJobOrdersTotal(): number {
    return this.getDisplayedJobOrders().reduce((sum, job) => sum + this.getJobOrderAmount(job), 0);
  }

  formatCurrency(value: number): string {
    return `₱${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  isCustomerApproved(job: any): boolean {
    const approvedAt = String(job?.customerApprovedAt ?? '').trim();
    if (approvedAt) {
      return true;
    }

    const approval = this.parseCustomerApproval(job?.customerReview);
    return !!approval?.['approvedAt'];
  }

  getApprovalStatusLabel(job: any): string {
    return this.isCustomerApproved(job) ? 'Approved' : 'Pending Approval';
  }

  getEditableSuppliesTotal(): number {
    if (!this.editableJobOrder) {
      return 0;
    }

    return this.editableJobOrder.supplies.reduce((sum, supply) => {
      const quantity = Number(supply?.quantity ?? 0) || 0;
      const billingPrice = Number(supply?.billingPrice ?? 0) || 0;
      return sum + quantity * billingPrice;
    }, 0);
  }

  getEditableJobOrderTotal(): number {
    if (!this.editableJobOrder) {
      return 0;
    }

    const laborAmount = Number(this.editableJobOrder.billingPrice ?? 0) || 0;
    return laborAmount + this.getEditableSuppliesTotal();
  }

  clearApprovalSignature() {
    this.approvalSignaturePad?.clear();
  }

  async clearCustomerApproval() {
    if (!this.selectedJobOrder?.id || this.isUpdatingJobOrderDetails) {
      return;
    }

    if (!this.isPendingStatus(this.selectedJobOrder)) {
      this.errorMessage = 'Approval can only be cleared while job order status is Pending.';
      return;
    }

    this.isUpdatingJobOrderDetails = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.api.updateJobOrder(Number(this.selectedJobOrder.id), {
        customerApprovalSummary: null,
        customerSignatureData: null,
        customerApprovedBy: null,
        customerApprovedAt: null,
      });

      this.approvalCustomerName = this.getCustomerName(this.selectedJobOrder) === '-' ? '' : this.getCustomerName(this.selectedJobOrder);
      this.approvalSummaryNotes = '';
      this.approvalSignaturePad?.clear();

      await this.loadJobOrders();
      this.selectedJobOrder =
        this.jobOrders.find((job) => Number(job.id) === Number(this.selectedJobOrder?.id)) ??
        this.selectedJobOrder;
      this.successMessage = 'Customer approval signature and summary were cleared.';
    } catch {
      this.errorMessage = 'Unable to clear customer approval.';
    } finally {
      this.isUpdatingJobOrderDetails = false;
    }
  }

  clearInitialSignature() {
    this.createInitialSignaturePad?.clear();
  }

  clearMechanicSignature() {
    this.mechanicSignaturePad?.clear();
  }

  isInitialSignatoryReady(): boolean {
    return !!this.initialSignatoryName.trim() && !!this.createInitialSignaturePad && !this.createInitialSignaturePad.isEmpty();
  }

  openApprovalDrawer() {
    if (!this.selectedJobOrder) {
      return;
    }

    this.approvalCustomerName = this.getCustomerName(this.selectedJobOrder) === '-' ? '' : this.getCustomerName(this.selectedJobOrder);
    const summary = this.parseCustomerApproval(this.selectedJobOrder?.customerApprovalSummary);
    this.approvalSummaryNotes = String(summary?.['notes'] ?? '').trim();
    this.showApprovalDrawer = true;
    this.approvalSignaturePad = null;
  }

  closeApprovalDrawer() {
    this.showApprovalDrawer = false;
  }

  getApprovedSignatureDataUrl(job: any): string {
    const direct = String(job?.customerSignatureData ?? '').trim();
    if (direct) {
      return direct;
    }

    const summary = this.parseCustomerApproval(job?.customerApprovalSummary);
    const fromSummary = String(summary?.['signatureDataUrl'] ?? '').trim();
    if (fromSummary) {
      return fromSummary;
    }

    const legacy = this.parseCustomerApproval(job?.customerReview);
    return String(legacy?.['signatureDataUrl'] ?? '').trim();
  }

  async approveJobOrderByCustomer() {
    if (!this.selectedJobOrder?.id || !this.editableJobOrder || this.isUpdatingJobOrderDetails) {
      return;
    }

    const customerName = this.approvalCustomerName.trim();
    if (!customerName) {
      this.errorMessage = 'Customer name is required for approval.';
      return;
    }

    if (!this.approvalSignaturePad || this.approvalSignaturePad.isEmpty()) {
      this.errorMessage = 'Customer signature is required before approval.';
      return;
    }

    this.isUpdatingJobOrderDetails = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const suppliesSummary = this.editableJobOrder.supplies.map((supply) => ({
        supplyType: supply.supplyType,
        description: String(supply.description ?? '').trim() || 'Supply item',
        quantity: Number(supply.quantity ?? 0) || 0,
        billingPrice: Number(supply.billingPrice ?? 0) || 0,
        lineTotal: (Number(supply.quantity ?? 0) || 0) * (Number(supply.billingPrice ?? 0) || 0),
      }));

      const approvalPayload = {
        approvedAt: new Date().toISOString(),
        customerName,
        vehicle: this.getVehicleLabel(this.selectedJobOrder),
        description: this.editableJobOrder.description,
        laborAmount: Number(this.editableJobOrder.billingPrice ?? 0) || 0,
        supplies: suppliesSummary,
        totalAmount: this.getEditableJobOrderTotal(),
        notes: this.approvalSummaryNotes.trim() || null,
        signatureDataUrl: this.getOptimizedSignaturePngDataUrl(),
      };

      await this.api.updateJobOrder(Number(this.selectedJobOrder.id), {
        customerApprovalSummary: approvalPayload,
        customerSignatureData: approvalPayload.signatureDataUrl,
        customerApprovedBy: customerName,
        customerApprovedAt: approvalPayload.approvedAt,
        status: 'IN_PROGRESS',
      });

      await this.loadJobOrders();
      this.selectedJobOrder =
        this.jobOrders.find((job) => Number(job.id) === Number(this.selectedJobOrder?.id)) ??
        this.selectedJobOrder;
      this.successMessage = 'Job order approved by customer and moved to In Progress.';
    } catch {
      this.errorMessage = 'Unable to save customer approval.';
    } finally {
      this.isUpdatingJobOrderDetails = false;
    }
  }

  private saveCreateDraft() {
    return;
  }

  private loadCreateDraft() {
    return;
  }

  private clearCreateDraft() {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(this.createJobOrderDraftKey);
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
    return status === 'IN_PROGRESS' && this.isCustomerApproved(job);
  }

  canEditMechanicCompletion(job: any): boolean {
    return String(job?.status ?? '').trim().toUpperCase() === 'IN_PROGRESS';
  }

  isPendingStatus(job: any): boolean {
    const status = String(job?.status ?? '').trim().toUpperCase();
    return status === 'PENDING';
  }

  canEditCustomerApproval(job: any): boolean {
    return !this.isCustomerApproved(job);
  }

  canClearCustomerApproval(job: any): boolean {
    return this.isPendingStatus(job) && this.hasCustomerApprovalData(job);
  }

  hasCustomerApprovalData(job: any): boolean {
    const summary = this.parseCustomerApproval(job?.customerApprovalSummary);
    return !!summary ||
      !!String(job?.customerSignatureData ?? '').trim() ||
      !!String(job?.customerApprovedAt ?? '').trim() ||
      !!String(job?.customerApprovedBy ?? '').trim();
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

  getMechanicName(job: any): string {
    const direct = String(job?.technician?.name ?? '').trim();
    if (direct) {
      return direct;
    }

    const technicianId = Number(job?.technicianId ?? job?.technician_id ?? 0);
    if (!technicianId) {
      return '-';
    }

    const matched = this.technicians.find((tech) => Number(tech?.id) === technicianId);
    return String(matched?.name ?? '-');
  }

  getInitialSignatory(job: any): { name: string; signedAt: string; signatureDataUrl: string } | null {
    const raw = this.parseCustomerApproval(job?.customerReview);
    if (!raw) {
      return null;
    }

    const name = String(raw['initialSignatoryName'] ?? '').trim();
    const signedAt = String(raw['initialSignedAt'] ?? '').trim();
    const signatureDataUrl = String(raw['initialSignatureDataUrl'] ?? '').trim();

    if (!name && !signedAt && !signatureDataUrl) {
      return null;
    }

    return {
      name: name || '-',
      signedAt,
      signatureDataUrl,
    };
  }

  getMechanicSignoff(job: any): { name: string; signedAt: string; signatureDataUrl: string } | null {
    const name = String(job?.mechanicSignatoryName ?? '').trim();
    const signedAt = String(job?.mechanicSignedAt ?? '').trim();
    const signatureDataUrl = String(job?.mechanicSignatureData ?? '').trim();

    if (!name && !signedAt && !signatureDataUrl) {
      return null;
    }

    return {
      name: name || '-',
      signedAt,
      signatureDataUrl,
    };
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

  getMilestoneTasks(tasks: unknown): string[] {
    if (Array.isArray(tasks)) {
      return tasks.map((task) => String(task).trim()).filter(Boolean);
    }

    const raw = String(tasks ?? '').trim();
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((task) => String(task).trim()).filter(Boolean);
      }
    } catch {
      // Ignore parse errors and fall back to simple text splitting.
    }

    return raw
      .split(/\r?\n|,/)
      .map((task) => task.replace(/^['"\[\]]+|['"\[\]]+$/g, '').trim())
      .filter(Boolean);
  }

  getReviewPlate(): string {
    if (this.selectedVehicle?.plateNumber) {
      return String(this.selectedVehicle.plateNumber);
    }
    return this.plateSearchInput.trim() || '-';
  }

  getReviewMakeModel(): string {
    const make = String(this.selectedVehicle?.make ?? this.newVehicleDraft.make).trim();
    const model = String(this.selectedVehicle?.model ?? this.newVehicleDraft.model).trim();
    const value = [make, model].filter(Boolean).join(' ');
    return value || '-';
  }

  getReviewCustomerName(): string {
    const name = String(this.selectedCustomer?.name ?? this.newCustomerDraft.name).trim();
    return name || '-';
  }

  isNextDisabled(): boolean {
    if (this.currentStep === 'vehicle') {
      if (this.plateSearchStatus === 'idle') {
        return true;
      }
      if (this.plateSearchStatus === 'not-found') {
        return !this.newVehicleDraft.make.trim() || !this.newVehicleDraft.model.trim();
      }
      return false;
    }

    if (this.currentStep === 'customer' && this.plateSearchStatus === 'not-found') {
      return !this.newCustomerDraft.name.trim() || !this.newCustomerDraft.contact.trim();
    }

    if (this.currentStep === 'job-orders') {
      return this.jobOrdersList.some((job) => !job.description.trim());
    }

    if (this.currentStep === 'review') {
      return !this.isInitialSignatoryReady();
    }

    return false;
  }

  private buildProgressNotes(jobsDone: string, remarks: string): string {
    return [`Jobs Done: ${jobsDone || '-'}`, `Remarks: ${remarks || '-'}`].join('\n');
  }

  private getLatestProgressNotes(job: any): string {
    const latestService = Array.isArray(job?.services) && job.services.length > 0
      ? [...job.services].sort(
          (a, b) =>
            new Date(b?.serviceDate ?? 0).getTime() - new Date(a?.serviceDate ?? 0).getTime(),
        )[0]
      : null;

    return String(latestService?.notes ?? '');
  }

  private hasProgressChanged(jobsDone: string, remarks: string): boolean {
    return jobsDone !== String(this.selectedJobOrder?.jobsDone ?? '').trim() ||
      remarks !== String(this.selectedJobOrder?.serviceRemarks ?? '').trim();
  }

  private getMechanicSignatureDataForSave(): string | null {
    if (this.mechanicSignaturePad && !this.mechanicSignaturePad.isEmpty()) {
      return this.getOptimizedMechanicSignaturePngDataUrl();
    }

    const existing = String(this.selectedJobOrder?.mechanicSignatureData ?? '').trim();
    return existing || null;
  }

  private extractTaggedNote(notes: string, tag: 'Jobs Done' | 'Remarks'): string {
    const pattern = new RegExp(`${tag}:\\s*(.*)`, 'i');
    const match = notes.match(pattern);
    return String(match?.[1] ?? '').trim();
  }

  private normalizePlateNumber(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private getOptimizedSignaturePngDataUrl(): string {
    const fallback = this.approvalSignaturePad?.toDataURL('image/png') ?? '';

    if (typeof document === 'undefined' || !this.approvalSignatureCanvas) {
      return fallback;
    }

    const sourceCanvas = this.approvalSignatureCanvas.nativeElement;
    if (!sourceCanvas.width || !sourceCanvas.height) {
      return fallback;
    }

    const maxExportWidth = 900;
    const scale = Math.min(1, maxExportWidth / sourceCanvas.width);

    if (scale >= 1) {
      return fallback;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    exportCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));

    const context = exportCanvas.getContext('2d');
    if (!context) {
      return fallback;
    }

    context.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    return exportCanvas.toDataURL('image/png');
  }

  private initializeApprovalSignaturePad() {
    if (!this.showDrawer || !this.selectedJobOrder || !this.approvalSignatureCanvas || typeof window === 'undefined') {
      return;
    }

    const canvas = this.approvalSignatureCanvas.nativeElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = canvas.offsetWidth || 600;
    const height = canvas.offsetHeight || 180;

    if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
      const existingSignature = this.approvalSignaturePad && !this.approvalSignaturePad.isEmpty()
        ? this.approvalSignaturePad.toDataURL('image/png')
        : null;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const context = canvas.getContext('2d');
      if (context) {
        context.scale(ratio, ratio);
      }

      this.approvalSignaturePad = new SignaturePad(canvas, {
        minWidth: 1,
        maxWidth: 2.5,
      });

      if (existingSignature) {
        this.approvalSignaturePad.fromDataURL(existingSignature);
      }
      return;
    }

    if (!this.approvalSignaturePad) {
      this.approvalSignaturePad = new SignaturePad(canvas, {
        minWidth: 1,
        maxWidth: 2.5,
      });

      const existingSignature = this.getApprovedSignatureDataUrl(this.selectedJobOrder);
      if (existingSignature) {
        this.approvalSignaturePad.fromDataURL(existingSignature);
      }
    }
  }

  private initializeCreateSignaturePad() {
    if (!this.showModal || this.currentStep !== 'review' || !this.createInitialSignatureCanvas || typeof window === 'undefined') {
      return;
    }

    const canvas = this.createInitialSignatureCanvas.nativeElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = canvas.offsetWidth || 600;
    const height = canvas.offsetHeight || 180;

    if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
      const existingSignature = this.createInitialSignaturePad && !this.createInitialSignaturePad.isEmpty()
        ? this.createInitialSignaturePad.toDataURL('image/png')
        : null;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const context = canvas.getContext('2d');
      if (context) {
        context.scale(ratio, ratio);
      }

      this.createInitialSignaturePad = new SignaturePad(canvas, {
        minWidth: 1,
        maxWidth: 2.5,
      });

      if (existingSignature) {
        this.createInitialSignaturePad.fromDataURL(existingSignature);
      }
      return;
    }

    if (!this.createInitialSignaturePad) {
      this.createInitialSignaturePad = new SignaturePad(canvas, {
        minWidth: 1,
        maxWidth: 2.5,
      });
    }
  }

  private getOptimizedMechanicSignaturePngDataUrl(): string {
    const fallback = this.mechanicSignaturePad?.toDataURL('image/png') ?? '';

    if (typeof document === 'undefined' || !this.mechanicSignatureCanvas) {
      return fallback;
    }

    const sourceCanvas = this.mechanicSignatureCanvas.nativeElement;
    if (!sourceCanvas.width || !sourceCanvas.height) {
      return fallback;
    }

    const maxExportWidth = 900;
    const scale = Math.min(1, maxExportWidth / sourceCanvas.width);

    if (scale >= 1) {
      return fallback;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    exportCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));

    const context = exportCanvas.getContext('2d');
    if (!context) {
      return fallback;
    }

    context.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    return exportCanvas.toDataURL('image/png');
  }

  private initializeMechanicSignaturePad() {
    if (!this.showDrawer || !this.selectedJobOrder || !this.mechanicSignatureCanvas || typeof window === 'undefined') {
      return;
    }

    const canvas = this.mechanicSignatureCanvas.nativeElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = canvas.offsetWidth || 600;
    const height = canvas.offsetHeight || 180;

    if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
      const existingSignature = this.mechanicSignaturePad && !this.mechanicSignaturePad.isEmpty()
        ? this.mechanicSignaturePad.toDataURL('image/png')
        : String(this.selectedJobOrder?.mechanicSignatureData ?? '').trim() || null;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const context = canvas.getContext('2d');
      if (context) {
        context.scale(ratio, ratio);
      }

      this.mechanicSignaturePad = new SignaturePad(canvas, {
        minWidth: 1,
        maxWidth: 2.5,
      });

      if (existingSignature) {
        this.mechanicSignaturePad.fromDataURL(existingSignature);
      }
      return;
    }

    if (!this.mechanicSignaturePad) {
      this.mechanicSignaturePad = new SignaturePad(canvas, {
        minWidth: 1,
        maxWidth: 2.5,
      });

      const existingSignature = String(this.selectedJobOrder?.mechanicSignatureData ?? '').trim();
      if (existingSignature) {
        this.mechanicSignaturePad.fromDataURL(existingSignature);
      }
    }
  }

  private parseCustomerApproval(raw: unknown): Record<string, unknown> | null {
    const value = String(raw ?? '').trim();
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  private buildEditableJobOrder(job: any): JobOrderEditForm {
    const technicianIdRaw = job?.technicianId ?? job?.technician_id ?? job?.technician?.id;
    const technicianId = technicianIdRaw != null ? Number(technicianIdRaw) : null;
    const billingPriceRaw = job?.billingPrice ?? job?.billing_price;
    const billingPrice = billingPriceRaw != null && billingPriceRaw !== ''
      ? Number(billingPriceRaw)
      : null;
    const supplies = Array.isArray(job?.supplies)
      ? job.supplies.map((supply: any) => ({
          supplyType: this.normalizeSupplyType(supply?.supplyType ?? supply?.supply_type),
          inventoryId: supply?.inventoryId != null ? Number(supply.inventoryId) : (supply?.inventory_id != null ? Number(supply.inventory_id) : undefined),
          description: String(supply?.description ?? '').trim(),
          quantity: Number(supply?.quantity ?? 1) || 1,
          costPrice: supply?.costPrice != null ? Number(supply.costPrice) : (supply?.cost_price != null ? Number(supply.cost_price) : undefined),
          billingPrice: supply?.billingPrice != null ? Number(supply.billingPrice) : (supply?.billing_price != null ? Number(supply.billing_price) : undefined),
        }))
      : [];

    return {
      id: Number(job?.id ?? 0),
      technicianId,
      description: String(job?.description ?? '').trim(),
      status: String(job?.status ?? 'PENDING').trim().toUpperCase(),
      billingPrice: Number.isFinite(billingPrice) ? billingPrice : null,
      supplies,
    };
  }

  private getOptimizedCreateSignaturePngDataUrl(): string {
    const fallback = this.createInitialSignaturePad?.toDataURL('image/png') ?? '';

    if (typeof document === 'undefined' || !this.createInitialSignatureCanvas) {
      return fallback;
    }

    const sourceCanvas = this.createInitialSignatureCanvas.nativeElement;
    if (!sourceCanvas.width || !sourceCanvas.height) {
      return fallback;
    }

    const maxExportWidth = 900;
    const scale = Math.min(1, maxExportWidth / sourceCanvas.width);

    if (scale >= 1) {
      return fallback;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    exportCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));

    const context = exportCanvas.getContext('2d');
    if (!context) {
      return fallback;
    }

    context.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    return exportCanvas.toDataURL('image/png');
  }

  private normalizeSupplyType(value: unknown): 'inventory' | 'customer_provided' | 'external_expense' {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'customer_provided') {
      return 'customer_provided';
    }
    if (normalized === 'external_expense') {
      return 'external_expense';
    }
    return 'inventory';
  }

  private applyInventoryPricingToSupply(supply: SupplyItem, inventoryItem: any) {
    supply.description = String(inventoryItem?.partName ?? inventoryItem?.name ?? '').trim();

    const costPriceRaw = inventoryItem?.costPrice ?? inventoryItem?.cost_price;
    const srpPriceRaw = inventoryItem?.srpPrice ?? inventoryItem?.srp_price;

    const costPrice = costPriceRaw != null && String(costPriceRaw).trim() !== ''
      ? Number(costPriceRaw)
      : null;
    const srpPrice = srpPriceRaw != null && String(srpPriceRaw).trim() !== ''
      ? Number(srpPriceRaw)
      : null;

    if (Number.isFinite(costPrice)) {
      supply.costPrice = Number(costPrice);
    }

    if (Number.isFinite(srpPrice)) {
      supply.billingPrice = Number(srpPrice);
    } else if (Number.isFinite(costPrice)) {
      supply.billingPrice = Number(costPrice);
    }
  }
}
