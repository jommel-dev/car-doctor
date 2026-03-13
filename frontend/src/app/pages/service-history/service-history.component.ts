import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-service-history',
  templateUrl: './service-history.component.html',
})
export class ServiceHistoryComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  history: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadHistory();
  }

  async loadHistory() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getServiceHistory();
      this.history = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load service history';
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
