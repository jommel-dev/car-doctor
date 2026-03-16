import { Injectable } from '@angular/core';
import { apiClient } from './api-client';

@Injectable({
  providedIn: 'root',
})
export class CarShopApiService {
  getDashboardOverview() {
    return apiClient.get('/dashboard/overview');
  }

  getCustomers() {
    return apiClient.get('/customers');
  }

  createCustomer(payload: Record<string, unknown>) {
    return apiClient.post('/customers', payload);
  }

  updateCustomer(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/customers/${id}`, payload);
  }

  getVehicles() {
    return apiClient.get('/vehicles');
  }

  createVehicle(payload: Record<string, unknown>) {
    return apiClient.post('/vehicles', payload);
  }

  updateVehicle(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/vehicles/${id}`, payload);
  }

  getJobOrders() {
    return apiClient.get('/job-orders');
  }

  createJobOrder(payload: Record<string, unknown>) {
    return apiClient.post('/job-orders', payload);
  }

  updateJobOrder(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/job-orders/${id}`, payload);
  }

  getServiceHistory() {
    return apiClient.get('/service-history');
  }

  createServiceHistory(payload: Record<string, unknown>) {
    return apiClient.post('/service-history', payload);
  }

  getInventory(filters?: { search?: string; supplierId?: number | null; lowStock?: boolean }) {
    const params: Record<string, string> = {};

    if (filters?.search?.trim()) {
      params['search'] = filters.search.trim();
    }

    if (filters?.supplierId && Number.isFinite(filters.supplierId)) {
      params['supplierId'] = String(filters.supplierId);
    }

    if (filters?.lowStock) {
      params['lowStock'] = 'true';
    }

    return apiClient.get('/inventory-items', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
  }

  createInventoryItem(payload: Record<string, unknown>) {
    return apiClient.post('/inventory-items', payload);
  }

  updateInventoryItem(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/inventory-items/${id}`, payload);
  }

  deleteInventoryItem(id: number) {
    return apiClient.delete(`/inventory-items/${id}`);
  }

  getLowStockInventory() {
    return apiClient.get('/inventory-items/alerts/low-stock');
  }

  getSuppliers() {
    return apiClient.get('/suppliers');
  }

  getPurchases() {
    return apiClient.get('/purchase');
  }

  createSupplier(payload: Record<string, unknown>) {
    return apiClient.post('/suppliers', payload);
  }

  getSales() {
    return apiClient.get('/pos/sales');
  }

  createSale(payload: Record<string, unknown>) {
    return apiClient.post('/pos/sales', payload);
  }

  getInvoices() {
    return apiClient.get('/invoices');
  }

  createInvoice(payload: Record<string, unknown>) {
    return apiClient.post('/invoices', payload);
  }

  updateInvoice(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/invoices/${id}`, payload);
  }

  getReceivables() {
    return apiClient.get('/accounts-receivable');
  }

  createReceivable(payload: Record<string, unknown>) {
    return apiClient.post('/accounts-receivable', payload);
  }

  getExpenses() {
    return apiClient.get('/expenses');
  }

  createExpense(payload: Record<string, unknown>) {
    return apiClient.post('/expenses', payload);
  }

  getPayables() {
    return apiClient.get('/accounts-payable');
  }

  createPayable(payload: Record<string, unknown>) {
    return apiClient.post('/accounts-payable', payload);
  }

  getReports() {
    return apiClient.get('/reports/summary');
  }

  getAdminUsers(includeDeleted = false) {
    return apiClient.get('/admin/users', {
      params: includeDeleted ? { includeDeleted: 'true' } : undefined,
    });
  }

  getAdminUserById(id: number) {
    return apiClient.get(`/admin/users/${id}`);
  }

  getTechnicians() {
    return apiClient.get('/admin/users/technicians');
  }

  createAdminUser(payload: Record<string, unknown>) {
    return apiClient.post('/admin/users', payload);
  }

  updateAdminUser(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/admin/users/${id}`, payload);
  }

  deleteAdminUser(id: number) {
    return apiClient.delete(`/admin/users/${id}`);
  }

  restoreAdminUser(id: number) {
    return apiClient.patch(`/admin/users/${id}/restore`, {});
  }

  getAdminRoles() {
    return apiClient.get('/admin/users/roles');
  }

  getAdminPermissionKeys() {
    return apiClient.get('/admin/users/permission-keys');
  }

  getAdminRolePermissions(roleId: number) {
    return apiClient.get(`/admin/users/roles/${roleId}/permissions`);
  }

  getAdminUserPermissionOverrides(userId: number) {
    return apiClient.get(`/admin/users/${userId}/permission-overrides`);
  }

  saveAdminUserPermissionOverrides(
    userId: number,
    overrides: Array<{ permissionKey: string; effect: 'allow' | 'deny'; reason?: string | null }>,
  ) {
    return apiClient.put(`/admin/users/${userId}/permission-overrides`, { overrides });
  }

  getAdminUserEffectivePermissions(userId: number) {
    return apiClient.get(`/admin/users/${userId}/effective-permissions`);
  }

  createAdminRole(payload: Record<string, unknown>) {
    return apiClient.post('/admin/users/roles', payload);
  }

  updateAdminRole(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/admin/users/roles/${id}`, payload);
  }

  deleteAdminRole(id: number) {
    return apiClient.delete(`/admin/users/roles/${id}`);
  }

  normalizeAdminRolesSecurityMenus() {
    return apiClient.post('/admin/users/roles/normalize-security', {});
  }

  signUp(email: string, password: string) {
    return apiClient.post('/auth/supabase/signup', { email, password });
  }

  signIn(email: string, password: string) {
    return apiClient.post('/auth/supabase/signin', { email, password });
  }

  // Brands
  getBrands() {
    return apiClient.get('/brands');
  }

  createBrand(payload: Record<string, unknown>) {
    return apiClient.post('/brands', payload);
  }

  updateBrand(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/brands/${id}`, payload);
  }

  // Products
  getProducts() {
    return apiClient.get('/products');
  }

  createProduct(payload: Record<string, unknown>) {
    return apiClient.post('/products', payload);
  }

  updateProduct(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/products/${id}`, payload);
  }

  // Users
  getUsers() {
    return apiClient.get('/users');
  }

  createUser(payload: Record<string, unknown>) {
    return apiClient.post('/users', payload);
  }

  updateUser(id: number, payload: Record<string, unknown>) {
    return apiClient.patch(`/users/${id}`, payload);
  }

  // Purchase
  getPurchaseOrders() {
    return apiClient.get('/purchase');
  }

  createPurchaseOrder(payload: Record<string, unknown>) {
    return apiClient.post('/purchase', payload);
  }

  // Vendor
  getVendors() {
    return apiClient.get('/vendor');
  }

  createVendor(payload: Record<string, unknown>) {
    return apiClient.post('/vendor', payload);
  }

  // Serial Number
  getSerialNumbers() {
    return apiClient.get('/serial-number');
  }

  createSerialNumber(payload: Record<string, unknown>) {
    return apiClient.post('/serial-number', payload);
  }

  // Sales Order
  getSalesOrders() {
    return apiClient.get('/sales-order');
  }

  createSalesOrder(payload: Record<string, unknown>) {
    return apiClient.post('/sales-order', payload);
  }

  // Login
  login(payload: Record<string, unknown>) {
    return apiClient.post('/login', payload);
  }
}
