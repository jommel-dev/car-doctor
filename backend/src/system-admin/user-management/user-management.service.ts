import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

type PermissionOverrideInput = {
  permissionKey: string;
  effect: 'allow' | 'deny';
  reason?: string | null;
};

@Injectable()
export class UserManagementService {
    private parseTokenList(value: unknown): string[] {
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
        // fallback parser
      }

      return raw
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((item) => item.replace(/^["']+|["']+$/g, '').trim())
        .filter(Boolean);
    }

  constructor(private readonly prisma: PrismaService) {}

  private readonly allowedMenus = new Set([
    'dashboard',
    'sales_order',
    'purchase_order',
    'inventory',
    'user-management',
    'security',
    'settings',
  ]);

  private readonly allowedPermissions = new Set([
    'canCreate',
    'canRead',
    'canUpdate',
    'canDelete',
    'canDoAll',
  ]);

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

  private normalizeBigInt(value: unknown): bigint | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return BigInt(Math.trunc(value));
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        return BigInt(value.trim());
      } catch {
        return null;
      }
    }

    return null;
  }

  private normalizeText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  private hashPassword(password: string): string {
    return createHash('sha1').update(password).digest('hex');
  }

  private normalizeRoleMenus(value: unknown): string {
    const tokens = this.parseTokenList(value)
      .map((item) => this.normalizeMenuToken(item))
      .filter(Boolean)
      .filter((item) => this.allowedMenus.has(item));

    return [...new Set(tokens)].join(',');
  }

  private normalizeRolePermissions(value: unknown): string {
    const tokens = this.parseTokenList(value)
      .map((item) => String(item ?? '').trim().toLowerCase())
      .map((token) => {
        if (token === 'read' || token === 'canread') return 'canRead';
        if (token === 'write' || token === 'create' || token === 'cancreate') return 'canCreate';
        if (token === 'update' || token === 'edit' || token === 'canupdate') return 'canUpdate';
        if (token === 'delete' || token === 'remove' || token === 'candelete') return 'canDelete';
        if (token === 'candoall' || token === 'can_do_all' || token === 'all' || token === 'admin') return 'canDoAll';
        return '';
      })
      .filter(Boolean)
      .filter((item) => this.allowedPermissions.has(item));

    const output = new Set(tokens);
    if (
      output.has('canRead') &&
      output.has('canCreate') &&
      output.has('canUpdate') &&
      output.has('canDelete')
    ) {
      output.add('canDoAll');
    }

    return [...output].join(',');
  }

  async createUser(data: Record<string, unknown>) {
    const username = this.normalizeText(data.username);
    const fullname = this.normalizeText(data.fullname);
    const rawPassword = this.normalizeText(data.password);
    const email = this.normalizeText(data.email);
    const contact = this.normalizeText(data.contact);
    const roleId = this.normalizeBigInt(data.roleId);
    const branchId = this.normalizeBigInt(data.branchId);

    const payload: Record<string, unknown> = {
      username,
      fullname,
      email,
      contact,
      status: this.normalizeInt(data.status) ?? 1,
      is_deleted: false,
      roleId,
      branchId,
    };

    if (rawPassword) {
      payload.password = this.hashPassword(rawPassword);
    }

    return this.prisma.tblusers.create({
      data: payload as never,
      include: {
        role: true,
        branch: true,
      },
    });
  }

  findUsers(includeDeleted = false) {
    return this.prisma.tblusers.findMany({
      where: includeDeleted ? undefined : { is_deleted: false },
      include: {
        role: true,
        branch: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  findUserById(id: number) {
    return this.prisma.tblusers.findUnique({
      where: { id },
      include: {
        role: true,
        branch: true,
      },
    });
  }

  async updateUser(id: number, data: Record<string, unknown>) {
    const payload: Record<string, unknown> = {};

    if ('username' in data) {
      payload.username = this.normalizeText(data.username);
    }

    if ('fullname' in data) {
      payload.fullname = this.normalizeText(data.fullname);
    }

    if ('email' in data) {
      payload.email = this.normalizeText(data.email);
    }

    if ('contact' in data) {
      payload.contact = this.normalizeText(data.contact);
    }

    if ('status' in data) {
      payload.status = this.normalizeInt(data.status);
    }

    if ('roleId' in data) {
      payload.roleId = this.normalizeBigInt(data.roleId);
    }

    if ('branchId' in data) {
      payload.branchId = this.normalizeBigInt(data.branchId);
    }

    if ('password' in data && this.normalizeText(data.password)) {
      payload.password = this.hashPassword(String(data.password));
    }

    return this.prisma.tblusers.update({
      where: { id },
      data: payload as never,
      include: {
        role: true,
        branch: true,
      },
    });
  }

  removeUser(id: number) {
    return this.prisma.tblusers.update({
      where: { id },
      data: {
        is_deleted: true,
      },
      include: {
        role: true,
        branch: true,
      },
    });
  }

  restoreUser(id: number) {
    return this.prisma.tblusers.update({
      where: { id },
      data: {
        is_deleted: false,
      },
      include: {
        role: true,
        branch: true,
      },
    });
  }

  createTechnician(data: Record<string, unknown>) {
    return this.prisma.tbltechnicians.create({ data: data as never });
  }

  findTechnicians() {
    return this.prisma.tbltechnicians.findMany({ orderBy: { id: 'desc' } });
  }

  findRoles() {
    return this.prisma.tblrbac.findMany({ orderBy: { id: 'desc' } });
  }

  createRole(data: Record<string, unknown>) {
    const roleName = this.normalizeText(data.roleName);
    const roleMenus = this.normalizeRoleMenus(data.roleMenus);
    const rolePermission = this.normalizeRolePermissions(data.rolePermission);

    return this.prisma.tblrbac.create({
      data: {
        roleName,
        roleMenus,
        rolePermission,
      },
    });
  }

  updateRole(id: number, data: Record<string, unknown>) {
    const payload: Record<string, unknown> = {};

    if ('roleName' in data) {
      payload.roleName = this.normalizeText(data.roleName);
    }

    if ('roleMenus' in data) {
      payload.roleMenus = this.normalizeRoleMenus(data.roleMenus);
    }

    if ('rolePermission' in data) {
      payload.rolePermission = this.normalizeRolePermissions(data.rolePermission);
    }

    return this.prisma.tblrbac.update({ where: { id }, data: payload as never });
  }

  removeRole(id: number) {
    return this.prisma.tblrbac.delete({ where: { id } });
  }

  async normalizeRoleMenusForSecurity() {
    const roles = await this.prisma.tblrbac.findMany({
      select: {
        id: true,
        roleMenus: true,
      },
    });

    let updated = 0;
    for (const role of roles) {
      const normalizedMenus = this.normalizeRoleMenus(role.roleMenus);
      if ((role.roleMenus ?? '') !== normalizedMenus) {
        await this.prisma.tblrbac.update({
          where: { id: role.id },
          data: { roleMenus: normalizedMenus },
        });
        updated += 1;
      }
    }

    return {
      updated,
      total: roles.length,
    };
  }

  async findPermissionKeys() {
    try {
      const rows = await this.prisma.$queryRaw<Array<{
        key: string;
        label: string;
        module: string;
        scope: string;
      }>>`
        SELECT
          key,
          label,
          module,
          scope
        FROM auth_permission_keys
        ORDER BY module ASC, scope ASC, key ASC
      `;

      return {
        success: true,
        data: rows,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load permission keys',
      };
    }
  }

  async findRolePermissions(roleId: number) {
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return {
        success: false,
        message: 'Invalid role id',
      };
    }

    try {
      const rows = await this.prisma.$queryRaw<Array<{
        permissionKey: string;
        label: string;
        module: string;
        scope: string;
      }>>`
        SELECT
          pk.key AS "permissionKey",
          pk.label,
          pk.module,
          pk.scope
        FROM auth_role_permissions rp
        INNER JOIN auth_permission_keys pk
          ON pk.id = rp.permission_id
        WHERE rp.role_id = ${BigInt(roleId)}
        ORDER BY pk.module ASC, pk.scope ASC, pk.key ASC
      `;

      return {
        success: true,
        data: rows,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load role permissions',
      };
    }
  }

  async findUserPermissionOverrides(userId: number) {
    if (!Number.isFinite(userId) || userId <= 0) {
      return {
        success: false,
        message: 'Invalid user id',
      };
    }

    try {
      const rows = await this.prisma.$queryRaw<Array<{
        permissionKey: string;
        effect: 'allow' | 'deny';
        reason: string | null;
      }>>`
        SELECT
          pk.key AS "permissionKey",
          uo.effect,
          uo.reason
        FROM auth_user_permission_overrides uo
        INNER JOIN auth_permission_keys pk
          ON pk.id = uo.permission_id
        WHERE uo.user_id = ${BigInt(userId)}
        ORDER BY pk.key ASC
      `;

      return {
        success: true,
        data: rows,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load user permission overrides',
      };
    }
  }

  async setUserPermissionOverrides(userId: number, overrides: PermissionOverrideInput[]) {
    if (!Number.isFinite(userId) || userId <= 0) {
      return {
        success: false,
        message: 'Invalid user id',
      };
    }

    const normalizedOverrides = (overrides ?? [])
      .map((item) => ({
        permissionKey: String(item.permissionKey ?? '').trim(),
        effect: item.effect,
        reason:
          item.reason == null || String(item.reason).trim().length === 0
            ? null
            : String(item.reason).trim(),
      }))
      .filter(
        (item) =>
          item.permissionKey.length > 0 &&
          (item.effect === 'allow' || item.effect === 'deny'),
      );

    const deduped = new Map<string, PermissionOverrideInput>();
    for (const item of normalizedOverrides) {
      deduped.set(item.permissionKey, item);
    }
    const overridesToSave = [...deduped.values()];

    try {
      const userExists = await this.prisma.tblusers.findUnique({
        where: { id: BigInt(userId) },
        select: { id: true },
      });

      if (!userExists) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (overridesToSave.length === 0) {
        await this.prisma.$executeRaw`
          DELETE FROM auth_user_permission_overrides
          WHERE user_id = ${BigInt(userId)}
        `;

        return {
          success: true,
          data: [],
        };
      }

      const requestedKeys = overridesToSave.map((item) => item.permissionKey);
      const permissionRows = await this.prisma.$queryRaw<Array<{ id: bigint; key: string }>>`
        SELECT id, key
        FROM auth_permission_keys
        WHERE key = ANY(${requestedKeys}::text[])
      `;

      const permissionIdByKey = new Map(
        permissionRows.map((row) => [row.key, row.id]),
      );

      const missingKeys = requestedKeys.filter((key) => !permissionIdByKey.has(key));
      if (missingKeys.length > 0) {
        return {
          success: false,
          message: `Unknown permission keys: ${missingKeys.join(', ')}`,
        };
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM auth_user_permission_overrides
          WHERE user_id = ${BigInt(userId)}
        `;

        for (const item of overridesToSave) {
          await tx.$executeRaw`
            INSERT INTO auth_user_permission_overrides (user_id, permission_id, effect, reason)
            VALUES (
              ${BigInt(userId)},
              ${permissionIdByKey.get(item.permissionKey) as bigint},
              ${item.effect},
              ${item.reason ?? null}
            )
          `;
        }
      });

      return {
        success: true,
        data: overridesToSave,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save user permission overrides',
      };
    }
  }

  async findUserEffectivePermissions(userId: number) {
    if (!Number.isFinite(userId) || userId <= 0) {
      return {
        success: false,
        message: 'Invalid user id',
      };
    }

    try {
      const rows = await this.prisma.$queryRaw<Array<{
        permissionKey: string;
        permissionLabel: string;
        module: string;
        scope: string;
        isAllowed: boolean;
        source: 'role' | 'user-allow' | 'user-deny' | 'none';
      }>>`
        SELECT
          permission_key AS "permissionKey",
          permission_label AS "permissionLabel",
          module,
          scope,
          is_allowed AS "isAllowed",
          source
        FROM v_auth_user_effective_permissions
        WHERE user_id = ${BigInt(userId)}
        ORDER BY module ASC, scope ASC, permission_key ASC
      `;

      return {
        success: true,
        data: rows,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load user effective permissions',
      };
    }
  }
}