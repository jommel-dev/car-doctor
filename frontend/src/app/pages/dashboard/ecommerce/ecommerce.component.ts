import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../../shared/services/car-shop-api.service';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';

interface DashboardOverview {
  dailySalesSummary?: number | string;
  activeRepairJobs?: number;
  pendingServiceRequests?: number;
  customerCount?: number;
  vehicleServiced?: {
    daily?: number;
    weekly?: number;
    monthly?: number;
  };
  availableStockItems?: number;
  lowStockItems?: number;
  outOfStockItems?: number;
  inventoryItems?: Array<{
    id: string | number;
    partName: string;
    supplierName?: string | null;
    stockQty: number;
    lowStockThreshold: number;
    isLowStock: boolean;
    isOutOfStock: boolean;
  }>;
  monthlySales?: Array<{
    month: string;
    total: number | string;
  }>;
  topMechanics?: Array<{
    technicianName: string;
    completedJobs: number;
    lastCompletedAt?: string | Date | null;
  }>;
  lastCompletedJob?: {
    saleId?: string | number | null;
    jobOrderId?: string | number | null;
    amount?: number | string | null;
    completedAt?: string | Date | null;
    customerName?: string | null;
    vehicleLabel?: string | null;
    plateNumber?: string | null;
    technicianName?: string | null;
    jobsDone?: string | null;
  } | null;
}

@Component({
  selector: 'app-ecommerce',
  imports: [
    CommonModule,
    NgApexchartsModule,
  ],
  templateUrl: './ecommerce.component.html',
})
export class EcommerceComponent implements OnInit {
  dashboardData: DashboardOverview = {};
  isLoading = false;
  errorMessage = '';
  showLowStockOnly = false;

  chartSeries: ApexAxisChartSeries = [{
    name: 'Paid JOs',
    data: Array.from({ length: 12 }, () => 0),
  }];

  chart: ApexChart = {
    type: 'bar',
    height: 280,
    toolbar: { show: false },
    fontFamily: 'Outfit, sans-serif',
  };

  xaxis: ApexXAxis = {
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    axisBorder: { show: false },
    axisTicks: { show: false },
  };

  plotOptions: ApexPlotOptions = {
    bar: {
      borderRadius: 6,
      columnWidth: '42%',
      borderRadiusApplication: 'end',
    },
  };

  dataLabels: ApexDataLabels = { enabled: false };
  stroke: ApexStroke = { show: true, width: 4, colors: ['transparent'] };
  legend: ApexLegend = { show: false };
  yaxis: ApexYAxis = {
    labels: {
      formatter: (value: number) => this.formatCompactCurrency(value),
    },
  };
  grid: ApexGrid = { yaxis: { lines: { show: true } } };
  fill: ApexFill = { opacity: 1 };
  tooltip: ApexTooltip = {
    y: {
      formatter: (value: number) => this.formatCurrency(value),
    },
  };
  colors: string[] = ['#465fff'];

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadDashboardData();
  }

  async loadDashboardData() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getDashboardOverview();
      this.dashboardData = response.data || {};
      this.updateMonthlySalesChart();
    } catch {
      this.errorMessage = 'Unable to load dashboard overview.';
      this.dashboardData = {};
      this.updateMonthlySalesChart();
    } finally {
      this.isLoading = false;
    }
  }

  get filteredInventoryItems(): NonNullable<DashboardOverview['inventoryItems']> {
    const inventoryItems = Array.isArray(this.dashboardData.inventoryItems)
      ? this.dashboardData.inventoryItems
      : [];

    return this.showLowStockOnly
      ? inventoryItems.filter((item) => item.isLowStock)
      : inventoryItems;
  }

  get topMechanics(): NonNullable<DashboardOverview['topMechanics']> {
    return Array.isArray(this.dashboardData.topMechanics) ? this.dashboardData.topMechanics : [];
  }

  get monthlySalesTotal(): number {
    const monthlySales = Array.isArray(this.dashboardData.monthlySales) ? this.dashboardData.monthlySales : [];
    return monthlySales.reduce((total, item) => total + this.toNumber(item.total), 0);
  }

  get vehicleServicedDaily(): number {
    return Number(this.dashboardData.vehicleServiced?.daily ?? 0);
  }

  get vehicleServicedWeekly(): number {
    return Number(this.dashboardData.vehicleServiced?.weekly ?? 0);
  }

  get vehicleServicedMonthly(): number {
    return Number(this.dashboardData.vehicleServiced?.monthly ?? 0);
  }

  formatCurrency(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.toNumber(value));
  }

  formatCompactCurrency(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(this.toNumber(value));
  }

  formatDateTime(value: string | Date | null | undefined): string {
    if (!value) {
      return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }

    return parsed.toLocaleString();
  }

  toggleInventoryFilter(lowStockOnly: boolean): void {
    this.showLowStockOnly = lowStockOnly;
  }

  getInventoryStatusClasses(item: NonNullable<DashboardOverview['inventoryItems']>[number]): string {
    if (item.isOutOfStock) {
      return 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400';
    }

    if (item.isLowStock) {
      return 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400';
    }

    return 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400';
  }

  getInventoryStatusLabel(item: NonNullable<DashboardOverview['inventoryItems']>[number]): string {
    if (item.isOutOfStock) {
      return 'Out of stock';
    }

    if (item.isLowStock) {
      return 'Low stock';
    }

    return 'Available';
  }

  private updateMonthlySalesChart(): void {
    const monthlySales = Array.isArray(this.dashboardData.monthlySales) ? this.dashboardData.monthlySales : [];
    const fallbackCategories = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const categories = monthlySales.length > 0
      ? monthlySales.map((item) => item.month)
      : fallbackCategories;
    const data = monthlySales.length > 0
      ? monthlySales.map((item) => this.toNumber(item.total))
      : Array.from({ length: 12 }, () => 0);

    this.xaxis = {
      ...this.xaxis,
      categories,
    };

    this.chartSeries = [{
      name: 'Paid JOs',
      data,
    }];
  }

  private toNumber(value: number | string | null | undefined): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }
}
