import { Injectable } from '@angular/core';
import { apiClient } from './api-client';

export interface PurchaseOrderItem {
  id: number;
  poNumber: string;
  vendorId: string | null;
  vendorName: string;
  totalAmount: number;
  status: string;
  createdAt: string | null;
  serialCount: number;
}

export interface PurchaseListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PurchaseQueryParams {
  page: number;
  limit: number;
  search?: string;
}

interface PurchaseOrderApiResponse {
  success: boolean;
  items: PurchaseOrderItem[];
  meta: PurchaseListMeta;
}

export interface PurchaseOrderListResult {
  items: PurchaseOrderItem[];
  meta: PurchaseListMeta;
}

export interface CreatePurchaseRequestPayload {
  poNumber?: string;
  vendorId?: string;
  vendor?: {
    name: string;
    address?: string;
    contact_person?: string;
    contact_number?: string;
  };
  paymentDetails?: {
    amount?: number;
    method?: string;
    terms?: string;
    termsDueDate?: string | null;
    status?: 'unpaid' | 'paid' | 'partial';
    paymentDate?: string | null;
    downPayment?: number;
  };
  productItems: Array<{
    transType: 'purchase' | 'sales' | string;
    productId?: string;
    capacityId?: string;
    unitPrice?: number;
    sellPrice?: number;
    discountPrice?: number;
    unitTypesQty?: Array<{
      unitType: string;
      qty: number;
    }>;
    totalSetQty?: number;
    purchaseId?: number | null;
    salesId?: number | null;
  }>;
  totalAmount?: number;
  status?: string;
}

export interface CreatePurchaseResponse {
  success: boolean;
  message?: string;
  data?: {
    purchaseOrderId: number;
    poNumber?: string;
    vendorId?: string;
    computedTotalAmount?: number;
  };
}

@Injectable({ providedIn: 'root' })
export class PurchaseOrderService {
  async createPurchase(payload: CreatePurchaseRequestPayload): Promise<CreatePurchaseResponse> {
    const response = await apiClient.post<CreatePurchaseResponse>('/purchase', payload);
    return response.data;
  }

  async getDeliveries(params: PurchaseQueryParams): Promise<PurchaseOrderListResult> {
    const response = await apiClient.get<PurchaseOrderApiResponse>('/purchase/deliveries', { params });
    return {
      items: response.data.items ?? [],
      meta: response.data.meta,
    };
  }

  async getApprovals(params: PurchaseQueryParams): Promise<PurchaseOrderListResult> {
    const response = await apiClient.get<PurchaseOrderApiResponse>('/purchase/approvals', { params });
    return {
      items: response.data.items ?? [],
      meta: response.data.meta,
    };
  }

  async getMasterData(params: PurchaseQueryParams): Promise<PurchaseOrderListResult> {
    const response = await apiClient.get<PurchaseOrderApiResponse>('/purchase/master-data', { params });
    return {
      items: response.data.items ?? [],
      meta: response.data.meta,
    };
  }
}
