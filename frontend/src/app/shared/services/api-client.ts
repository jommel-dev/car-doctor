import axios, { AxiosHeaders } from 'axios';
import { clearAccessToken, getAccessToken } from './auth-storage';

function resolveApiBaseUrl(): string {
  const appEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const configuredApiBaseUrl = String(appEnv?.['NG_APP_API_BASE_URL'] ?? '').trim();

  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.hostname || 'localhost';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  return isLocalHost
    ? 'http://localhost:3000'
    : `${protocol}//${host}:3000`;
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
