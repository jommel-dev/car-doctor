import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { PurchaseOrderItem, PurchaseOrderService } from '../../shared/services/purchase-order.service';
import axios from 'axios';

type PurchaseTab = 'deliveries' | 'approvals' | 'master-data';

@Component({
  selector: 'app-purchase-order',
  imports: [CommonModule, FormsModule, PageBreadcrumbComponent],
  templateUrl: './purchase-order.component.html',
  styles: ``,
})
export class PurchaseOrderComponent implements OnInit, OnDestroy {
  activeTab: PurchaseTab = 'deliveries';
  isLoading = false;
  errorMessage = '';
  purchaseOrders: PurchaseOrderItem[] = [];
  search = '';
  page = 1;
  limit = 10;
  total = 0;
  totalPages = 1;
  isCreating = false;
  createError = '';
  createSuccess = '';
  createForm = {
    vendorId: '',
    vendorName: '',
    vendorAddress: '',
    vendorContactPerson: '',
    vendorContactNumber: '',

    paymentMethod: '',
    paymentAmount: 0,
    paymentTerms: '',
    paymentTermsDueDate: '',
    paymentStatus: 'unpaid',
    paymentDate: '',
    downPayment: 0,

    transType: 'purchase',
    productId: '',
    capacityId: '',
    unitPrice: 0,
    sellPrice: 0,
    discountPrice: 0,
    unitType: 'set',
    unitQty: 1,
    totalSetQty: 1,

    totalAmount: 0,
    status: 'pending',
  };
  private readonly searchDebounceMs = 300;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  ngOnInit(): void {
    void this.loadTabData(this.activeTab);
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  async setTab(tab: PurchaseTab): Promise<void> {
    if (this.activeTab === tab) {
      return;
    }

    this.activeTab = tab;
    this.page = 1;
    await this.loadTabData(tab);
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.page = 1;

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      void this.loadTabData(this.activeTab);
      this.searchDebounceTimer = null;
    }, this.searchDebounceMs);
  }

  onPageChange(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages || nextPage === this.page) {
      return;
    }

    this.page = nextPage;
    void this.loadTabData(this.activeTab);
  }

  async submitCreatePurchase(): Promise<void> {
    if (this.isCreating) {
      return;
    }

    this.isCreating = true;
    this.createError = '';
    this.createSuccess = '';

    try {
      const vendorId = this.createForm.vendorId.trim();
      const vendorName = this.createForm.vendorName.trim();

      const response = await this.purchaseOrderService.createPurchase({
        vendorId: vendorId || undefined,
        vendor: vendorId
          ? undefined
          : {
              name: vendorName,
              address: this.createForm.vendorAddress.trim() || undefined,
              contact_person:
                this.createForm.vendorContactPerson.trim() || undefined,
              contact_number:
                this.createForm.vendorContactNumber.trim() || undefined,
            },
        paymentDetails: {
          amount: Number(this.createForm.paymentAmount) || 0,
          method: this.createForm.paymentMethod.trim() || undefined,
          terms: this.createForm.paymentTerms.trim() || undefined,
          termsDueDate: this.createForm.paymentTermsDueDate || null,
          status: this.createForm.paymentStatus as 'unpaid' | 'paid' | 'partial',
          paymentDate: this.createForm.paymentDate || null,
          downPayment: Number(this.createForm.downPayment) || 0,
        },
        productItems: [
          {
            transType: this.createForm.transType,
            productId: this.createForm.productId.trim(),
            capacityId: this.createForm.capacityId.trim(),
            unitPrice: Number(this.createForm.unitPrice) || 0,
            sellPrice: Number(this.createForm.sellPrice) || 0,
            discountPrice: Number(this.createForm.discountPrice) || 0,
            unitTypesQty: [
              {
                unitType: this.createForm.unitType.trim() || 'set',
                qty: Number(this.createForm.unitQty) || 0,
              },
            ],
            totalSetQty: Number(this.createForm.totalSetQty) || 0,
            purchaseId: null,
            salesId: null,
          },
        ],
        totalAmount: Number(this.createForm.totalAmount) || 0,
        status: this.createForm.status.trim() || 'pending',
      });

      if (!response.success) {
        this.createError = response.message ?? 'Failed to create purchase request';
        return;
      }

      this.createSuccess = response.message ?? 'Purchase request created successfully';
      this.resetCreateForm();
      this.page = 1;
      await this.loadTabData(this.activeTab);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.createError =
          (error.response?.data as { message?: string } | undefined)?.message ??
          'Failed to create purchase request';
      } else {
        this.createError = 'Failed to create purchase request';
      }
    } finally {
      this.isCreating = false;
    }
  }

  private async loadTabData(tab: PurchaseTab): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    const query = {
      page: this.page,
      limit: this.limit,
      search: this.search.trim() || undefined,
    };

    try {
      if (tab === 'deliveries') {
        const result = await this.purchaseOrderService.getDeliveries(query);
        this.purchaseOrders = result.items;
        this.applyMeta(result.meta);
      } else if (tab === 'approvals') {
        const result = await this.purchaseOrderService.getApprovals(query);
        this.purchaseOrders = result.items;
        this.applyMeta(result.meta);
      } else {
        const result = await this.purchaseOrderService.getMasterData(query);
        this.purchaseOrders = result.items;
        this.applyMeta(result.meta);
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.errorMessage =
          (error.response?.data as { message?: string } | undefined)?.message ??
          'Unable to load purchase orders';
      } else {
        this.errorMessage = 'Unable to load purchase orders';
      }
      this.purchaseOrders = [];
      this.total = 0;
      this.totalPages = 1;
    } finally {
      this.isLoading = false;
    }
  }

  formatDate(value: string | null): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value ?? 0);
  }

  private applyMeta(meta?: { page: number; limit: number; total: number; totalPages: number }): void {
    if (!meta) {
      this.total = this.purchaseOrders.length;
      this.totalPages = 1;
      return;
    }

    this.page = meta.page;
    this.limit = meta.limit;
    this.total = meta.total;
    this.totalPages = Math.max(1, meta.totalPages || 1);
  }

  private resetCreateForm(): void {
    this.createForm = {
      vendorId: '',
      vendorName: '',
      vendorAddress: '',
      vendorContactPerson: '',
      vendorContactNumber: '',
      paymentMethod: '',
      paymentAmount: 0,
      paymentTerms: '',
      paymentTermsDueDate: '',
      paymentStatus: 'unpaid',
      paymentDate: '',
      downPayment: 0,
      transType: 'purchase',
      productId: '',
      capacityId: '',
      unitPrice: 0,
      sellPrice: 0,
      discountPrice: 0,
      unitType: 'set',
      unitQty: 1,
      totalSetQty: 1,
      totalAmount: 0,
      status: 'pending',
    };
  }
}
