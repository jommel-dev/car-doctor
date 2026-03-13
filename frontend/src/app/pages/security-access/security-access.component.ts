import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-security-access',
  templateUrl: './security-access.component.html',
})
export class SecurityAccessComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  users: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadUsers();
  }

  async loadUsers() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getAdminUsers();
      this.users = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load users';
    } finally {
      this.isLoading = false;
    }
  }

  async createAdminUser(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      email: String(formData.get('email') ?? ''),
      passwordHash: String(formData.get('passwordHash') ?? 'temp-password'),
      role: String(formData.get('role') ?? 'ADMIN'),
    };

    await this.api.createAdminUser(payload);
    await this.loadUsers();
    this.closePanels();
    form.reset();
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
