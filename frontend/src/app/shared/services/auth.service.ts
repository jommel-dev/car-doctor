import { Injectable } from '@angular/core';
import { apiClient } from './api-client';
import { clearAccessToken, setAccessToken } from './auth-storage';

export interface LoginResponse {
  success: boolean;
  accessToken?: string;
  message?: string;
  role?: {
    id: number | null;
    name: string | null;
    menus: string | null;
    permissions: string | null;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  async login(username: string, password: string, persist = false): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/login', {
      username,
      password,
    });

    if (response.data.success && response.data.accessToken) {
      setAccessToken(response.data.accessToken, persist);
    }

    return response.data;
  }

  logout(): void {
    clearAccessToken();
  }
}
