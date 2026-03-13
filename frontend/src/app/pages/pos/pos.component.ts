import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  sales: any[] = [];
  jobOrders: any[] = [];
  inventoryItems: any[] = [];
  invoices: any[] = [];
  isLoading = false;
  isSubmitting = false;
  selectedJobOrderId: number | null = null;
  errorMessage = '';
  successMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadSales();
    void this.loadLookups();
  }

  async loadLookups() {
    try {
      const [jobOrdersResponse, inventoryResponse, invoicesResponse] = await Promise.all([
        this.api.getJobOrders(),
        this.api.getInventory(),
        this.api.getInvoices(),
      ]);
      const allJobOrders = Array.isArray(jobOrdersResponse.data) ? jobOrdersResponse.data : [];
      this.jobOrders = allJobOrders.filter(
        (jobOrder) => String(jobOrder?.status ?? '').trim().toUpperCase() === 'FOR_PAYMENT',
      );
      this.inventoryItems = Array.isArray(inventoryResponse.data) ? inventoryResponse.data : [];
      this.invoices = Array.isArray(invoicesResponse.data) ? invoicesResponse.data : [];
    } catch {
      this.jobOrders = [];
      this.inventoryItems = [];
      this.invoices = [];
    }
  }

  async loadSales() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getSales();
      this.sales = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load sales';
    } finally {
      this.isLoading = false;
    }
  }

  async createSale(event: Event) {
    event.preventDefault();
    if (this.isSubmitting) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    if (this.jobOrders.length === 0) {
      this.errorMessage = 'No job orders are ready for payment.';
      return;
    }

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const selectedJobOrderId = Number(formData.get('jobOrderId') ?? this.selectedJobOrderId ?? this.jobOrders[0]?.id ?? 0);
    const amount = Number(formData.get('amount') ?? 0);
    const inventoryIdValue = String(formData.get('inventoryId') ?? '').trim();
    const invoiceIdValue = String(formData.get('invoiceId') ?? '').trim();
    const selectedInvoiceId = invoiceIdValue ? Number(invoiceIdValue) : null;

    if (!selectedJobOrderId) {
      this.errorMessage = 'Please select a job order to proceed with payment.';
      return;
    }

    if (!amount || amount <= 0) {
      this.errorMessage = 'Amount must be greater than zero.';
      return;
    }

    this.isSubmitting = true;

    try {
      const payload = {
        amount,
        jobOrderId: selectedJobOrderId,
        inventoryId: inventoryIdValue ? Number(inventoryIdValue) : null,
        invoiceId: selectedInvoiceId,
      };

      await this.api.createSale(payload);

      await this.api.updateJobOrder(selectedJobOrderId, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      });

      if (selectedInvoiceId) {
        await this.api.updateInvoice(selectedInvoiceId, {
          status: 'PAID',
          paidAt: new Date().toISOString(),
        });
      }

      await this.loadSales();
      await this.loadLookups();
      this.closePanels();
      form.reset();
      this.successMessage = selectedInvoiceId
        ? 'Payment recorded, invoice marked as paid, and job order marked as completed.'
        : 'Payment recorded and job order marked as completed.';
    } catch {
      this.errorMessage = 'Unable to complete checkout. Please review payment details.';
    } finally {
      this.isSubmitting = false;
    }
  }

  openModal() {
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedJobOrderId = this.jobOrders[0]?.id ?? null;
    this.showModal = true;
  }

  openModalForJobOrder(jobOrderId: number) {
    this.selectedJobOrderId = jobOrderId;
    this.openModal();
  }

  updateSelectedJobOrder(value: string) {
    this.selectedJobOrderId = value ? Number(value) : null;
  }

  openDrawer() {
    this.showDrawer = true;
  }

  closePanels() {
    this.showModal = false;
    this.showDrawer = false;
    this.selectedJobOrderId = null;
  }

  getJobOrderLabel(jobOrder: any): string {
    const id = Number(jobOrder?.id ?? 0);
    const plate = String(jobOrder?.vehicle?.plateNumber ?? '').trim();
    const customer = String(jobOrder?.vehicle?.customer?.name ?? '').trim();

    const detailParts = [plate, customer].filter(Boolean).join(' • ');
    if (detailParts) {
      return `JO-${id} • ${detailParts}`;
    }

    return id ? `JO-${id}` : 'Job Order';
  }

  getSelectedJobOrder(): any | null {
    if (!this.selectedJobOrderId) {
      return this.jobOrders[0] ?? null;
    }
    return this.jobOrders.find((jobOrder) => Number(jobOrder?.id) === Number(this.selectedJobOrderId)) ?? null;
  }

  getAvailableInvoices(): any[] {
    const selectedJobOrder = this.getSelectedJobOrder();
    if (!selectedJobOrder?.id) {
      return this.invoices;
    }

    const matchedInvoices = this.invoices.filter(
      (invoice) => Number(invoice?.jobOrderId ?? 0) === Number(selectedJobOrder.id),
    );

    return matchedInvoices.length > 0 ? matchedInvoices : this.invoices;
  }

  getSaleJobOrderLabel(sale: any): string {
    const jobOrder = sale?.jobOrder;
    if (!jobOrder) {
      return sale?.jobOrderId ? `JO-${sale.jobOrderId}` : '-';
    }
    return this.getJobOrderLabel(jobOrder);
  }

  getSaleCustomerLabel(sale: any): string {
    const customerName = String(sale?.jobOrder?.vehicle?.customer?.name ?? '').trim();
    return customerName || '-';
  }

  getSaleInventoryLabel(sale: any): string {
    const partName = String(sale?.inventory?.partName ?? '').trim();
    return partName || '-';
  }

  getSaleInvoiceLabel(sale: any): string {
    const invoiceId = Number(sale?.invoice?.id ?? sale?.invoiceId ?? 0);
    return invoiceId ? `INV-${invoiceId}` : '-';
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
}
