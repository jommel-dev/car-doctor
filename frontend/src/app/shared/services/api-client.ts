import axios, { AxiosHeaders } from 'axios';
import { clearAccessToken, getAccessToken } from './auth-storage';

function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const host = window.location.hostname || 'localhost';
  return `http://${host}:3000`;
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers ??= new AxiosHeaders();

    if (config.headers instanceof AxiosHeaders) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAccessToken();
    }

    return Promise.reject(error);
  },
);
