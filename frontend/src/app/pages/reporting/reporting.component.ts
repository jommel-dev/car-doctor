import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-reporting',
  templateUrl: './reporting.component.html',
})
export class ReportingComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  reportSummary: Record<string, unknown> | null = null;
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadReportSummary();
  }

  async loadReportSummary() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getReports();
      this.reportSummary = response.data as Record<string, unknown>;
    } catch {
      this.errorMessage = 'Unable to load reports';
    } finally {
      this.isLoading = false;
    }
  }

  openModal() {
    this.showModal = true;
  }

  openDrawer() {
    this.showDrawer = true;
  }

  closePanels() {
    this.showModal = false;
    this.showDrawer = false;
  }
}
