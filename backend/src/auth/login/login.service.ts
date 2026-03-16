import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { CreateLoginDto } from './dto/create-login.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private parseTokenList(value: string | null | undefined): string[] {
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
      // fall back to delimiter parsing
    }

    return raw
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((item) => item.replace(/^["']+|["']+$/g, '').trim())
      .filter(Boolean);
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

  private normalizeMenus(value: string | null | undefined): string {
    return [...new Set(
      this.parseTokenList(value)
        .map((item) => this.normalizeMenuToken(item))
        .filter(Boolean),
    )].join(',');
  }

  private normalizePermissionToken(value: string): string {
    const normalized = String(value ?? '').trim().toLowerCase();

    if (normalized === 'read' || normalized === 'canread') {
      return 'canRead';
    }
    if (normalized === 'write' || normalized === 'create' || normalized === 'cancreate') {
      return 'canCreate';
    }
    if (normalized === 'update' || normalized === 'edit' || normalized === 'canupdate') {
      return 'canUpdate';
    }
    if (normalized === 'delete' || normalized === 'remove' || normalized === 'candelete') {
      return 'canDelete';
    }
    if (normalized === 'candoall' || normalized === 'can_do_all' || normalized === 'all' || normalized === 'admin') {
      return 'canDoAll';
    }

    return '';
  }

  private normalizePermissions(value: string | null | undefined): string {
    const normalized = this.parseTokenList(value)
      .map((item) => this.normalizePermissionToken(item))
      .filter(Boolean);

    const output = new Set(normalized);
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

  private mapPermissionKeyToClaim(permissionKey: string, scope: string): string | null {
    const key = String(permissionKey ?? '').toLowerCase();
    const normalizedScope = String(scope ?? '').toLowerCase();

    if (key.endsWith('.create') || key.endsWith('.add') || key.endsWith('.write')) {
      return 'canCreate';
    }

    if (key.endsWith('.edit') || key.endsWith('.update')) {
      return 'canUpdate';
    }

    if (key.endsWith('.delete') || key.endsWith('.remove')) {
      return 'canDelete';
    }

    if (normalizedScope === 'feature' || normalizedScope === 'menu' || normalizedScope === 'tab') {
      return 'canRead';
    }

    return null;
  }

  private async getNormalizedRbacClaims(userId: number, fallbackRoleId: number | null): Promise<{ menus: string; permissions: string }> {
    const normalizedMenus = new Set<string>();
    const normalizedPermissions = new Set<string>();

    try {
      const effectiveRows = await this.prisma.$queryRawUnsafe<Array<{
        permission_key: string;
        module: string;
        scope: string;
      }>>(
        `SELECT permission_key, module, scope
         FROM v_auth_user_effective_permissions
         WHERE user_id = $1 AND is_allowed = TRUE`,
        userId,
      );

      for (const row of effectiveRows) {
        const moduleName = this.normalizeMenuToken(String(row.module ?? ''));
        if (moduleName) {
          normalizedMenus.add(moduleName);
        }

        const claim = this.mapPermissionKeyToClaim(String(row.permission_key ?? ''), String(row.scope ?? ''));
        if (claim) {
          normalizedPermissions.add(claim);
        }
      }
    } catch {
      try {
        const roleBasedRows = await this.prisma.$queryRawUnsafe<Array<{
          permission_key: string;
          module: string;
          scope: string;
        }>>(
          `SELECT DISTINCT pk.key AS permission_key, pk.module, pk.scope
           FROM auth_permission_keys pk
           INNER JOIN auth_role_permissions rp ON rp.permission_id = pk.id
           INNER JOIN auth_user_roles ur ON ur.role_id = rp.role_id
           WHERE ur.user_id = $1
           UNION
           SELECT DISTINCT pk.key AS permission_key, pk.module, pk.scope
           FROM auth_permission_keys pk
           INNER JOIN auth_role_permissions rp ON rp.permission_id = pk.id
           WHERE $2 IS NOT NULL AND rp.role_id = $2`,
          userId,
          fallbackRoleId,
        );

        for (const row of roleBasedRows) {
          const moduleName = this.normalizeMenuToken(String(row.module ?? ''));
          if (moduleName) {
            normalizedMenus.add(moduleName);
          }

          const claim = this.mapPermissionKeyToClaim(String(row.permission_key ?? ''), String(row.scope ?? ''));
          if (claim) {
            normalizedPermissions.add(claim);
          }
        }
      } catch {
        return {
          menus: '',
          permissions: '',
        };
      }
    }

    if (
      normalizedPermissions.has('canRead') &&
      normalizedPermissions.has('canCreate') &&
      normalizedPermissions.has('canUpdate') &&
      normalizedPermissions.has('canDelete')
    ) {
      normalizedPermissions.add('canDoAll');
    }

    return {
      menus: [...normalizedMenus].join(','),
      permissions: [...normalizedPermissions].join(','),
    };
  }

  async create(createLoginDto: CreateLoginDto) {
    const { username, password } = createLoginDto;
    const passwordSha1 = createHash('sha1').update(password).digest('hex');

    try {
      const user = await this.prisma.tblusers.findFirst({
        where: {
          username,
          password: passwordSha1,
          is_deleted: false,
        },
        include: {
          role: true,
          branch: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid username or password',
        };
      }

      const normalizedFromRole = {
        menus: this.normalizeMenus(user.role?.roleMenus),
        permissions: this.normalizePermissions(user.role?.rolePermission),
      };

      const normalizedFromTables = await this.getNormalizedRbacClaims(
        Number(user.id),
        user.roleId != null ? Number(user.roleId) : null,
      );

      const normalizedMenus = normalizedFromTables.menus || normalizedFromRole.menus;
      const normalizedPermissions = normalizedFromTables.permissions || normalizedFromRole.permissions;

      const payload = {
        sub: Number(user.id),
        branchId: Number(user.branchId),
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        roleId: Number(user.roleId),
        roleName: user.role?.roleName,
        menus: normalizedMenus,
        permissions: normalizedPermissions,
      };

      const accessToken = await this.jwtService.signAsync(payload);

      return {
        success: true,
        accessToken,
        role: {
          id: Number(user.roleId),
          name: user.role?.roleName,
          menus: normalizedMenus,
          permissions: normalizedPermissions,
        },
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to PostgreSQL',
      };
    }
  }

  findAll() {
    return `This action returns all login`;
  }

  findOne(id: number) {
    return `This action returns a #${id} login`;
  }

  update(id: number, updateLoginDto: UpdateLoginDto) {
    void updateLoginDto;
    return `This action updates a #${id} login`;
  }

  remove(id: number) {
    return `This action removes a #${id} login`;
  }
}
