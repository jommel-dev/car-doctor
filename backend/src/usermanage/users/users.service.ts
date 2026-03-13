import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async getTableColumns(tableName: string): Promise<string[]> {
    const result = await this.databaseService.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = $1
         AND table_schema = current_schema()`,
      [tableName],
    );

    return result.rows.map((row) => row.column_name);
  }

  private pickColumn(
    availableColumns: string[],
    candidates: string[],
  ): string | undefined {
    const availableColumnsLower = new Set(
      availableColumns.map((column) => column.toLowerCase()),
    );

    return candidates.find((candidate) =>
      availableColumnsLower.has(candidate.toLowerCase()),
    );
  }

  async create(createUserDto: CreateUserDto) {
    const username = createUserDto.username?.trim();
    const fullname = createUserDto.fullname?.trim();

    if (!username || !createUserDto.password || !fullname) {
      return {
        success: false,
        message: 'username, password, and fullname are required',
      };
    }

    const passwordSha1 = createHash('sha1')
      .update(createUserDto.password)
      .digest('hex');

    try {
      const duplicateUsername = await this.databaseService.query<{ id: number }>(
        `SELECT id
         FROM tblusers
         WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
         LIMIT 1`,
        [username],
      );

      if (duplicateUsername.rowCount > 0) {
        return {
          success: false,
          message: 'Username already exists',
        };
      }

      const email = createUserDto.email?.trim();
      if (email) {
        const duplicateEmail = await this.databaseService.query<{ id: number }>(
          `SELECT id
           FROM tblusers
           WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
           LIMIT 1`,
          [email],
        );

        if (duplicateEmail.rowCount > 0) {
          return {
            success: false,
            message: 'Email already exists',
          };
        }
      }

      const columns = await this.getTableColumns('tblusers');
      if (columns.length === 0) {
        return {
          success: false,
          message: 'tblusers table was not found in current schema',
        };
      }

      const record: Record<string, unknown> = {
        username,
        password: passwordSha1,
        fullname,
      };

      const birthdateColumn = this.pickColumn(columns, ['birthdate']);
      const addressColumn = this.pickColumn(columns, ['address']);
      const emailColumn = this.pickColumn(columns, ['email']);
      const contactColumn = this.pickColumn(columns, ['contact']);
      const statusColumn = this.pickColumn(columns, ['status']);
      const isDeletedColumn = this.pickColumn(columns, ['is_deleted', 'isDeleted']);
      const createdByColumn = this.pickColumn(columns, [
        'created_by',
        'createdBy',
      ]);
      const roleIdColumn = this.pickColumn(columns, ['roleId', 'role_id', 'roleid']);
      const branchIdColumn = this.pickColumn(columns, [
        'branchId',
        'branch_id',
        'branchid',
      ]);

      if (birthdateColumn && createUserDto.birthdate) {
        record[birthdateColumn] = createUserDto.birthdate;
      }
      if (addressColumn && createUserDto.address) {
        record[addressColumn] = createUserDto.address;
      }
      if (emailColumn && email) {
        record[emailColumn] = email;
      }
      if (contactColumn && createUserDto.contact) {
        record[contactColumn] = createUserDto.contact;
      }
      if (statusColumn) {
        record[statusColumn] = createUserDto.status ?? 1;
      }
      if (isDeletedColumn) {
        record[isDeletedColumn] = createUserDto.is_deleted ?? false;
      }
      if (createdByColumn && createUserDto.created_by != null) {
        record[createdByColumn] = createUserDto.created_by;
      }
      if (roleIdColumn && createUserDto.roleId != null) {
        record[roleIdColumn] = createUserDto.roleId;
      }
      if (branchIdColumn && createUserDto.branchId != null) {
        record[branchIdColumn] = createUserDto.branchId;
      }

      const insertColumns = Object.keys(record);
      const insertValues = Object.values(record);
      const quotedColumns = insertColumns.map((column) => `"${column}"`).join(', ');
      const placeholders = insertValues
        .map((_, index) => `$${index + 1}`)
        .join(', ');

      const result = await this.databaseService.query<{ id: number }>(
        `INSERT INTO tblusers (${quotedColumns}) VALUES (${placeholders}) RETURNING id`,
        insertValues,
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          message: 'Failed to create user',
        };
      }

      return {
        success: true,
        id: result.rows[0].id,
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

  async findAll() {
    const result = await this.databaseService.query<Record<string, unknown>>(
      `SELECT *
       FROM tblusers
       ORDER BY id DESC`,
    );

    const users = result.rows.map((row) => {
      const item = { ...row };
      delete item.password;
      return item;
    });

    return {
      success: true,
      data: users,
    };
  }

  async findOne(id: number) {
    const result = await this.databaseService.query<Record<string, unknown>>(
      `SELECT *
       FROM tblusers
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    const user = { ...result.rows[0] };
    delete user.password;

    return {
      success: true,
      data: user,
    };
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    void id;
    void updateUserDto;
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
