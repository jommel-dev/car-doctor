import { Injectable } from '@angular/core';
import { getAccessToken } from './auth-storage';

export type MenuKey =
  | 'dashboard'
  | 'sales_order'
  | 'purchase_order'
  | 'inventory'
  | 'user_management'
  | 'settings';

export type PermissionKey = 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete' | 'canDoAll';

interface JwtPayload {
  sub?: string;
  username?: string;
  fullname?: string;
  email?: string;
  roleId?: number;
  roleName?: string;
  menus?: string;
  permissions?: string;
  iat?: number;
  exp?: number;
}

@Injectable({
  providedIn: 'root',
})
export class RbacService {
  private cachedToken: string | null = null;
  private cachedPayload: JwtPayload | null = null;
  private cachedMenus = new Set<string>();
  private cachedPermissions = new Set<string>();

  private refreshCache(): void {
    const token = getAccessToken();

    if (!token) {
      this.cachedToken = null;
      this.cachedPayload = null;
      this.cachedMenus = new Set<string>();
      this.cachedPermissions = new Set<string>();
      return;
    }

    if (this.cachedToken === token) {
      return;
    }

    this.cachedToken = token;

    const parts = token.split('.');
    if (parts.length !== 3) {
      this.cachedPayload = null;
      this.cachedMenus = new Set<string>();
      this.cachedPermissions = new Set<string>();
      return;
    }

    try {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(payloadBase64);
      this.cachedPayload = JSON.parse(decoded) as JwtPayload;

      const menus = this.cachedPayload?.menus ?? '';
      this.cachedMenus = new Set(
        menus
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      );

      const permissions = this.cachedPayload?.permissions ?? '';
      this.cachedPermissions = new Set(
        permissions
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      );
    } catch {
      this.cachedPayload = null;
      this.cachedMenus = new Set<string>();
      this.cachedPermissions = new Set<string>();
    }
  }

  getPayload(): JwtPayload | null {
    this.refreshCache();
    return this.cachedPayload;
  }

  isAuthenticated(): boolean {
    const payload = this.getPayload();
    if (!payload?.exp) {
      return false;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp > nowInSeconds;
  }

  getAllowedMenus(): Set<string> {
    this.refreshCache();
    return this.cachedMenus;
  }

  getAllowedPermissions(): Set<string> {
    this.refreshCache();
    return this.cachedPermissions;
  }

  hasMenu(menu: MenuKey): boolean {
    return this.getAllowedMenus().has(menu);
  }

  hasPermission(permission: PermissionKey): boolean {
    const allowed = this.getAllowedPermissions();
    return allowed.has('canDoAll') || allowed.has(permission);
  }

  canAccess(menu: MenuKey, permission?: PermissionKey): boolean {
    if (!this.isAuthenticated()) {
      return false;
    }

    if (!this.hasMenu(menu)) {
      return false;
    }

    if (!permission) {
      return true;
    }

    return this.hasPermission(permission);
  }

  getDisplayName(): string {
    const payload = this.getPayload();
    return payload?.fullname ?? payload?.username ?? 'User';
  }

  getEmail(): string {
    return this.getPayload()?.email ?? '-';
  }
}
