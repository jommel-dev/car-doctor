import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CarShopApiService } from '../../shared/services/car-shop-api.service';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ButtonComponent } from '../../shared/components/ui/button/button.component';
import { CanDirective } from '../../shared/directives/can.directive';

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  email: string;
  contact: string;
  roleId: number | null;
  role: string;
  status: 'Active' | 'Inactive' | 'Deleted';
  isDeleted: boolean;
}

interface RoleRow {
  id: number;
  roleName: string;
  roleMenus: string;
  rolePermission: string;
}

interface PermissionOption {
  key: string;
  label: string;
  module: string;
  scope: string;
}

interface UserPermissionOverrideApiItem {
  permissionKey: string;
  effect: 'allow' | 'deny';
  reason?: string | null;
}

interface UserEffectivePermissionApiItem {
  permissionKey: string;
  permissionLabel: string;
  module: string;
  scope: string;
  isAllowed: boolean;
  source: 'role' | 'user-allow' | 'user-deny' | 'none' | string;
}

type OverrideEffect = 'inherit' | 'allow' | 'deny';

@Component({
  selector: 'app-user-management',
  imports: [CommonModule, FormsModule, PageBreadcrumbComponent, ButtonComponent, CanDirective],
  templateUrl: './user-management.component.html',
  styles: ``,
})
export class UserManagementComponent implements OnInit {
  users: UserRow[] = [];
  roles: RoleRow[] = [];
  userSearch = '';
  showDeletedUsers = false;
  page = 1;
  readonly pageSize = 10;
  showDrawer = false;
  drawerMode: 'create' | 'edit' = 'create';
  showRoleModal = false;
  isLoading = false;
  isRoleLoading = false;
  isLoadingPermissionKeys = false;
  isLoadingRolePermissions = false;
  isLoadingPermissionContext = false;
  isLoadingEditUser = false;
  errorMessage = '';
  roleErrorMessage = '';
  permissionSearch = '';
  deletingUserIds = new Set<number>();
  restoringUserIds = new Set<number>();
  selectedUser: UserRow | null = null;
  userForm = this.createInitialUserForm();
  permissionOptions: PermissionOption[] = [];
  rolePermissionKeys: string[] = [];
  savedEffectivePermissions: UserEffectivePermissionApiItem[] = [];
  overrideSelectionByKey: Record<string, OverrideEffect> = {};
  editingRoleId: number | null = null;
  editingRoleName = '';
  editingRoleMenus = new Set<string>();
  editingRolePermissions = new Set<string>();

  readonly menuOptions = [
    'dashboard',
    'sales_order',
    'purchase_order',
    'inventory',
    'user-management',
    'security',
  ];

  readonly rolePermissionOptions = [
    'canCreate',
    'canRead',
    'canUpdate',
    'canDelete',
    'canDoAll',
  ];

  constructor(private readonly api: CarShopApiService) {}

  ngOnInit(): void {
    void this.loadUsers();
    void this.loadRoles();
    void this.loadPermissionKeys();
  }

  get filteredUsers(): UserRow[] {
    const keyword = this.userSearch.trim().toLowerCase();
    if (!keyword) {
      return this.users;
    }

    return this.users.filter((user) => {
      const haystack = [
        user.username,
        user.fullName,
        user.email,
        user.contact,
        user.role,
        user.status,
      ]
        .map((entry) => String(entry ?? '').toLowerCase())
        .join(' ');

      return haystack.includes(keyword);
    });
  }

  get pagedUsers(): UserRow[] {
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredUsers.slice(start, end);
  }

  get totalFilteredUsers(): number {
    return this.filteredUsers.length;
  }

  get totalFilteredPages(): number {
    return Math.max(1, Math.ceil(this.totalFilteredUsers / this.pageSize));
  }

  get activeUserCount(): number {
    return this.users.filter((user) => !user.isDeleted && user.status === 'Active').length;
  }

  get inactiveUserCount(): number {
    return this.users.filter((user) => !user.isDeleted && user.status === 'Inactive').length;
  }

  get deletedUserCount(): number {
    return this.users.filter((user) => user.isDeleted).length;
  }

  onUserSearchChange(value: string): void {
    this.userSearch = value;
    this.page = 1;
  }

  onUserPageChange(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalFilteredPages || nextPage === this.page) {
      return;
    }

    this.page = nextPage;
  }

  async onToggleShowDeletedUsers(value: boolean): Promise<void> {
    this.showDeletedUsers = value;
    this.page = 1;
    await this.loadUsers();
  }

  async loadUsers() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getAdminUsers(this.showDeletedUsers);
      const rows = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];

      this.users = rows.map((user: any) => ({
        id: user.id,
        username: user.username || '',
        fullName: user.fullname || '',
        email: user.email || '',
        contact: user.contact || '',
        roleId: user.roleId ? Number(user.roleId) : null,
        role: user.role?.roleName || 'No Role',
        status: user.is_deleted
          ? 'Deleted'
          : Number(user.status) === 1
            ? 'Active'
            : 'Inactive',
        isDeleted: Boolean(user.is_deleted),
      }));
      this.page = 1;
    } catch {
      this.errorMessage = 'Unable to load users';
    } finally {
      this.isLoading = false;
    }
  }

  async loadRoles() {
    this.isRoleLoading = true;
    this.roleErrorMessage = '';
    try {
      const response = await this.api.getAdminRoles();
      const rows = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];

      this.roles = rows.map((role: any) => ({
        id: Number(role.id),
        roleName: role.roleName || '',
        roleMenus: role.roleMenus || '',
        rolePermission: role.rolePermission || '',
      }));
    } catch {
      this.roleErrorMessage = 'Unable to load roles';
    } finally {
      this.isRoleLoading = false;
    }
  }

  openModal() {
    this.errorMessage = '';
    this.drawerMode = 'create';
    this.selectedUser = null;
    this.userForm = this.createInitialUserForm();
    this.rolePermissionKeys = [];
    this.savedEffectivePermissions = [];
    this.overrideSelectionByKey = {};
    this.permissionSearch = '';
    this.showDrawer = true;
  }

  async openDrawer(user: UserRow) {
    this.isLoadingEditUser = true;
    this.errorMessage = '';
    try {
      const response = await this.api.getAdminUserById(user.id);
      const detail = response?.data ?? response;
      if (!detail) {
        this.errorMessage = 'Unable to load user details';
        return;
      }

      this.selectedUser = {
        id: Number(detail.id ?? user.id),
        username: String(detail.username ?? user.username),
        fullName: String(detail.fullname ?? user.fullName),
        email: String(detail.email ?? user.email),
        contact: String(detail.contact ?? user.contact),
        roleId: detail.roleId ? Number(detail.roleId) : user.roleId,
        role: detail.role?.roleName || user.role,
        status: detail.is_deleted
          ? 'Deleted'
          : Number(detail.status) === 1
            ? 'Active'
            : 'Inactive',
        isDeleted: Boolean(detail.is_deleted),
      };

      this.drawerMode = 'edit';
      this.userForm = {
        username: this.selectedUser.username,
        password: '',
        fullname: this.selectedUser.fullName,
        email: this.selectedUser.email,
        contact: this.selectedUser.contact,
        roleId: this.selectedUser.roleId,
        status: this.selectedUser.status === 'Active' ? 1 : 0,
      };

      await this.loadPermissionContext(
        this.selectedUser.id,
        this.selectedUser.roleId ? Number(this.selectedUser.roleId) : null,
      );

      this.showDrawer = true;
    } catch {
      this.errorMessage = 'Unable to load user details';
    } finally {
      this.isLoadingEditUser = false;
    }
  }

  openRoleModal(role?: RoleRow) {
    this.roleErrorMessage = '';
    this.editingRoleId = role?.id ?? null;
    this.editingRoleName = role?.roleName ?? '';
    this.editingRoleMenus = new Set(
      (role?.roleMenus ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
    this.editingRolePermissions = new Set(
      (role?.rolePermission ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
    this.showRoleModal = true;
  }

  closePanels() {
    this.showDrawer = false;
    this.showRoleModal = false;
    this.selectedUser = null;
    this.drawerMode = 'create';
    this.userForm = this.createInitialUserForm();
    this.rolePermissionKeys = [];
    this.savedEffectivePermissions = [];
    this.overrideSelectionByKey = {};
    this.permissionSearch = '';
    this.editingRoleId = null;
    this.editingRoleName = '';
    this.editingRoleMenus.clear();
    this.editingRolePermissions.clear();
  }

  async createUser(): Promise<number | null> {
    const username = this.userForm.username.trim();
    const fullname = this.userForm.fullname.trim();
    const password = this.userForm.password.trim();

    if (!username || !fullname || !password) {
      this.errorMessage = 'Username, full name, and password are required';
      return null;
    }

    const payload = {
      username,
      password,
      fullname,
      email: this.userForm.email.trim(),
      contact: this.userForm.contact.trim(),
      roleId: this.userForm.roleId ? Number(this.userForm.roleId) : null,
      status: Number(this.userForm.status ?? 1),
    };

    try {
      const response = await this.api.createAdminUser(payload);
      const createdIdRaw = response?.data?.id;
      const createdId = Number(createdIdRaw ?? 0);
      await this.loadUsers();
      return Number.isFinite(createdId) && createdId > 0 ? createdId : null;
    } catch (error) {
      console.error('Error creating user:', error);
      this.errorMessage = 'Failed to create user';
      return null;
    }
  }

  async updateUser(): Promise<boolean> {
    if (!this.selectedUser) {
      return false;
    }

    const username = this.userForm.username.trim();
    const fullname = this.userForm.fullname.trim();

    if (!username || !fullname) {
      this.errorMessage = 'Username and full name are required';
      return false;
    }

    const payload: Record<string, unknown> = {
      username,
      fullname,
      email: this.userForm.email.trim(),
      contact: this.userForm.contact.trim(),
      roleId: this.userForm.roleId ? Number(this.userForm.roleId) : null,
      status: Number(this.userForm.status ?? 1),
    };

    const password = this.userForm.password.trim();
    if (password) {
      payload['password'] = password;
    }

    try {
      await this.api.updateAdminUser(this.selectedUser.id, payload);
      await this.loadUsers();
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      this.errorMessage = 'Failed to update user';
      return false;
    }
  }

  async submitUserForm(): Promise<void> {
    this.errorMessage = '';
    if (this.drawerMode === 'create') {
      const createdUserId = await this.createUser();
      if (!createdUserId) {
        return;
      }

      const overrides = this.selectedOverrides;
      if (overrides.length > 0) {
        try {
          await this.api.saveAdminUserPermissionOverrides(createdUserId, overrides);
        } catch {
          this.errorMessage = 'User created, but failed to save permission overrides';
          return;
        }
      }

      this.closePanels();
      return;
    }

    const updated = await this.updateUser();
    if (!updated || !this.selectedUser?.id) {
      return;
    }

    const overrides = this.selectedOverrides;
    try {
      await this.api.saveAdminUserPermissionOverrides(this.selectedUser.id, overrides);
    } catch {
      this.errorMessage = 'User updated, but failed to save permission overrides';
      return;
    }
    this.closePanels();
  }

  async onRoleChange(nextRoleId: unknown): Promise<void> {
    const roleId = Number(nextRoleId);
    this.userForm.roleId = Number.isFinite(roleId) && roleId > 0 ? roleId : null;

    if (!Number.isFinite(roleId) || roleId <= 0) {
      this.rolePermissionKeys = [];
      return;
    }

    await this.loadRolePermissions(roleId);
  }

  async saveRole(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const roleName = String(formData.get('roleName') ?? '').trim();
    const roleMenus = formData
      .getAll('roleMenus')
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join(',');
    const rolePermission = formData
      .getAll('rolePermission')
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join(',');

    const payload = { roleName, roleMenus, rolePermission };

    try {
      if (this.editingRoleId) {
        await this.api.updateAdminRole(this.editingRoleId, payload);
      } else {
        await this.api.createAdminRole(payload);
      }

      await this.loadRoles();
      this.closePanels();
    } catch (error) {
      console.error('Error saving role:', error);
      this.roleErrorMessage = 'Failed to save role';
    }
  }

  async deleteRole(role: RoleRow) {
    const confirmed = window.confirm(`Delete role "${role.roleName}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await this.api.deleteAdminRole(role.id);
      await this.loadRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      this.roleErrorMessage = 'Failed to delete role';
    }
  }

  async deleteUser(user: UserRow): Promise<void> {
    if (this.deletingUserIds.has(user.id) || user.isDeleted) {
      return;
    }

    const confirmed = window.confirm(`Delete user "${user.username}"?`);
    if (!confirmed) {
      return;
    }

    this.deletingUserIds.add(user.id);
    try {
      await this.api.deleteAdminUser(user.id);
      await this.loadUsers();
    } catch {
      this.errorMessage = 'Failed to delete user';
    } finally {
      this.deletingUserIds.delete(user.id);
    }
  }

  async restoreUser(user: UserRow): Promise<void> {
    if (this.restoringUserIds.has(user.id) || !user.isDeleted) {
      return;
    }

    this.restoringUserIds.add(user.id);
    try {
      await this.api.restoreAdminUser(user.id);
      await this.loadUsers();
    } catch {
      this.errorMessage = 'Failed to restore user';
    } finally {
      this.restoringUserIds.delete(user.id);
    }
  }

  isMenuChecked(menu: string): boolean {
    return this.editingRoleMenus.has(menu);
  }

  isPermissionChecked(permission: string): boolean {
    return this.editingRolePermissions.has(permission);
  }

  async normalizeSecurityRoleMenus(): Promise<void> {
    this.roleErrorMessage = '';
    try {
      await this.api.normalizeAdminRolesSecurityMenus();
      await this.loadRoles();
    } catch {
      this.roleErrorMessage = 'Failed to normalize security menu access';
    }
  }

  get filteredPermissionOptions(): PermissionOption[] {
    const keyword = this.permissionSearch.trim().toLowerCase();
    if (!keyword) {
      return this.permissionOptions;
    }

    return this.permissionOptions.filter((item) => {
      const haystack = `${item.key} ${item.label} ${item.module} ${item.scope}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }

  get selectedOverrides(): UserPermissionOverrideApiItem[] {
    return Object.entries(this.overrideSelectionByKey)
      .filter(([, effect]) => effect === 'allow' || effect === 'deny')
      .map(([permissionKey, effect]) => ({
        permissionKey,
        effect: effect as 'allow' | 'deny',
      }));
  }

  get selectedOverrideCount(): number {
    return this.selectedOverrides.length;
  }

  get effectivePreviewKeys(): string[] {
    const allowed = new Set(this.rolePermissionKeys);

    for (const [permissionKey, effect] of Object.entries(this.overrideSelectionByKey)) {
      if (effect === 'allow') {
        allowed.add(permissionKey);
      }

      if (effect === 'deny') {
        allowed.delete(permissionKey);
      }
    }

    return [...allowed].sort((a, b) => a.localeCompare(b));
  }

  getOverrideEffect(permissionKey: string): OverrideEffect {
    return this.overrideSelectionByKey[permissionKey] ?? 'inherit';
  }

  setOverrideEffect(permissionKey: string, nextEffect: unknown): void {
    const normalizedEffect =
      nextEffect === 'allow' || nextEffect === 'deny' ? nextEffect : 'inherit';

    if (normalizedEffect === 'inherit') {
      delete this.overrideSelectionByKey[permissionKey];
      this.overrideSelectionByKey = { ...this.overrideSelectionByKey };
      return;
    }

    this.overrideSelectionByKey = {
      ...this.overrideSelectionByKey,
      [permissionKey]: normalizedEffect,
    };
  }

  clearOverrideSelections(): void {
    this.overrideSelectionByKey = {};
  }

  isRoleGranted(permissionKey: string): boolean {
    return this.rolePermissionKeys.includes(permissionKey);
  }

  getPermissionLabel(permissionKey: string): string {
    const matched = this.permissionOptions.find((item) => item.key === permissionKey);
    return matched?.label ?? permissionKey;
  }

  private async loadPermissionKeys(): Promise<void> {
    this.isLoadingPermissionKeys = true;
    try {
      const response = await this.api.getAdminPermissionKeys();
      const payload = response?.data ?? response;
      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      this.permissionOptions = rows
        .map((item: any) => ({
          key: String(item.key ?? '').trim(),
          label: String(item.label ?? '').trim() || String(item.key ?? '').trim(),
          module: String(item.module ?? '').trim(),
          scope: String(item.scope ?? '').trim(),
        }))
        .filter((item: PermissionOption) => item.key.length > 0);
    } catch {
      this.permissionOptions = [];
    } finally {
      this.isLoadingPermissionKeys = false;
    }
  }

  private async loadRolePermissions(roleId: number): Promise<void> {
    this.isLoadingRolePermissions = true;
    try {
      const response = await this.api.getAdminRolePermissions(roleId);
      const payload = response?.data ?? response;
      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      this.rolePermissionKeys = rows
        .map((item: any) => String(item.permissionKey ?? '').trim())
        .filter(Boolean);
    } catch {
      this.rolePermissionKeys = [];
    } finally {
      this.isLoadingRolePermissions = false;
    }
  }

  private async loadPermissionContext(userId: number, roleId: number | null): Promise<void> {
    this.isLoadingPermissionContext = true;
    try {
      const tasks: Promise<unknown>[] = [];

      if (roleId && roleId > 0) {
        tasks.push(this.loadRolePermissions(roleId));
      } else {
        this.rolePermissionKeys = [];
      }

      tasks.push(this.loadUserOverrides(userId));
      tasks.push(this.loadUserEffectivePermissions(userId));

      await Promise.all(tasks);
    } finally {
      this.isLoadingPermissionContext = false;
    }
  }

  private async loadUserOverrides(userId: number): Promise<void> {
    try {
      const response = await this.api.getAdminUserPermissionOverrides(userId);
      const payload = response?.data ?? response;
      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      const overrides: Record<string, OverrideEffect> = {};
      for (const item of rows) {
        const permissionKey = String(item.permissionKey ?? '').trim();
        const effect = String(item.effect ?? '').trim();
        if (!permissionKey) {
          continue;
        }

        if (effect === 'allow' || effect === 'deny') {
          overrides[permissionKey] = effect;
        }
      }

      this.overrideSelectionByKey = overrides;
    } catch {
      this.overrideSelectionByKey = {};
    }
  }

  private async loadUserEffectivePermissions(userId: number): Promise<void> {
    try {
      const response = await this.api.getAdminUserEffectivePermissions(userId);
      const payload = response?.data ?? response;
      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      this.savedEffectivePermissions = rows
        .filter((item: any) => Boolean(item.isAllowed))
        .map((item: any) => ({
          permissionKey: String(item.permissionKey ?? '').trim(),
          permissionLabel: String(item.permissionLabel ?? '').trim(),
          module: String(item.module ?? '').trim(),
          scope: String(item.scope ?? '').trim(),
          isAllowed: Boolean(item.isAllowed),
          source: String(item.source ?? 'none'),
        }));
    } catch {
      this.savedEffectivePermissions = [];
    }
  }

  private createInitialUserForm(): {
    username: string;
    password: string;
    fullname: string;
    email: string;
    contact: string;
    roleId: number | null;
    status: number;
  } {
    return {
      username: '',
      password: '',
      fullname: '',
      email: '',
      contact: '',
      roleId: null,
      status: 1,
    };
  }
}
