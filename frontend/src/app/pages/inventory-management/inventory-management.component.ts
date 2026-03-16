import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { RbacService } from '../../shared/services/rbac.service';

interface SupplierOption {
  id: number;
  name: string;
}

interface InventoryRow {
  id: number;
  partName: string;
  stockQty: number;
  lowStockThreshold: number;
  costPrice: number | null;
  srpPrice: number | null;
  supplierId: number | null;
  supplierName: string;
}

@Component({
  selector: 'app-inventory-management',
  standalone: true,
  imports: [CommonModule, FormsModule, PageBreadcrumbComponent],
  templateUrl: './inventory-management.component.html',
})
export class InventoryManagementComponent implements OnInit {
  inventory: InventoryRow[] = [];
  suppliers: SupplierOption[] = [];

  search = '';
  selectedSupplierFilter: number | 'all' = 'all';
  showLowStockOnly = false;
  page = 1;
  readonly pageSize = 10;

  showDrawer = false;
  drawerMode: 'create' | 'edit' = 'create';
  selectedItem: InventoryRow | null = null;
  form = this.createInitialForm();

  isLoading = false;
  isSaving = false;
  isDeletingIds = new Set<number>();
  errorMessage = '';

  constructor(
    private readonly api: CarShopApiService,
    private readonly rbacService: RbacService,
  ) {}

  ngOnInit(): void {
    void this.loadInventory();
    void this.loadSuppliers();
  }

  get canCreate(): boolean {
    return this.rbacService.canAccess('inventory', 'canCreate');
  }

  get canUpdate(): boolean {
    return this.rbacService.canAccess('inventory', 'canUpdate');
  }

  get canDelete(): boolean {
    return this.rbacService.canAccess('inventory', 'canDelete');
  }

  get filteredInventory(): InventoryRow[] {
    const keyword = this.search.trim().toLowerCase();

    return this.inventory.filter((item) => {
      if (this.selectedSupplierFilter !== 'all' && item.supplierId !== this.selectedSupplierFilter) {
        return false;
      }

      if (this.showLowStockOnly && !this.isLowStock(item)) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [
        item.partName,
        item.supplierName,
        String(item.stockQty),
        String(item.lowStockThreshold),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }

  get pagedInventory(): InventoryRow[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredInventory.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredInventory.length / this.pageSize));
  }

  get lowStockCount(): number {
    return this.inventory.filter((item) => this.isLowStock(item)).length;
  }

  get outOfStockCount(): number {
    return this.inventory.filter((item) => item.stockQty <= 0).length;
  }

  async loadSuppliers() {
    try {
      const response = await this.api.getSuppliers();
      const rows = Array.isArray(response.data) ? response.data : [];
      this.suppliers = rows.map((supplier: any) => ({
        id: Number(supplier.id),
        name: String(supplier.name ?? '').trim() || `Supplier #${supplier.id}`,
      }));
    } catch {
      this.suppliers = [];
    }
  }

  async loadInventory() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getInventory();
      const rows = Array.isArray(response.data) ? response.data : [];

      this.inventory = rows.map((item: any) => ({
        id: Number(item.id),
        partName: String(item.partName ?? '').trim(),
        stockQty: Number(item.stockQty ?? 0),
        lowStockThreshold: Number(item.lowStockThreshold ?? 0),
        costPrice: item.costPrice == null ? null : Number(item.costPrice),
        srpPrice: item.srpPrice == null ? null : Number(item.srpPrice),
        supplierId: item.supplierId == null ? null : Number(item.supplierId),
        supplierName: String(item.supplier?.name ?? '').trim(),
      }));
      this.page = 1;
    } catch {
      this.errorMessage = 'Unable to load inventory';
    } finally {
      this.isLoading = false;
    }
  }

  onFiltersChanged(): void {
    this.page = 1;
  }

  onPageChange(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages || nextPage === this.page) {
      return;
    }
    this.page = nextPage;
  }

  openCreateDrawer(): void {
    this.drawerMode = 'create';
    this.selectedItem = null;
    this.form = this.createInitialForm();
    this.errorMessage = '';
    this.showDrawer = true;
  }

  openEditDrawer(item: InventoryRow): void {
    this.drawerMode = 'edit';
    this.selectedItem = item;
    this.form = {
      supplierMode: 'existing',
      newSupplierName: '',
      partName: item.partName,
      stockQty: item.stockQty,
      lowStockThreshold: item.lowStockThreshold,
      costPrice: item.costPrice,
      srpPrice: item.srpPrice,
      supplierId: item.supplierId,
    };
    this.errorMessage = '';
    this.showDrawer = true;
  }

  closeDrawer(): void {
    if (this.isSaving) {
      return;
    }

    this.showDrawer = false;
    this.selectedItem = null;
    this.drawerMode = 'create';
    this.form = this.createInitialForm();
  }

  async submitInventoryForm(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    const partName = this.form.partName.trim();
    if (!partName) {
      this.errorMessage = 'Part name is required';
      return;
    }

    let supplierId: number | null = this.form.supplierId ? Number(this.form.supplierId) : null;

    if (this.form.supplierMode === 'new') {
      const supplierName = this.form.newSupplierName.trim();
      if (!supplierName) {
        this.errorMessage = 'Supplier name is required when creating a new supplier';
        return;
      }

      try {
        const createSupplierResponse = await this.api.createSupplier({ name: supplierName });
        const createdSupplier = createSupplierResponse?.data ?? createSupplierResponse;
        const createdSupplierId = Number(createdSupplier?.id);

        if (!Number.isFinite(createdSupplierId)) {
          this.errorMessage = 'Unable to create supplier';
          return;
        }

        supplierId = createdSupplierId;
      } catch {
        this.errorMessage = 'Unable to create supplier';
        return;
      }
    }

    const payload = {
      partName,
      stockQty: Number(this.form.stockQty ?? 0),
      lowStockThreshold: Number(this.form.lowStockThreshold ?? 0),
      costPrice: this.form.costPrice == null || this.form.costPrice === '' ? null : Number(this.form.costPrice),
      srpPrice: this.form.srpPrice == null || this.form.srpPrice === '' ? null : Number(this.form.srpPrice),
      supplierId,
    };

    this.isSaving = true;
    this.errorMessage = '';

    try {
      if (this.drawerMode === 'edit' && this.selectedItem) {
        await this.api.updateInventoryItem(this.selectedItem.id, payload);
      } else {
        await this.api.createInventoryItem(payload);
      }

      await this.loadSuppliers();
      await this.loadInventory();
      this.closeDrawer();
    } catch {
      this.errorMessage =
        this.drawerMode === 'edit'
          ? 'Unable to update inventory item'
          : 'Unable to create inventory item';
    } finally {
      this.isSaving = false;
    }
  }

  onSupplierModeChange(mode: 'existing' | 'new'): void {
    this.form.supplierMode = mode;

    if (mode === 'existing' && this.form.supplierId == null) {
      this.form.supplierId = this.suppliers[0]?.id ?? null;
    }

    if (mode === 'new') {
      this.form.supplierId = null;
    }
  }

  async deleteInventory(item: InventoryRow): Promise<void> {
    if (this.isDeletingIds.has(item.id)) {
      return;
    }

    const confirmed = window.confirm(`Delete inventory item "${item.partName}"?`);
    if (!confirmed) {
      return;
    }

    this.isDeletingIds.add(item.id);
    this.errorMessage = '';

    try {
      await this.api.deleteInventoryItem(item.id);
      await this.loadInventory();
    } catch {
      this.errorMessage = 'Unable to delete inventory item';
    } finally {
      this.isDeletingIds.delete(item.id);
    }
  }

  isLowStock(item: InventoryRow): boolean {
    return Number(item.stockQty ?? 0) <= Number(item.lowStockThreshold ?? 0);
  }

  private createInitialForm(): {
    supplierMode: 'existing' | 'new';
    newSupplierName: string;
    partName: string;
    stockQty: number;
    lowStockThreshold: number;
    costPrice: number | null | '';
    srpPrice: number | null | '';
    supplierId: number | null;
  } {
    return {
      supplierMode: 'existing',
      newSupplierName: '',
      partName: '',
      stockQty: 0,
      lowStockThreshold: 5,
      costPrice: null,
      srpPrice: null,
      supplierId: this.suppliers[0]?.id ?? null,
    };
  }
}
