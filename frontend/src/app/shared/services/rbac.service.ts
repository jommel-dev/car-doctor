import { Injectable } from '@angular/core';
import { getAccessToken } from './auth-storage';

export type MenuKey =
  | 'dashboard'
  | 'sales_order'
  | 'customers'
  | 'quotation'
  | 'job_orders'
  | 'pos'
  | 'reports'
  | 'purchase_order'
  | 'inventory'
  | 'user-management'
  | 'security'
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

  private readonly moduleToMenuMap: Record<string, MenuKey> = {
    dashboard: 'dashboard',
    'sales-order': 'sales_order',
    sales_order: 'sales_order',
    customers: 'customers',
    quotation: 'quotation',
    'job-orders': 'job_orders',
    job_orders: 'job_orders',
    pos: 'pos',
    reports: 'reports',
    'purchase-order': 'purchase_order',
    purchase_order: 'purchase_order',
    inventory: 'inventory',
    'user-management': 'user-management',
    user_management: 'user-management',
    security: 'security',
    settings: 'security',
  };

  private parseTokenList(value: string): string[] {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return [];
    }

    const tryJson = raw
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false');

    try {
      const parsed = JSON.parse(tryJson);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? '').trim()).filter(Boolean);
      }

      if (parsed && typeof parsed === 'object') {
        return Object.keys(parsed)
          .filter((key) => Boolean((parsed as Record<string, unknown>)[key]))
          .map((key) => String(key).trim())
          .filter(Boolean);
      }
    } catch {
      // fallback to csv parser
    }

    return raw
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((item) => item.replace(/^["']+|["']+$/g, '').trim())
      .filter(Boolean);
  }

  private resolveMenuKeyFromSlug(slug: string): MenuKey | null {
    const normalized = String(slug ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    return this.moduleToMenuMap[normalized] ?? null;
  }

  private resolvePermissionKeyFromSlug(slug: string): PermissionKey | null {
    const normalized = String(slug ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');

    if (normalized.includes('doall') || normalized.includes('fullaccess') || normalized === 'admin') {
      return 'canDoAll';
    }
    if (normalized.includes('create') || normalized.includes('add') || normalized.includes('write')) {
      return 'canCreate';
    }
    if (normalized.includes('read') || normalized.includes('view') || normalized.includes('list')) {
      return 'canRead';
    }
    if (normalized.includes('update') || normalized.includes('edit') || normalized.includes('approve') || normalized.includes('remit')) {
      return 'canUpdate';
    }
    if (normalized.includes('delete') || normalized.includes('remove')) {
      return 'canDelete';
    }

    return null;
  }

  private deriveLegacyAccessFromTokens(tokens: Set<string>): {
    menus: Set<string>;
    permissions: Set<string>;
  } {
    const menus = new Set<string>();
    const permissions = new Set<string>();

    for (const rawToken of tokens) {
      const token = String(rawToken ?? '').trim().toLowerCase();
      if (!token) {
        continue;
      }

      if (token.startsWith('legacy.menu.')) {
        const menuSlug = token.replace('legacy.menu.', '');
        const mappedMenu = this.resolveMenuKeyFromSlug(menuSlug);
        if (mappedMenu) {
          menus.add(mappedMenu);
        }
      }

      if (token.startsWith('legacy.permission.')) {
        const permissionSlug = token.replace('legacy.permission.', '');
        const mappedPermission = this.resolvePermissionKeyFromSlug(permissionSlug);
        if (mappedPermission) {
          permissions.add(mappedPermission);
        }
      }

      const [modulePart] = token.split('.');
      const mappedMenu = this.resolveMenuKeyFromSlug(modulePart);
      if (mappedMenu && (token.endsWith('.view') || token.includes('.menu.'))) {
        menus.add(mappedMenu);
      }

      const mappedPermission = this.resolvePermissionKeyFromSlug(token);
      if (mappedPermission) {
        permissions.add(mappedPermission);
      }
    }

    return { menus, permissions };
  }

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
      const menuTokens = new Set(
        this.parseTokenList(menus)
          .map((item) => this.normalizeMenuToken(item))
          .filter(Boolean),
      );

      const permissions = this.cachedPayload?.permissions ?? '';
      const permissionTokens = this.parseTokenList(permissions)
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);

      const normalizedPermissions = permissionTokens
        .map((item) => {
          const token = String(item ?? '').trim().toLowerCase();
          if (token === 'read' || token === 'canread') {
            return 'canRead';
          }
          if (token === 'write' || token === 'create' || token === 'cancreate') {
            return 'canCreate';
          }
          if (token === 'update' || token === 'edit' || token === 'canupdate') {
            return 'canUpdate';
          }
          if (token === 'delete' || token === 'remove' || token === 'candelete') {
            return 'canDelete';
          }
          if (token === 'candoall' || token === 'can_do_all' || token === 'all' || token === 'admin') {
            return 'canDoAll';
          }
          return '';
        })
        .filter(Boolean);

      const derived = this.deriveLegacyAccessFromTokens(new Set(permissionTokens));
      this.cachedMenus = new Set([...menuTokens, ...derived.menus]);

      const permissionSet = new Set<string>(normalizedPermissions);
      derived.permissions.forEach((item) => permissionSet.add(item));
      if (
        permissionSet.has('canRead') &&
        permissionSet.has('canCreate') &&
        permissionSet.has('canUpdate') &&
        permissionSet.has('canDelete')
      ) {
        permissionSet.add('canDoAll');
      }

      this.cachedPermissions = new Set(
        [...permissionSet],
      );
    } catch {
      this.cachedPayload = null;
      this.cachedMenus = new Set<string>();
      this.cachedPermissions = new Set<string>();
    }
  }

  private normalizeMenuToken(value: string): string {
    const normalized = String(value ?? '').trim().toLowerCase();

    if (normalized === 'user_management' || normalized === 'user management' || normalized === 'usermanagement' || normalized === 'user-management') {
      return 'user-management';
    }

    if (normalized === 'settings' || normalized === 'security') {
      return 'security';
    }

    return normalized;
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
    const allowedMenus = this.getAllowedMenus();

    if (allowedMenus.has(menu)) {
      return true;
    }

    if (menu === 'user-management') {
      return allowedMenus.has('user_management') || allowedMenus.has('user management') || allowedMenus.has('usermanagement');
    }

    if (menu === 'security') {
      return allowedMenus.has('settings');
    }

    return false;
  }

  hasPermission(permission: PermissionKey): boolean {
    const allowed = this.getAllowedPermissions();
    return allowed.has('canDoAll') || allowed.has(permission);
  }

  canAccess(menu: MenuKey, permission?: PermissionKey): boolean {
    if (!this.isAuthenticated()) {
      return false;
    }

    if (!this.hasMenu(menu) && !this.hasPermission('canDoAll')) {
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
