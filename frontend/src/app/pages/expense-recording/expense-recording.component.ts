import { Component, OnInit } from '@angular/core';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';

@Component({
  selector: 'app-expense-recording',
  templateUrl: './expense-recording.component.html',
})
export class ExpenseRecordingComponent implements OnInit {
  showModal = false;
  showDrawer = false;
  expenses: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadExpenses();
  }

  async loadExpenses() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getExpenses();
      this.expenses = Array.isArray(response.data) ? response.data : [];
    } catch {
      this.errorMessage = 'Unable to load expenses';
    } finally {
      this.isLoading = false;
    }
  }

  async createExpense(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      category: String(formData.get('category') ?? 'Utilities'),
      description: String(formData.get('description') ?? ''),
      amount: Number(formData.get('amount') ?? 0),
    };

    await this.api.createExpense(payload);
    await this.loadExpenses();
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
