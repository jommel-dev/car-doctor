import { Injectable } from '@nestjs/common';
import { CreateSerialNumberDto } from './dto/create-serial-number.dto';
import { UpdateSerialNumberDto } from './dto/update-serial-number.dto';
import { DatabaseService } from 'src/database/database.service';
import { ScanSalesOrderDto } from './dto/scan-sales-order.dto';

type SerialScanRow = {
  id: number;
  serialNumber: string | null;
  status: string | null;
  salesId: string | null;
  productId: string | null;
  capacityId: string | null;
  branchId: string | null;
  productName: string | null;
  unit: string | null;
  capacity: string | null;
};

@Injectable()
export class SerialNumberService {
  constructor(private readonly databaseService: DatabaseService) {}

  private normalizeSerialNumber(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  async scanSalesOrder(dto: ScanSalesOrderDto, userId?: number) {
    const serialNumber = this.normalizeSerialNumber(dto.serialNumber);
    const salesId = Number(dto.salesId);
    const branchId =
      dto.branchId === null || dto.branchId === undefined || dto.branchId === ('' as unknown)
        ? null
        : Number(dto.branchId);
    const expectedProductId =
      dto.expectedProductId === null ||
      dto.expectedProductId === undefined ||
      dto.expectedProductId === ('' as unknown)
        ? null
        : Number(dto.expectedProductId);
    const expectedCapacityId =
      dto.expectedCapacityId === null ||
      dto.expectedCapacityId === undefined ||
      dto.expectedCapacityId === ('' as unknown)
        ? null
        : Number(dto.expectedCapacityId);

    if (!serialNumber) {
      return { success: false, message: 'serialNumber is required' };
    }
    if (!Number.isFinite(salesId) || salesId <= 0) {
      return { success: false, message: 'salesId must be a valid number' };
    }
    if (branchId !== null && (!Number.isFinite(branchId) || branchId <= 0)) {
      return { success: false, message: 'branchId must be a valid number' };
    }

    const serialResult = await this.databaseService.query<SerialScanRow>(
      `SELECT
        sn.id,
        sn."serialNumber"::text AS "serialNumber",
        sn.status::text AS status,
        sn."salesId"::text AS "salesId",
        sn."productId"::text AS "productId",
        sn."capacityId"::text AS "capacityId",
        sn."branchId"::text AS "branchId",
        COALESCE(
          to_jsonb(p)->>'productName',
          to_jsonb(p)->>'product_name',
          to_jsonb(p)->>'productname'
        ) AS "productName",
        COALESCE(to_jsonb(p)->>'unit', null) AS unit,
        COALESCE(to_jsonb(c)->>'capacity', null) AS capacity
      FROM tblserial_numbers sn
      LEFT JOIN tblproducts p
        ON p.id::text = sn."productId"::text
      LEFT JOIN tblcapacity c
        ON c.id::text = sn."capacityId"::text
      WHERE LOWER(
        regexp_replace(BTRIM(COALESCE(sn."serialNumber", '')), '\\s+', ' ', 'g')
      ) = LOWER($1)
      LIMIT 1`,
      [serialNumber],
    );

    if (serialResult.rowCount === 0) {
      return { success: false, message: 'Serial number not found' };
    }

    const serial = serialResult.rows[0];
    const currentSalesId = Number(serial.salesId);
    const normalizedStatus = String(serial.status ?? '').trim().toLowerCase();
    const soldStatuses = new Set(['sold', 'released', 'out', 'outbound']);

    if (
      expectedProductId !== null &&
      Number(serial.productId) !== Number(expectedProductId)
    ) {
      return {
        success: false,
        message: `Serial number product mismatch. Expected productId ${expectedProductId}`,
      };
    }

    if (
      expectedCapacityId !== null &&
      Number(serial.capacityId) !== Number(expectedCapacityId)
    ) {
      return {
        success: false,
        message: `Serial number capacity mismatch. Expected capacityId ${expectedCapacityId}`,
      };
    }

    if (Number.isFinite(currentSalesId) && currentSalesId > 0 && currentSalesId !== salesId) {
      return {
        success: false,
        message: `Serial number already assigned to salesId ${currentSalesId}`,
      };
    }

    if (soldStatuses.has(normalizedStatus) && currentSalesId === salesId) {
      return {
        success: true,
        message: 'Serial number already scanned for this sales order',
        item: serial,
      };
    }

    const updateResult = await this.databaseService.query<SerialScanRow>(
      `UPDATE tblserial_numbers
       SET
         "salesId" = $1,
         "branchId" = COALESCE($2, "branchId"),
         status = 'sold',
         created_by = COALESCE($3, created_by)
       WHERE id = $4
       RETURNING
         id,
         "serialNumber"::text AS "serialNumber",
         status::text AS status,
         "salesId"::text AS "salesId",
         "productId"::text AS "productId",
         "capacityId"::text AS "capacityId",
         "branchId"::text AS "branchId",
         null::text AS "productName",
         null::text AS unit,
         null::text AS capacity`,
      [salesId, branchId, userId ?? null, serial.id],
    );

    if (updateResult.rowCount === 0) {
      return {
        success: false,
        message: 'Unable to update serial number for sales order',
      };
    }

    return {
      success: true,
      message: 'Serial number scanned successfully',
      item: {
        ...serial,
        salesId: String(salesId),
        status: 'sold',
        branchId: branchId !== null ? String(branchId) : serial.branchId,
      },
    };
  }

  create(createSerialNumberDto: CreateSerialNumberDto) {
    void createSerialNumberDto;
    return 'This action adds a new serialNumber';
  }

  findAll() {
    return `This action returns all serialNumber`;
  }

  findOne(id: number) {
    return `This action returns a #${id} serialNumber`;
  }

  update(id: number, updateSerialNumberDto: UpdateSerialNumberDto) {
    return `This action updates a #${id} serialNumber`;
  }

  remove(id: number) {
    return `This action removes a #${id} serialNumber`;
  }
}
