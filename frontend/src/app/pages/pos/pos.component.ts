import { Component, HostListener, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

interface PaymentFormState {
  invoiceId: string;
  amountPaid: string;
  modeOfPayment: string;
  referenceNumber: string;
  paymentDate: string;
  receivedBy: string;
  notes: string;
}

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
  styles: [`
    .receipt-sheet {
      width: 9.5in;
      height: 5.3in;
      overflow: hidden;
    }

    .receipt-side-panel {
      display: flex;
      flex-direction: column;
      gap: 0.03in;
      font-size: 7px;
      line-height: 1.05;
    }

    .receipt-side-panel p {
      margin: 0;
    }

    .receipt-signature-slot {
      height: 0.26in;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .receipt-signature-slot img {
      max-height: 0.22in;
      max-width: 100%;
      object-fit: contain;
      display: block;
    }

    .receipt-line {
      border-bottom: 1px solid #000;
      height: 0.05in;
    }

    .receipt-meta-grid {
      line-height: 1.2;
    }

    .receipt-preview-viewport {
      background: linear-gradient(180deg, #eef2f7 0%, #dde4ee 100%);
    }

    .receipt-preview-stage {
      background: #f8fafc;
    }

    @media print {
      html,
      body {
        margin: 0 !important;
        padding: 0 !important;
      }

      body * {
        visibility: hidden;
      }

      .receipt-print-shell,
      .receipt-print-shell * {
        visibility: visible;
      }

      .receipt-print-shell {
        position: absolute;
        left: 0;
        top: 0;
        width: 9.5in;
        height: 5.3in;
        margin: 0;
        padding: 0;
        background: #fff;
        overflow: hidden;
        box-shadow: none;
        border-radius: 0;
      }

      .no-print {
        display: none !important;
      }

      .receipt-preview-viewport,
      .receipt-preview-stage {
        background: transparent !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: 0 !important;
      }

      @page {
        size: 9.5in 5.5in;
        margin: 0.1in;
      }
    }
  `],
})
export class PosComponent implements OnInit {
  private readonly receiptRowCount = 10;
  private readonly receiptPreviewWidthPx = 9.5 * 96;
  private readonly receiptPreviewHeightPx = 5.3 * 96;

  showDrawer = false;
  showReceiptPreview = false;
  sales: any[] = [];
  jobOrders: any[] = [];
  invoices: any[] = [];
  isLoading = false;
  isSubmitting = false;
  selectedJobOrderId: number | null = null;
  isJobOrderSelectionLocked = false;
  receiptJobOrder: any | null = null;
  receiptPreviewScale = 1;
  showEmbeddedPdfViewer = false;
  embeddedPdfUrl: string | null = null;
  embeddedPdfSafeUrl: SafeResourceUrl | null = null;
  isGeneratingPdf = false;
  errorMessage = '';
  successMessage = '';

  paymentForm: PaymentFormState = this.createDefaultPaymentForm();

  constructor(
    private readonly api: CarShopApiService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    void this.loadSales();
    void this.loadLookups();
    this.updateReceiptPreviewScale();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateReceiptPreviewScale();
  }

  async loadLookups() {
    try {
      const [jobOrdersResponse, invoicesResponse] = await Promise.all([
        this.api.getJobOrders(),
        this.api.getInvoices(),
      ]);

      const allJobOrders = Array.isArray(jobOrdersResponse.data) ? jobOrdersResponse.data : [];
      this.jobOrders = allJobOrders.filter(
        (jobOrder) => String(jobOrder?.status ?? '').trim().toUpperCase() === 'FOR_PAYMENT',
      );
      this.invoices = Array.isArray(invoicesResponse.data) ? invoicesResponse.data : [];

      if (this.selectedJobOrderId && !this.getSelectedJobOrder()) {
        this.selectedJobOrderId = this.jobOrders[0]?.id ? Number(this.jobOrders[0].id) : null;
        this.syncPaymentFormWithSelection();
      }
    } catch {
      this.jobOrders = [];
      this.invoices = [];
    }
  }

  async loadSales() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const salesResponse = await this.api.getSales();
      this.sales = Array.isArray(salesResponse.data) ? salesResponse.data : [];
    } catch {
      this.errorMessage = 'Unable to load sales';
      this.sales = [];
    } finally {
      this.isLoading = false;
    }
  }

  async completeJobOrder(event: Event) {
    event.preventDefault();
    if (this.isSubmitting) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    const selectedJobOrder = this.getSelectedJobOrder();
    if (!selectedJobOrder?.id) {
      this.errorMessage = 'Please select a job order to proceed with payment.';
      return;
    }

    const totalAmount = this.getJobOrderTotal(selectedJobOrder);
    const amountPaid = Number(this.paymentForm.amountPaid ?? 0);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      this.errorMessage = 'Amount paid must be greater than zero.';
      return;
    }

    if (amountPaid < totalAmount) {
      this.errorMessage = 'Amount paid cannot be lower than the grand total.';
      return;
    }

    if (!this.paymentForm.modeOfPayment.trim()) {
      this.errorMessage = 'Mode of payment is required.';
      return;
    }

    const invoiceId = this.paymentForm.invoiceId.trim() ? Number(this.paymentForm.invoiceId) : null;
    const paymentDate = this.paymentForm.paymentDate || this.getTodayInputValue();
    const paymentDetails = {
      modeOfPayment: this.paymentForm.modeOfPayment.trim(),
      amountPaid: amountPaid.toFixed(2),
      referenceNumber: this.paymentForm.referenceNumber.trim() || null,
      paymentDate,
      receivedBy: this.paymentForm.receivedBy.trim() || null,
      notes: this.paymentForm.notes.trim() || null,
    };

    this.isSubmitting = true;

    try {
      await this.api.createSale({
        amount: amountPaid,
        jobOrderId: Number(selectedJobOrder.id),
        invoiceId,
      });

      await this.api.updateJobOrder(Number(selectedJobOrder.id), {
        status: 'COMPLETED',
        completedAt: new Date(`${paymentDate}T00:00:00`).toISOString(),
        paymentDetails,
      });

      if (invoiceId) {
        await this.api.updateInvoice(invoiceId, {
          status: 'PAID',
          paidAt: new Date(`${paymentDate}T00:00:00`).toISOString(),
        });
      }

      this.receiptJobOrder = {
        ...selectedJobOrder,
        status: 'COMPLETED',
        completedAt: new Date(`${paymentDate}T00:00:00`).toISOString(),
        paymentDetails,
      };

      await this.loadSales();
      await this.loadLookups();
      this.showDrawer = false;
      this.showReceiptPreview = true;
      this.updateReceiptPreviewScale();
      this.successMessage = 'Payment recorded and job order completed.';
    } catch {
      this.errorMessage = 'Unable to complete checkout. Please review payment details.';
    } finally {
      this.isSubmitting = false;
    }
  }

  openDrawer() {
    this.errorMessage = '';
    this.successMessage = '';
    this.isJobOrderSelectionLocked = false;
    this.selectedJobOrderId = this.jobOrders[0]?.id ? Number(this.jobOrders[0].id) : null;
    this.syncPaymentFormWithSelection();
    this.showDrawer = true;
  }

  openDrawerForJobOrder(jobOrderId: number) {
    this.isJobOrderSelectionLocked = true;
    this.selectedJobOrderId = jobOrderId;
    this.syncPaymentFormWithSelection();
    this.showDrawer = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  updateSelectedJobOrder(value: string) {
    this.selectedJobOrderId = value ? Number(value) : null;
    this.syncPaymentFormWithSelection();
  }

  updatePaymentField(field: keyof PaymentFormState, value: string) {
    this.paymentForm = {
      ...this.paymentForm,
      [field]: value,
    };
  }

  closePanels() {
    this.showDrawer = false;
    this.isJobOrderSelectionLocked = false;
    this.selectedJobOrderId = null;
    this.paymentForm = this.createDefaultPaymentForm();
  }

  closeReceiptPreview() {
    this.closeEmbeddedPdfViewer();
    this.showReceiptPreview = false;
    this.receiptJobOrder = null;
  }

  closeEmbeddedPdfViewer() {
    this.showEmbeddedPdfViewer = false;
    this.embeddedPdfSafeUrl = null;

    if (this.embeddedPdfUrl) {
      URL.revokeObjectURL(this.embeddedPdfUrl);
      this.embeddedPdfUrl = null;
    }
  }

  async printReceipt() {
    if (!this.receiptJobOrder) {
      this.errorMessage = 'No receipt data available.';
      return;
    }

    await this.openReceiptPdf(this.receiptJobOrder);
  }

  openReceiptFromSale(sale: any) {
    const receiptJobOrder = this.buildReceiptJobOrderFromSale(sale);
    if (!receiptJobOrder) {
      this.errorMessage = 'Receipt data is incomplete for this sale.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.receiptJobOrder = receiptJobOrder;
    this.showReceiptPreview = true;
    this.updateReceiptPreviewScale();
  }

  async reprintFromSale(sale: any) {
    const receiptJobOrder = this.buildReceiptJobOrderFromSale(sale);
    if (!receiptJobOrder) {
      this.errorMessage = 'Receipt data is incomplete for this sale.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.receiptJobOrder = receiptJobOrder;
    this.showReceiptPreview = false;
    this.updateReceiptPreviewScale();
    await this.printReceipt();
  }

  getReceiptPreviewFrameWidth(): number {
    return Math.round(this.receiptPreviewWidthPx * this.receiptPreviewScale);
  }

  getReceiptPreviewFrameHeight(): number {
    return Math.round(this.receiptPreviewHeightPx * this.receiptPreviewScale);
  }

  getReceiptPreviewZoomLabel(): string {
    return `${Math.round(this.receiptPreviewScale * 100)}%`;
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

  getJobOrderLaborAmount(jobOrder: any): number {
    return Number(jobOrder?.billingPrice ?? 0) || 0;
  }

  getJobOrderPartsTotal(jobOrder: any): number {
    return Array.isArray(jobOrder?.supplies)
      ? jobOrder.supplies.reduce((sum: number, supply: any) => {
          if (this.isCustomerProvidedSupply(supply)) {
            return sum;
          }

          const quantity = Number(supply?.quantity ?? 0) || 0;
          const billingPrice = Number(supply?.billingPrice ?? 0) || 0;
          return sum + quantity * billingPrice;
        }, 0)
      : 0;
  }

  getJobOrderTotal(jobOrder: any): number {
    return this.getJobOrderLaborAmount(jobOrder) + this.getJobOrderPartsTotal(jobOrder);
  }

  getReceiptRows(jobOrder: any): Array<{ code: string; description: string; quantity: string; amount: string }> {
    const rows = Array.isArray(jobOrder?.supplies)
      ? jobOrder.supplies
          .filter((supply: any) => !this.isCustomerProvidedSupply(supply))
          .slice(0, this.receiptRowCount)
          .map((supply: any, index: number) => ({
          code: String(supply?.inventoryId ?? supply?.inventory_id ?? index + 1),
          description: String(supply?.description ?? '').trim(),
          quantity: String(Number(supply?.quantity ?? 0) || 0),
          amount: this.formatCurrencyValue((Number(supply?.quantity ?? 0) || 0) * (Number(supply?.billingPrice ?? 0) || 0)),
        }))
      : [];

    while (rows.length < this.receiptRowCount) {
      rows.push({ code: '', description: '', quantity: '', amount: '' });
    }

    return rows;
  }

  getPaymentDetails(jobOrder: any): Record<string, unknown> | null {
    const raw = jobOrder?.paymentDetails;
    if (!raw) {
      return null;
    }

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
      } catch {
        return null;
      }
    }

    return typeof raw === 'object' ? raw as Record<string, unknown> : null;
  }

  private isCustomerProvidedSupply(supply: any): boolean {
    const supplyType = String(supply?.supplyType ?? supply?.supply_type ?? '').trim().toLowerCase();
    return supplyType === 'customer_provided';
  }

  private updateReceiptPreviewScale(): void {
    if (typeof window === 'undefined') {
      this.receiptPreviewScale = 1;
      return;
    }

    const availableWidth = Math.max(window.innerWidth - 160, 320);
    const availableHeight = Math.max(window.innerHeight - 220, 260);
    const widthScale = availableWidth / this.receiptPreviewWidthPx;
    const heightScale = availableHeight / this.receiptPreviewHeightPx;
    const scale = Math.min(1, widthScale, heightScale);

    this.receiptPreviewScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  getCustomerName(jobOrder: any): string {
    return String(jobOrder?.vehicle?.customer?.name ?? '').trim() || '-';
  }

  getCustomerAddress(jobOrder: any): string {
    return String(jobOrder?.vehicle?.customer?.address ?? '').trim() || '-';
  }

  getCustomerMobile(jobOrder: any): string {
    return String(jobOrder?.vehicle?.customer?.contact ?? '').trim() || '-';
  }

  getVehicleModel(jobOrder: any): string {
    const make = String(jobOrder?.vehicle?.make ?? '').trim();
    const model = String(jobOrder?.vehicle?.model ?? '').trim();
    return [make, model].filter(Boolean).join(' ') || '-';
  }

  getPlateNumber(jobOrder: any): string {
    return String(jobOrder?.vehicle?.plateNumber ?? '').trim() || '-';
  }

  getOdometer(jobOrder: any): string {
    const reading = Number(jobOrder?.vehicle?.odometerReading ?? 0);
    return Number.isFinite(reading) && reading > 0 ? `${reading.toLocaleString()} km` : '-';
  }

  getModeOfPayment(jobOrder: any): string {
    const paymentDetails = this.getPaymentDetails(jobOrder);
    return String(paymentDetails?.['modeOfPayment'] ?? '').trim() || '-';
  }

  getReleasedBy(jobOrder: any): string {
    const paymentDetails = this.getPaymentDetails(jobOrder);
    return String(paymentDetails?.['receivedBy'] ?? '').trim() || '-';
  }

  getTimeIn(jobOrder: any): string {
    return this.formatTimeValue(jobOrder?.created_at ?? jobOrder?.createdAt);
  }

  getTimeOut(jobOrder: any): string {
    return this.formatTimeValue(jobOrder?.completedAt ?? jobOrder?.completed_at ?? jobOrder?.saleCreatedAt);
  }

  getInitialCustomerSignature(jobOrder: any): string | null {
    const review = this.parseCustomerReview(jobOrder?.customerReview ?? jobOrder?.customer_review);
    const signature = String(review?.['initialSignatureDataUrl'] ?? '').trim();
    return signature || null;
  }

  getApprovedCustomerSignature(jobOrder: any): string | null {
    const signature = String(jobOrder?.customerSignatureData ?? jobOrder?.customer_signature_data ?? '').trim();
    return signature || null;
  }

  getMechanicSignature(jobOrder: any): string | null {
    const signature = String(jobOrder?.mechanicSignatureData ?? jobOrder?.mechanic_signature_data ?? '').trim();
    return signature || null;
  }

  getCustomerSignatureForAuthorization(jobOrder: any): string | null {
    return this.getInitialCustomerSignature(jobOrder) || this.getApprovedCustomerSignature(jobOrder);
  }

  getCustomerSignatureForRelease(jobOrder: any): string | null {
    return this.getApprovedCustomerSignature(jobOrder) || this.getInitialCustomerSignature(jobOrder);
  }

  getSupplyProviderMark(jobOrder: any, provider: 'car_expert' | 'customer'): string {
    const hasCustomerProvided = Array.isArray(jobOrder?.supplies)
      ? jobOrder.supplies.some((supply: any) => this.isCustomerProvidedSupply(supply))
      : false;

    if (provider === 'customer') {
      return hasCustomerProvided ? 'X' : ' ';
    }

    return hasCustomerProvided ? ' ' : 'X';
  }

  getReceiptDate(jobOrder: any): string {
    const paymentDetails = this.getPaymentDetails(jobOrder);
    const paymentDate = String(paymentDetails?.['paymentDate'] ?? '').trim();
    const value = paymentDate || String(jobOrder?.completedAt ?? jobOrder?.completed_at ?? jobOrder?.created_at ?? '').trim();
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }

  formatCurrency(value: number): string {
    return `₱${this.formatCurrencyValue(value)}`;
  }

  formatCurrencyValue(value: number): string {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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

  private buildReceiptJobOrderFromSale(sale: any): any | null {
    const jobOrder = sale?.jobOrder;
    if (!jobOrder?.id) {
      return null;
    }

    return {
      ...jobOrder,
      saleId: sale?.id ?? null,
      saleCreatedAt: sale?.createdAt ?? sale?.created_at ?? null,
      invoice: sale?.invoice ?? null,
    };
  }

  private async openReceiptPdf(jobOrder: any): Promise<void> {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const source = await this.waitForReceiptPdfSource();
    const sourceElement = source ?? this.createStandaloneReceiptElement(jobOrder);

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.background = '#fff';
    host.style.zIndex = '-1';

    const pageWidthIn = 11.69;
    const pageHeightIn = 8.27;
    const receiptWidthIn = 9.5;
    const receiptHeightIn = 5.3;
    const pxPerInch = 96;

    const pageWidthPx = pageWidthIn * pxPerInch;
    const pageHeightPx = pageHeightIn * pxPerInch;
    const receiptWidthPx = receiptWidthIn * pxPerInch;
    const receiptHeightPx = receiptHeightIn * pxPerInch;

    const scale = Math.min(pageWidthPx / receiptWidthPx, pageHeightPx / receiptHeightPx);
    const scaledWidth = receiptWidthPx * scale;
    const scaledHeight = receiptHeightPx * scale;
    const offsetLeft = (pageWidthPx - scaledWidth) / 2;
    const offsetTop = (pageHeightPx - scaledHeight) / 2;

    const page = document.createElement('div');
    page.style.position = 'relative';
    page.style.width = `${pageWidthIn}in`;
    page.style.height = `${pageHeightIn}in`;
    page.style.background = '#ffffff';
    page.style.overflow = 'hidden';

    const receiptWrapper = document.createElement('div');
    receiptWrapper.style.position = 'absolute';
    receiptWrapper.style.left = `${offsetLeft}px`;
    receiptWrapper.style.top = `${offsetTop}px`;
    receiptWrapper.style.width = `${receiptWidthPx}px`;
    receiptWrapper.style.height = `${receiptHeightPx}px`;
    receiptWrapper.style.transformOrigin = 'top left';
    receiptWrapper.style.transform = `scale(${scale})`;

    const clone = sourceElement.cloneNode(true) as HTMLElement;
    clone.style.width = `${receiptWidthIn}in`;
    clone.style.height = `${receiptHeightIn}in`;
    clone.style.margin = '0';
    clone.style.transform = 'none';

    receiptWrapper.appendChild(clone);
    page.appendChild(receiptWrapper);
    host.appendChild(page);
    document.body.appendChild(host);

    this.isGeneratingPdf = true;

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = (html2pdfModule as any).default ?? html2pdfModule;

      const fileName = `JO-${jobOrder?.id ?? 'receipt'}.pdf`;
      const worker = html2pdf()
        .set({
          margin: [0, 0, 0, 0],
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
          },
          jsPDF: {
            unit: 'in',
            format: 'a4',
            orientation: 'landscape',
          },
        })
        .from(page)
        .toPdf();

      await worker.get('pdf').then((pdf: any) => {
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);

        if (this.embeddedPdfUrl) {
          URL.revokeObjectURL(this.embeddedPdfUrl);
        }

        this.embeddedPdfUrl = blobUrl;
        this.embeddedPdfSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);
        this.showEmbeddedPdfViewer = true;
      });
    } catch {
      this.errorMessage = 'Unable to generate PDF receipt. Please try again.';
    } finally {
      this.isGeneratingPdf = false;
      document.body.removeChild(host);
    }
  }

  private createStandaloneReceiptElement(jobOrder: any): HTMLElement {
    const rowsHtml = this.getReceiptRows(jobOrder)
      .map((row) => `
        <tr>
          <td style="height:16px;border-bottom:1px solid #000;border-right:1px solid #000;padding:4px 6px;">${this.escapeHtml(row.code)}</td>
          <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:4px 6px;">${this.escapeHtml(row.description)}</td>
          <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:4px 6px;text-align:center;">${this.escapeHtml(row.quantity)}</td>
          <td style="border-bottom:1px solid #000;padding:4px 6px;text-align:right;">${this.escapeHtml(row.amount)}</td>
        </tr>
      `)
      .join('');

    const customerAuthorizationSignature = this.getCustomerSignatureForAuthorization(jobOrder);
    const mechanicSignature = this.getMechanicSignature(jobOrder);
    const customerReleaseSignature = this.getCustomerSignatureForRelease(jobOrder);

    const signatureBlock = (label: string, signature: string | null) => `
      <div style="text-align:center;font-weight:700;">${this.escapeHtml(label)}</div>
      <div style="height:24px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
        ${signature ? `<img src="${this.escapeAttribute(signature)}" alt="${this.escapeAttribute(label)}" style="max-height:20px;max-width:100%;object-fit:contain;display:block;" />` : ''}
      </div>
      <div style="border-bottom:1px solid #000;height:8px;"></div>
    `;

    const element = document.createElement('div');
    element.style.width = '9.5in';
    element.style.height = '5.3in';
    element.style.background = '#fff';
    element.style.color = '#000';
    element.style.fontSize = '9px';
    element.style.lineHeight = '1.2';
    element.style.border = '1px solid #000';
    element.innerHTML = `
      <div style="padding:10px 16px 0;text-align:center;">
        <div style="font-size:30px;font-weight:800;letter-spacing:.02em;">CAR EXPERT AUTO CARE CENTER CORP.</div>
        <div style="margin-top:4px;font-size:11px;font-weight:600;">PTT Talavera, Brgy. La Torre, Maharlika Highway, Talavera, Nueva Ecija</div>
        <div style="margin-top:2px;font-size:11px;">Contact Number: 09178884958</div>
      </div>

      <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #000;border-bottom:1px solid #000;background:#000;padding:4px 16px;color:#fff;">
        <div style="width:96px;"></div>
        <div style="font-size:30px;font-weight:700;letter-spacing:.02em;">JOB ORDER</div>
        <div style="font-size:20px;font-weight:700;">NO.${this.escapeHtml(String(jobOrder?.id ?? '-'))}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;padding:8px 16px;line-height:1.2;">
        <div><b>Customer's Name:</b> ${this.escapeHtml(this.getCustomerName(jobOrder))}</div>
        <div><b>Date:</b> ${this.escapeHtml(this.getReceiptDate(jobOrder))}</div>
        <div><b>Address:</b> ${this.escapeHtml(this.getCustomerAddress(jobOrder))}</div>
        <div><b>Vehicle Model:</b> ${this.escapeHtml(this.getVehicleModel(jobOrder))}</div>
        <div><b>Mobile Number:</b> ${this.escapeHtml(this.getCustomerMobile(jobOrder))}</div>
        <div><b>Plate Number:</b> ${this.escapeHtml(this.getPlateNumber(jobOrder))}</div>
        <div><b>Mode of Payment:</b> ${this.escapeHtml(this.getModeOfPayment(jobOrder))}</div>
        <div><b>Kilometer Reading:</b> ${this.escapeHtml(this.getOdometer(jobOrder))}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 2.2fr 1.4fr;height:3.72in;border-top:1px solid #000;">
        <div style="grid-column:1 / span 2;border-right:1px solid #000;">
          <div style="border-bottom:1px solid #000;background:#000;padding:4px 8px;text-align:center;font-size:14px;font-weight:700;color:#fff;">PARTS, TIRES AND SUPPLIES</div>
          <table style="width:100%;border-collapse:collapse;font-size:9px;">
            <thead>
              <tr>
                <th style="border-bottom:1px solid #000;border-right:1px solid #000;padding:4px 6px;text-align:left;">ITEM CODE</th>
                <th style="border-bottom:1px solid #000;border-right:1px solid #000;padding:4px 6px;text-align:left;">PARTS DESCRIPTION</th>
                <th style="border-bottom:1px solid #000;border-right:1px solid #000;padding:4px 6px;text-align:center;">QUANTITY</th>
                <th style="border-bottom:1px solid #000;padding:4px 6px;text-align:right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;font-size:9px;">
            <tbody>
              <tr>
                <td style="border-right:1px solid #000;padding:4px 6px;font-weight:700;">TOTAL</td>
                <td style="padding:4px 6px;text-align:right;">${this.escapeHtml(this.formatCurrencyValue(this.getJobOrderPartsTotal(jobOrder)))}</td>
              </tr>
              <tr>
                <td style="border-right:1px solid #000;padding:4px 6px;font-weight:700;">LABOR</td>
                <td style="padding:4px 6px;text-align:right;">${this.escapeHtml(this.formatCurrencyValue(this.getJobOrderLaborAmount(jobOrder)))}</td>
              </tr>
              <tr>
                <td style="border-right:1px solid #000;padding:4px 6px;font-weight:700;">GRAND TOTAL</td>
                <td style="padding:4px 6px;text-align:right;font-weight:700;">${this.escapeHtml(this.formatCurrencyValue(this.getJobOrderTotal(jobOrder)))}</td>
              </tr>
              <tr>
                <td style="border-top:1px solid #000;border-right:1px solid #000;padding:4px 6px;font-weight:700;">REMARKS</td>
                <td style="border-top:1px solid #000;padding:4px 6px;">${this.escapeHtml(String(jobOrder?.serviceRemarks || '-'))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="display:flex;flex-direction:column;gap:3px;padding:6px 8px;font-size:7px;line-height:1.05;">
          <div style="border-bottom:1px solid #000;padding-bottom:4px;text-align:center;font-weight:700;">WARRANTY:</div>
          <p style="margin:0;">15 days or 500km (whichever comes first). No warranty will be given for parts supplied by customer.</p>
          <div style="font-weight:700;">PARTS SUPPLIES BY:</div>
          <div>(${this.escapeHtml(this.getSupplyProviderMark(jobOrder, 'car_expert'))}) CAR EXPERT</div>
          <div>(${this.escapeHtml(this.getSupplyProviderMark(jobOrder, 'customer'))}) CUSTOMER</div>
          <p style="margin:0;text-align:center;font-weight:700;line-height:1.1;">I authorized and agree to pay for repair and work to be done on my vehicle including all parts and materials necessary to perform them.</p>
          ${signatureBlock("Customer's Signature", customerAuthorizationSignature)}
          <div style="display:flex;justify-content:space-between;font-weight:700;"><span>TIME IN ${this.escapeHtml(this.getTimeIn(jobOrder))}</span><span>TIME OUT ${this.escapeHtml(this.getTimeOut(jobOrder))}</span></div>
          <div style="font-weight:700;">RELEASED BY: ${this.escapeHtml(this.getReleasedBy(jobOrder))} ( ) DCT</div>
          <p style="margin:0;text-align:center;font-weight:700;line-height:1.1;">NOTE: This job is based on our inspection but does not include defects not evident at the time of our inspection.</p>
          ${signatureBlock('Mechanic Signature', mechanicSignature)}
          <p style="margin:0;text-align:center;font-weight:700;line-height:1.1;">I hereby received above vehicle in good order and condition, I hereby certify that the repairs have been made to my entire satisfaction.</p>
          ${signatureBlock("Customer's Signature", customerReleaseSignature)}
        </div>
      </div>
    `;

    return element;
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value);
  }

  private async waitForReceiptPdfSource(): Promise<HTMLElement | null> {
    if (typeof document === 'undefined') {
      return null;
    }

    const maxAttempts = 20;
    const delayMs = 25;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const element = document.getElementById('receipt-pdf-source') as HTMLElement | null;
      if (element) {
        return element;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return null;
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

  private parseCustomerReview(raw: unknown): Record<string, unknown> | null {
    if (!raw) {
      return null;
    }

    if (typeof raw === 'object') {
      return raw as Record<string, unknown>;
    }

    const value = String(raw).trim();
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  private formatTimeValue(value: unknown): string {
    if (!value) {
      return '________';
    }

    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return '________';
    }

    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private syncPaymentFormWithSelection() {
    const selectedJobOrder = this.getSelectedJobOrder();
    const existingPaymentDetails = this.getPaymentDetails(selectedJobOrder);
    this.paymentForm = {
      invoiceId: this.getAvailableInvoices()[0]?.id ? String(this.getAvailableInvoices()[0].id) : '',
      amountPaid: selectedJobOrder ? String(this.getJobOrderTotal(selectedJobOrder).toFixed(2)) : '',
      modeOfPayment: String(existingPaymentDetails?.['modeOfPayment'] ?? 'Cash'),
      referenceNumber: String(existingPaymentDetails?.['referenceNumber'] ?? ''),
      paymentDate: String(existingPaymentDetails?.['paymentDate'] ?? this.getTodayInputValue()),
      receivedBy: String(existingPaymentDetails?.['receivedBy'] ?? ''),
      notes: String(existingPaymentDetails?.['notes'] ?? ''),
    };
  }

  private createDefaultPaymentForm(): PaymentFormState {
    return {
      invoiceId: '',
      amountPaid: '',
      modeOfPayment: 'Cash',
      referenceNumber: '',
      paymentDate: this.getTodayInputValue(),
      receivedBy: '',
      notes: '',
    };
  }

  private getTodayInputValue(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
