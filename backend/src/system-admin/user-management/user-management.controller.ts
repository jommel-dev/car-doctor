import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserManagementService } from './user-management.service';

@Controller('admin/users')
export class UserManagementController {
  constructor(private readonly service: UserManagementService) {}

  @Post()
  createUser(@Body() data: Record<string, unknown>) {
    return this.service.createUser(data);
  }

  @Get()
  findUsers() {
    return this.service.findUsers();
  }

  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.service.updateUser(+id, data);
  }

  @Delete(':id')
  removeUser(@Param('id') id: string) {
    return this.service.removeUser(+id);
  }

  @Post('technicians')
  createTechnician(@Body() data: Record<string, unknown>) {
    return this.service.createTechnician(data);
  }

  @Get('technicians')
  findTechnicians() {
    return this.service.findTechnicians();
  }
}