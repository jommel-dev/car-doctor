import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { convertBigIntToString } from '../../utils/bigint-serializer';

@Controller('admin/users')
export class UserManagementController {
  constructor(private readonly service: UserManagementService) {}

  @Post()
  async createUser(@Body() data: Record<string, unknown>) {
    const result = await this.service.createUser(data);
    return convertBigIntToString(result);
  }

  @Get()
  async findUsers(@Query('includeDeleted') includeDeleted?: string) {
    const includeDeletedFlag = ['1', 'true', 'yes', 'on'].includes(
      String(includeDeleted ?? '').trim().toLowerCase(),
    );

    const result = await this.service.findUsers(includeDeletedFlag);
    return convertBigIntToString(result);
  }

  @Post('technicians')
  async createTechnician(@Body() data: Record<string, unknown>) {
    const result = await this.service.createTechnician(data);
    return convertBigIntToString(result);
  }

  @Get('technicians')
  async findTechnicians() {
    const result = await this.service.findTechnicians();
    return convertBigIntToString(result);
  }

  @Get('roles')
  async findRoles() {
    const result = await this.service.findRoles();
    return convertBigIntToString(result);
  }

  @Get('permission-keys')
  async findPermissionKeys() {
    const result = await this.service.findPermissionKeys();
    return convertBigIntToString(result);
  }

  @Get('roles/:roleId/permissions')
  async findRolePermissions(@Param('roleId') roleId: string) {
    const result = await this.service.findRolePermissions(+roleId);
    return convertBigIntToString(result);
  }

  @Post('roles')
  async createRole(@Body() data: Record<string, unknown>) {
    const result = await this.service.createRole(data);
    return convertBigIntToString(result);
  }

  @Patch('roles/:id')
  async updateRole(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    const result = await this.service.updateRole(+id, data);
    return convertBigIntToString(result);
  }

  @Delete('roles/:id')
  async removeRole(@Param('id') id: string) {
    const result = await this.service.removeRole(+id);
    return convertBigIntToString(result);
  }

  @Post('roles/normalize-security')
  async normalizeRoleMenusForSecurity() {
    const result = await this.service.normalizeRoleMenusForSecurity();
    return convertBigIntToString(result);
  }

  @Get(':id/permission-overrides')
  async findUserPermissionOverrides(@Param('id') id: string) {
    const result = await this.service.findUserPermissionOverrides(+id);
    return convertBigIntToString(result);
  }

  @Put(':id/permission-overrides')
  async setUserPermissionOverrides(
    @Param('id') id: string,
    @Body()
    body: {
      overrides?: Array<{
        permissionKey: string;
        effect: 'allow' | 'deny';
        reason?: string | null;
      }>;
    },
  ) {
    const result = await this.service.setUserPermissionOverrides(+id, body.overrides ?? []);
    return convertBigIntToString(result);
  }

  @Get(':id/effective-permissions')
  async findUserEffectivePermissions(@Param('id') id: string) {
    const result = await this.service.findUserEffectivePermissions(+id);
    return convertBigIntToString(result);
  }

  @Get(':id')
  async findUserById(@Param('id') id: string) {
    const result = await this.service.findUserById(+id);
    return convertBigIntToString(result);
  }

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    const result = await this.service.updateUser(+id, data);
    return convertBigIntToString(result);
  }

  @Delete(':id')
  async removeUser(@Param('id') id: string) {
    const result = await this.service.removeUser(+id);
    return convertBigIntToString(result);
  }

  @Patch(':id/restore')
  async restoreUser(@Param('id') id: string) {
    const result = await this.service.restoreUser(+id);
    return convertBigIntToString(result);
  }
}