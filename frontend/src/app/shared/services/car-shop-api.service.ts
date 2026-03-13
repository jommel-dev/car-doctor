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

  getInventory() {
    return apiClient.get('/inventory-items');
  }

  createInventoryItem(payload: Record<string, unknown>) {
    return apiClient.post('/inventory-items', payload);
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

  getAdminUsers() {
    return apiClient.get('/admin/users');
  }

  getTechnicians() {
    return apiClient.get('/admin/users/technicians');
  }

  createAdminUser(payload: Record<string, unknown>) {
    return apiClient.post('/admin/users', payload);
  }

  signUp(email: string, password: string) {
    return apiClient.post('/auth/supabase/signup', { email, password });
  }

  signIn(email: string, password: string) {
    return apiClient.post('/auth/supabase/signin', { email, password });
  }
}
