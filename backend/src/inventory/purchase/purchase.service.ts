import { Injectable } from '@nestjs/common';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { DatabaseService } from 'src/database/database.service';
import { PurchaseTabItemDto } from './dto/purchase-tab-item.dto';
import { ListPurchaseQueryDto } from './dto/list-purchase-query.dto';
import { PurchaseListResponseDto } from './dto/purchase-list-response.dto';
import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';

type PurchaseRow = {
  id: number;
  poNumber: string | null;
  vendorId: string | null;
  vendorName: string | null;
  vendorAddress: string | null;
  vendorContactPerson: string | null;
  vendorContactNumber: string | null;
  totalAmount: string | null;
  status: string | null;
  paymentDetails: unknown;
  productItems: unknown;
  createdAt: string | null;
  serialCount: number;
};

type PurchaseCountRow = {
  total: string;
};

type PurchaseMode = 'deliveries' | 'approvals' | 'master-data';
type TableColumnMeta = {
  column_name: string;
  data_type: string;
  udt_name: string;
};

@Injectable()
export class PurchaseService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async getTableColumns(
    executor: { query: PoolClient['query'] },
    tableName: string,
  ): Promise<string[]> {
    const columnsResult = await executor.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = $1
         AND table_schema = current_schema()`,
      [tableName],
    );

    return columnsResult.rows.map((row) => row.column_name);
  }

  private async getColumnMeta(
    executor: { query: PoolClient['query'] },
    tableName: string,
    columnName: string,
  ): Promise<TableColumnMeta | null> {
    const result = await executor.query<TableColumnMeta>(
      `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       LIMIT 1`,
      [tableName, columnName],
    );

    return result.rows[0] ?? null;
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

  private async runInsert(
    executor: { query: PoolClient['query'] },
    tableName: string,
    record: Record<string, unknown>,
  ) {
    const columns = Object.keys(record);
    const values = Object.values(record);
    const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    return executor.query<{ id: number }>(
      `INSERT INTO ${tableName} (${quotedColumns}) VALUES (${placeholders}) RETURNING id`,
      values,
    );
  }

  private toRequiredNumber(value: unknown, fieldName: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${fieldName} must be a valid number`);
    }

    return parsed;
  }

  private toOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toIsoDateOrNull(value: unknown): string | null {
    if (!value) {
      return null;
    }

    const raw = String(value).trim();

    const ddMmYyyyMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddMmYyyyMatch) {
      const day = Number(ddMmYyyyMatch[1]);
      const month = Number(ddMmYyyyMatch[2]);
      const year = Number(ddMmYyyyMatch[3]);
      const parsed = new Date(Date.UTC(year, month - 1, day));

      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  private normalizeSerialNumber(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  async create(createPurchaseDto: CreatePurchaseDto, userId?: number) {
    const poNumber = String(createPurchaseDto.poNumber ?? '').trim();
    const status = String(createPurchaseDto.status ?? 'pending').trim() || 'pending';

    const productItems = Array.isArray(createPurchaseDto.productItems)
      ? createPurchaseDto.productItems
      : [];

    if (productItems.length === 0) {
      return { success: false, message: 'At least one product item is required' };
    }

    try {
      const result = await this.databaseService.withTransaction(async (client) => {
        let resolvedVendorId = String(createPurchaseDto.vendorId ?? '').trim();
        const vendorName = String(createPurchaseDto.vendor?.name ?? '').trim();
        const vendorColumns = await this.getTableColumns(client, 'tblvendors');
        const vendorIdColumn = this.pickColumn(vendorColumns, ['id']);
        const vendorNameColumn = this.pickColumn(vendorColumns, ['name']);
        const vendorAddressColumn = this.pickColumn(vendorColumns, ['address']);
        const contactPersonColumn = this.pickColumn(vendorColumns, [
          'contact_person',
          'contactPerson',
        ]);
        const contactNumberColumn = this.pickColumn(vendorColumns, [
          'contact_number',
          'contactNumber',
        ]);

        if (resolvedVendorId) {
          const existingVendorResult = await client.query<{ id: string | number }>(
            `SELECT id
             FROM tblvendors
             WHERE id::text = $1
             LIMIT 1`,
            [resolvedVendorId],
          );

          if (existingVendorResult.rowCount === 0) {
            if (!vendorName) {
              throw new Error('Vendor not found for provided vendorId');
            }

            if (!vendorNameColumn) {
              throw new Error('tblvendors name column is missing');
            }

            const vendorRecord: Record<string, unknown> = {
              [vendorNameColumn]: vendorName,
            };

            if (vendorIdColumn) {
              vendorRecord[vendorIdColumn] = resolvedVendorId;
            }

            const vendorAddress = String(createPurchaseDto.vendor?.address ?? '').trim();
            const contactPerson = String(
              createPurchaseDto.vendor?.contact_person ?? '',
            ).trim();
            const contactNumber = String(
              createPurchaseDto.vendor?.contact_number ?? '',
            ).trim();

            if (vendorAddressColumn && vendorAddress) {
              vendorRecord[vendorAddressColumn] = vendorAddress;
            }
            if (contactPersonColumn && contactPerson) {
              vendorRecord[contactPersonColumn] = contactPerson;
            }
            if (contactNumberColumn && contactNumber) {
              vendorRecord[contactNumberColumn] = contactNumber;
            }

            const insertedVendor = await this.runInsert(client, 'tblvendors', vendorRecord);
            if (insertedVendor.rowCount === 0) {
              throw new Error('Failed to create vendor for provided vendorId');
            }
          }
        }

        if (!resolvedVendorId) {
          if (!vendorName) {
            throw new Error('Vendor ID or vendor.name is required');
          }

          if (!vendorNameColumn) {
            throw new Error('tblvendors name column is missing');
          }

          const vendorRecord: Record<string, unknown> = {
            [vendorNameColumn]: vendorName,
          };

          if (vendorIdColumn) {
            vendorRecord[vendorIdColumn] = randomUUID();
          }

          const vendorAddress = String(createPurchaseDto.vendor?.address ?? '').trim();
          const contactPerson = String(
            createPurchaseDto.vendor?.contact_person ?? '',
          ).trim();
          const contactNumber = String(
            createPurchaseDto.vendor?.contact_number ?? '',
          ).trim();

          if (vendorAddressColumn && vendorAddress) {
            vendorRecord[vendorAddressColumn] = vendorAddress;
          }
          if (contactPersonColumn && contactPerson) {
            vendorRecord[contactPersonColumn] = contactPerson;
          }
          if (contactNumberColumn && contactNumber) {
            vendorRecord[contactNumberColumn] = contactNumber;
          }

          const insertedVendor = await this.runInsert(client, 'tblvendors', vendorRecord);
          if (insertedVendor.rowCount === 0) {
            throw new Error('Failed to create vendor');
          }

          resolvedVendorId = String(insertedVendor.rows[0].id);
        }

        let computedTotalAmount = 0;
        for (const item of productItems) {
          const itemUnitPrice = this.toOptionalNumber(item.unitPrice) ?? 0;
          const itemDiscountPrice = this.toOptionalNumber(item.discountPrice) ?? 0;
          const priceToUse = itemDiscountPrice > 0 ? itemDiscountPrice : itemUnitPrice;
          const qty = this.toOptionalNumber(item.totalSetQty) ?? 0;
          computedTotalAmount += priceToUse * qty;
        }

        const fallbackTotal = this.toOptionalNumber(createPurchaseDto.totalAmount) ?? 0;
        const totalAmount = computedTotalAmount > 0 ? computedTotalAmount : fallbackTotal;

        if (poNumber) {
          const duplicatePoResult = await client.query<{ id: number }>(
            `SELECT id
             FROM tblpurchase_orders po
             WHERE LOWER(TRIM(COALESCE(
               to_jsonb(po)->>'po_number',
               to_jsonb(po)->>'poNumber',
               to_jsonb(po)->>'po_no',
               ''
             ))) = LOWER(TRIM($1))
             LIMIT 1`,
            [poNumber],
          );

          if (duplicatePoResult.rowCount > 0) {
            throw new Error('PO number already exists');
          }
        }

        const purchaseColumns = await this.getTableColumns(client, 'tblpurchase_orders');
        const poNumberColumn = this.pickColumn(purchaseColumns, ['po_number', 'poNumber', 'po_no']);
        const purchaseVendorIdColumn = this.pickColumn(purchaseColumns, ['vendor_id', 'vendorId']);
        const totalAmountColumn = this.pickColumn(purchaseColumns, ['total_amount', 'totalAmount']);
        const statusColumn = this.pickColumn(purchaseColumns, ['status']);
        const createdByColumn = this.pickColumn(purchaseColumns, ['created_by', 'createdBy', 'createdby']);

        if (!poNumberColumn || !purchaseVendorIdColumn || !totalAmountColumn || !statusColumn) {
          throw new Error('tblpurchase_orders columns are not aligned with expected fields');
        }

        const purchaseRecord: Record<string, unknown> = {
          [purchaseVendorIdColumn]: resolvedVendorId,
          [totalAmountColumn]: totalAmount,
          [statusColumn]: status,
        };

        if (poNumberColumn && poNumber) {
          purchaseRecord[poNumberColumn] = poNumber;
        }

        if (createdByColumn && userId) {
          purchaseRecord[createdByColumn] = userId;
        }

        const purchaseInsertResult = await this.runInsert(
          client,
          'tblpurchase_orders',
          purchaseRecord,
        );

        if (purchaseInsertResult.rowCount === 0) {
          throw new Error('Failed to create purchase order');
        }

        const purchaseOrderId = purchaseInsertResult.rows[0].id;

        const purchaseOrderPoNumberResult = await client.query<{ po_number: string | null }>(
          `SELECT COALESCE(
             to_jsonb(po)->>'po_number',
             to_jsonb(po)->>'poNumber',
             to_jsonb(po)->>'po_no'
           ) AS po_number
           FROM tblpurchase_orders po
           WHERE po.id = $1
           LIMIT 1`,
          [purchaseOrderId],
        );

        const resolvedPoNumber =
          purchaseOrderPoNumberResult.rows[0]?.po_number?.trim() || poNumber;
        const paymentDetails = createPurchaseDto.paymentDetails;
        if (paymentDetails) {
          const paymentColumns = await this.getTableColumns(client, 'tblpo_payments');
          if (paymentColumns.length > 0) {
            const paymentPoIdColumn = this.pickColumn(paymentColumns, ['po_id', 'poId']);
            const amountColumn = this.pickColumn(paymentColumns, ['amount']);
            const methodColumn = this.pickColumn(paymentColumns, ['method']);
            const paymentDateColumn = this.pickColumn(paymentColumns, [
              'payment_date',
              'paymentDate',
            ]);
            const termsColumn = this.pickColumn(paymentColumns, ['terms']);
            const termsDueDateColumn = this.pickColumn(paymentColumns, [
              'terms_due_date',
              'termsDueDate',
            ]);
            const paymentStatusColumn = this.pickColumn(paymentColumns, ['status']);
            const downPaymentColumn = this.pickColumn(paymentColumns, [
              'down_payment',
              'downPayment',
            ]);

            if (paymentPoIdColumn) {
              const paymentRecord: Record<string, unknown> = {
                [paymentPoIdColumn]: purchaseOrderId,
              };

              const normalizedPaymentStatus = String(
                paymentDetails.status ?? 'unpaid',
              ).trim().toLowerCase();
              const downPayment = this.toOptionalNumber(paymentDetails.downPayment);
              const providedPaymentAmount = this.toOptionalNumber(paymentDetails.amount);

              const fallbackPaymentAmount =
                normalizedPaymentStatus === 'paid'
                  ? totalAmount
                  : (downPayment ?? 0);

              const paymentAmount =
                providedPaymentAmount !== null ? providedPaymentAmount : fallbackPaymentAmount;

              if (amountColumn) {
                paymentRecord[amountColumn] = paymentAmount;
              }
              if (methodColumn && paymentDetails.method) {
                paymentRecord[methodColumn] = String(paymentDetails.method).trim();
              }

              const paymentDate = this.toIsoDateOrNull(paymentDetails.paymentDate);
              if (paymentDateColumn && paymentDate) {
                paymentRecord[paymentDateColumn] = paymentDate;
              }

              if (termsColumn && paymentDetails.terms) {
                paymentRecord[termsColumn] = String(paymentDetails.terms).trim();
              }

              const termsDueDate = this.toIsoDateOrNull(paymentDetails.termsDueDate);
              if (termsDueDateColumn && termsDueDate) {
                paymentRecord[termsDueDateColumn] = termsDueDate;
              }

              if (paymentStatusColumn && paymentDetails.status) {
                paymentRecord[paymentStatusColumn] = String(paymentDetails.status).trim();
              }

              if (downPaymentColumn && downPayment !== null) {
                paymentRecord[downPaymentColumn] = downPayment;
              }

              await this.runInsert(client, 'tblpo_payments', paymentRecord);
            }
          }
        }

        const transactionItemColumns = await this.getTableColumns(
          client,
          'tbltransaction_product_items',
        );
        if (transactionItemColumns.length > 0) {
          const transTypeColumn = this.pickColumn(transactionItemColumns, [
            'transType',
            'trans_type',
          ]);
          const productIdColumn = this.pickColumn(transactionItemColumns, [
            'productId',
            'product_id',
          ]);
          const capacityIdColumn = this.pickColumn(transactionItemColumns, [
            'capacityId',
            'capacity_id',
          ]);
          const unitPriceColumn = this.pickColumn(transactionItemColumns, [
            'unitPrice',
            'unit_price',
          ]);
          const sellPriceColumn = this.pickColumn(transactionItemColumns, [
            'sellPrice',
            'sell_price',
          ]);
          const discountPriceColumn = this.pickColumn(transactionItemColumns, [
            'discountPrice',
            'discount_price',
          ]);
          const unitTypesQtyColumn = this.pickColumn(transactionItemColumns, [
            'unitTypesQty',
            'unit_types_qty',
          ]);
          const totalSetQtyColumn = this.pickColumn(transactionItemColumns, [
            'totalSetQty',
            'total_set_qty',
          ]);
          const purchaseIdColumn = this.pickColumn(transactionItemColumns, [
            'purchaseId',
            'purchase_id',
            'po_id',
          ]);
          const salesIdColumn = this.pickColumn(transactionItemColumns, [
            'salesId',
            'sales_id',
          ]);
          const statusColumn = this.pickColumn(transactionItemColumns, ['status']);
          const createdByColumn = this.pickColumn(transactionItemColumns, [
            'created_by',
            'createdBy',
            'createdby',
          ]);
          const unitTypesQtyMeta = unitTypesQtyColumn
            ? await this.getColumnMeta(
                client,
                'tbltransaction_product_items',
                unitTypesQtyColumn,
              )
            : null;

          for (const item of productItems) {
            const transType = String(item.transType ?? 'purchase').trim().toLowerCase();
            if (transType !== 'purchase') {
              continue;
            }

            const productId = this.toOptionalNumber(item.productId);
            const capacityId = this.toOptionalNumber(item.capacityId);
            if (productId === null || capacityId === null) {
              throw new Error('productId and capacityId are required for purchase items');
            }

            const productExistsResult = await client.query<{ id: string | number }>(
              `SELECT id
               FROM tblproducts
               WHERE id::text = $1
               LIMIT 1`,
              [String(productId)],
            );

            if (productExistsResult.rowCount === 0) {
              throw new Error(`Product ID ${productId} does not exist in tblproducts`);
            }

            const capacityExistsResult = await client.query<{ id: string | number }>(
              `SELECT id
               FROM tblcapacity
               WHERE id::text = $1
               LIMIT 1`,
              [String(capacityId)],
            );

            if (capacityExistsResult.rowCount === 0) {
              throw new Error(`Capacity ID ${capacityId} does not exist in tblcapacity`);
            }

            const unitTypesQty = Array.isArray(item.unitTypesQty) ? item.unitTypesQty : [];
            const qtyFromList = unitTypesQty.reduce((sum, current) => {
              const parsedQty = this.toOptionalNumber(current.qty ?? current.value) ?? 0;
              return sum + (parsedQty > 0 ? parsedQty : 0);
            }, 0);
            const fallbackTotalQty = this.toOptionalNumber(item.totalSetQty) ?? 0;
            const totalQty = qtyFromList > 0 ? qtyFromList : fallbackTotalQty;

            const itemRecord: Record<string, unknown> = {};
            if (transTypeColumn) {
              itemRecord[transTypeColumn] = transType;
            }
            if (productIdColumn) {
              itemRecord[productIdColumn] = productId;
            }
            if (capacityIdColumn) {
              itemRecord[capacityIdColumn] = capacityId;
            }
            if (unitPriceColumn) {
              itemRecord[unitPriceColumn] = this.toOptionalNumber(item.unitPrice) ?? 0;
            }
            if (sellPriceColumn) {
              itemRecord[sellPriceColumn] = this.toOptionalNumber(item.sellPrice) ?? 0;
            }
            if (discountPriceColumn) {
              itemRecord[discountPriceColumn] =
                this.toOptionalNumber(item.discountPrice) ?? 0;
            }
            if (unitTypesQtyColumn) {
              const normalizedUnitTypesQty = unitTypesQty.map((entry) => ({
                label: String(entry.label ?? entry.unitType ?? 'set').trim() || 'set',
                value: this.toOptionalNumber(entry.value ?? entry.qty) ?? 0,
              }));

              if (
                unitTypesQtyMeta &&
                (unitTypesQtyMeta.data_type === 'ARRAY' ||
                  unitTypesQtyMeta.udt_name.startsWith('_'))
              ) {
                itemRecord[unitTypesQtyColumn] = normalizedUnitTypesQty.map(
                  (entry) => `${entry.label}:${entry.value}`,
                );
              } else {
                itemRecord[unitTypesQtyColumn] = JSON.stringify(normalizedUnitTypesQty);
              }
            }
            if (totalSetQtyColumn) {
              itemRecord[totalSetQtyColumn] = totalQty;
            }
            if (purchaseIdColumn) {
              itemRecord[purchaseIdColumn] =
                this.toOptionalNumber(item.purchaseId) ?? purchaseOrderId;
            }
            if (salesIdColumn) {
              itemRecord[salesIdColumn] = this.toOptionalNumber(item.salesId);
            }
            if (statusColumn) {
              itemRecord[statusColumn] = 'pending';
            }
            if (createdByColumn && userId) {
              itemRecord[createdByColumn] = userId;
            }

            if (Object.keys(itemRecord).length > 0) {
              await this.runInsert(client, 'tbltransaction_product_items', itemRecord);
            }
          }
        }

        return {
          purchaseOrderId,
          poNumber: resolvedPoNumber,
          vendorId: resolvedVendorId,
          computedTotalAmount: totalAmount,
        };
      });

      return {
        success: true,
        message: 'Purchase request created successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create purchase request',
      };
    }
  }

  async findAll(query: ListPurchaseQueryDto) {
    return this.getMasterData(query);
  }

  async getDeliveries(query: ListPurchaseQueryDto): Promise<PurchaseListResponseDto> {
    return this.fetchByMode('deliveries', query);
  }

  async getApprovals(query: ListPurchaseQueryDto): Promise<PurchaseListResponseDto> {
    return this.fetchByMode('approvals', query);
  }

  async getMasterData(query: ListPurchaseQueryDto): Promise<PurchaseListResponseDto> {
    return this.fetchByMode('master-data', query);
  }

  findOne(id: number) {
    return `This action returns a #${id} purchase`;
  }

  async update(
    id: number,
    updatePurchaseDto: UpdatePurchaseDto,
    userId?: number,
    branchId?: number,
  ) {
    if (!Number.isFinite(id) || id <= 0) {
      return { success: false, message: 'Invalid purchase id' };
    }

    if (!updatePurchaseDto || typeof updatePurchaseDto !== 'object') {
      return {
        success: false,
        message:
          'Invalid request body. Ensure JSON object payload is provided to PATCH /purchase/:id.',
      };
    }

    const payload = updatePurchaseDto as UpdatePurchaseDto;

    try {
      const result = await this.databaseService.withTransaction(async (client) => {
        const existingPurchaseResult = await client.query<{
          id: number;
          vendor_id: string | null;
          po_number: string | null;
          total_amount: string | null;
          status: string | null;
        }>(
          `SELECT
             po.id,
             po.vendor_id::text AS vendor_id,
             po.po_number::text AS po_number,
             po.total_amount::text AS total_amount,
             po.status::text AS status
           FROM tblpurchase_orders po
           WHERE po.id = $1
           LIMIT 1`,
          [id],
        );

        if (existingPurchaseResult.rowCount === 0) {
          throw new Error(`Purchase order ${id} not found`);
        }

        const existingPurchase = existingPurchaseResult.rows[0];
        let resolvedVendorId = String(
          payload.vendorId ?? existingPurchase.vendor_id ?? '',
        ).trim();
        const vendorName = String(payload.vendor?.name ?? '').trim();

        const vendorColumns = await this.getTableColumns(client, 'tblvendors');
        const vendorIdColumn = this.pickColumn(vendorColumns, ['id']);
        const vendorNameColumn = this.pickColumn(vendorColumns, ['name']);
        const vendorAddressColumn = this.pickColumn(vendorColumns, ['address']);
        const contactPersonColumn = this.pickColumn(vendorColumns, [
          'contact_person',
          'contactPerson',
        ]);
        const contactNumberColumn = this.pickColumn(vendorColumns, [
          'contact_number',
          'contactNumber',
        ]);

        if (resolvedVendorId) {
          const existingVendorResult = await client.query<{ id: string | number }>(
            `SELECT id
             FROM tblvendors
             WHERE id::text = $1
             LIMIT 1`,
            [resolvedVendorId],
          );

          if (existingVendorResult.rowCount === 0 && payload.vendor) {
            if (!vendorNameColumn || !vendorName) {
              throw new Error('vendor.name is required when vendorId does not exist');
            }

            const vendorRecord: Record<string, unknown> = {
              [vendorNameColumn]: vendorName,
            };
            if (vendorIdColumn) {
              vendorRecord[vendorIdColumn] = resolvedVendorId;
            }

            const vendorAddress = String(payload.vendor.address ?? '').trim();
            const contactPerson = String(
              payload.vendor.contact_person ?? '',
            ).trim();
            const contactNumber = String(
              payload.vendor.contact_number ?? '',
            ).trim();

            if (vendorAddressColumn && vendorAddress) {
              vendorRecord[vendorAddressColumn] = vendorAddress;
            }
            if (contactPersonColumn && contactPerson) {
              vendorRecord[contactPersonColumn] = contactPerson;
            }
            if (contactNumberColumn && contactNumber) {
              vendorRecord[contactNumberColumn] = contactNumber;
            }

            await this.runInsert(client, 'tblvendors', vendorRecord);
          }

          if (existingVendorResult.rowCount > 0 && payload.vendor) {
            const vendorUpdates: string[] = [];
            const vendorParams: unknown[] = [];

            const vendorAddress = String(payload.vendor.address ?? '').trim();
            const contactPerson = String(
              payload.vendor.contact_person ?? '',
            ).trim();
            const contactNumber = String(
              payload.vendor.contact_number ?? '',
            ).trim();

            if (vendorNameColumn && vendorName) {
              vendorParams.push(vendorName);
              vendorUpdates.push(`"${vendorNameColumn}" = $${vendorParams.length}`);
            }
            if (vendorAddressColumn && vendorAddress) {
              vendorParams.push(vendorAddress);
              vendorUpdates.push(`"${vendorAddressColumn}" = $${vendorParams.length}`);
            }
            if (contactPersonColumn && contactPerson) {
              vendorParams.push(contactPerson);
              vendorUpdates.push(`"${contactPersonColumn}" = $${vendorParams.length}`);
            }
            if (contactNumberColumn && contactNumber) {
              vendorParams.push(contactNumber);
              vendorUpdates.push(`"${contactNumberColumn}" = $${vendorParams.length}`);
            }

            if (vendorUpdates.length > 0) {
              vendorParams.push(resolvedVendorId);
              await client.query(
                `UPDATE tblvendors
                 SET ${vendorUpdates.join(', ')}
                 WHERE id::text = $${vendorParams.length}`,
                vendorParams,
              );
            }
          }
        }

        if (!resolvedVendorId && payload.vendor) {
          if (!vendorNameColumn || !vendorName) {
            throw new Error('vendor.name is required when vendorId is not provided');
          }

          const vendorRecord: Record<string, unknown> = {
            [vendorNameColumn]: vendorName,
          };
          if (vendorIdColumn) {
            vendorRecord[vendorIdColumn] = randomUUID();
          }

          const vendorAddress = String(payload.vendor.address ?? '').trim();
          const contactPerson = String(
            payload.vendor.contact_person ?? '',
          ).trim();
          const contactNumber = String(
            payload.vendor.contact_number ?? '',
          ).trim();

          if (vendorAddressColumn && vendorAddress) {
            vendorRecord[vendorAddressColumn] = vendorAddress;
          }
          if (contactPersonColumn && contactPerson) {
            vendorRecord[contactPersonColumn] = contactPerson;
          }
          if (contactNumberColumn && contactNumber) {
            vendorRecord[contactNumberColumn] = contactNumber;
          }

          const insertedVendor = await this.runInsert(client, 'tblvendors', vendorRecord);
          resolvedVendorId = String(insertedVendor.rows[0].id);
        }

        if (!resolvedVendorId) {
          throw new Error('Unable to resolve vendorId for purchase update');
        }

        const productItems = Array.isArray(payload.productItems)
          ? payload.productItems
          : [];

        let computedTotalAmount = 0;
        for (const item of productItems) {
          const itemUnitPrice = this.toOptionalNumber(item.unitPrice) ?? 0;
          const itemDiscountPrice = this.toOptionalNumber(item.discountPrice) ?? 0;
          const priceToUse = itemDiscountPrice > 0 ? itemDiscountPrice : itemUnitPrice;
          const qty = this.toOptionalNumber(item.totalSetQty) ?? 0;
          computedTotalAmount += priceToUse * qty;
        }

        const fallbackTotal =
          this.toOptionalNumber(payload.totalAmount) ??
          this.toOptionalNumber(existingPurchase.total_amount) ??
          0;
        const totalAmount =
          productItems.length > 0 && computedTotalAmount > 0
            ? computedTotalAmount
            : fallbackTotal;

        const status = String(
          payload.purchaseStatus ?? payload.status ?? existingPurchase.status ?? 'pending',
        ).trim() || 'pending';
        const poNumber = String(payload.poNumber ?? '').trim();

        if (poNumber && poNumber !== (existingPurchase.po_number ?? '').trim()) {
          const duplicatePoResult = await client.query<{ id: number }>(
            `SELECT id
             FROM tblpurchase_orders po
             WHERE LOWER(TRIM(COALESCE(
               to_jsonb(po)->>'po_number',
               to_jsonb(po)->>'poNumber',
               to_jsonb(po)->>'po_no',
               ''
             ))) = LOWER(TRIM($1))
             AND po.id <> $2
             LIMIT 1`,
            [poNumber, id],
          );

          if (duplicatePoResult.rowCount > 0) {
            throw new Error('PO number already exists');
          }
        }

        const purchaseColumns = await this.getTableColumns(client, 'tblpurchase_orders');
        const poNumberColumn = this.pickColumn(purchaseColumns, ['po_number', 'poNumber', 'po_no']);
        const purchaseVendorIdColumn = this.pickColumn(purchaseColumns, ['vendor_id', 'vendorId']);
        const totalAmountColumn = this.pickColumn(purchaseColumns, ['total_amount', 'totalAmount']);
        const statusColumn = this.pickColumn(purchaseColumns, ['status']);

        if (!purchaseVendorIdColumn || !totalAmountColumn || !statusColumn) {
          throw new Error('tblpurchase_orders columns are not aligned with expected fields');
        }

        const purchaseUpdates: string[] = [];
        const purchaseParams: unknown[] = [];

        purchaseParams.push(resolvedVendorId);
        purchaseUpdates.push(`"${purchaseVendorIdColumn}" = $${purchaseParams.length}`);

        purchaseParams.push(totalAmount);
        purchaseUpdates.push(`"${totalAmountColumn}" = $${purchaseParams.length}`);

        purchaseParams.push(status);
        purchaseUpdates.push(`"${statusColumn}" = $${purchaseParams.length}`);

        if (poNumberColumn && poNumber) {
          purchaseParams.push(poNumber);
          purchaseUpdates.push(`"${poNumberColumn}" = $${purchaseParams.length}`);
        }

        purchaseParams.push(id);
        await client.query(
          `UPDATE tblpurchase_orders
           SET ${purchaseUpdates.join(', ')}
           WHERE id = $${purchaseParams.length}`,
          purchaseParams,
        );

        const paymentDetails = payload.paymentDetails;
        if (paymentDetails) {
          const paymentColumns = await this.getTableColumns(client, 'tblpo_payments');
          const paymentPoIdColumn = this.pickColumn(paymentColumns, ['po_id', 'poId']);
          const amountColumn = this.pickColumn(paymentColumns, ['amount']);
          const methodColumn = this.pickColumn(paymentColumns, ['method']);
          const paymentDateColumn = this.pickColumn(paymentColumns, ['payment_date', 'paymentDate']);
          const termsColumn = this.pickColumn(paymentColumns, ['terms']);
          const termsDueDateColumn = this.pickColumn(paymentColumns, ['terms_due_date', 'termsDueDate']);
          const paymentStatusColumn = this.pickColumn(paymentColumns, ['status']);
          const downPaymentColumn = this.pickColumn(paymentColumns, ['down_payment', 'downPayment']);

          if (paymentPoIdColumn) {
            const normalizedPaymentStatus = String(
              paymentDetails.status ?? 'unpaid',
            ).trim().toLowerCase();
            const downPayment = this.toOptionalNumber(paymentDetails.downPayment);
            const providedPaymentAmount = this.toOptionalNumber(paymentDetails.amount);
            const fallbackPaymentAmount =
              normalizedPaymentStatus === 'paid' ? totalAmount : downPayment ?? 0;
            const paymentAmount =
              providedPaymentAmount !== null ? providedPaymentAmount : fallbackPaymentAmount;

            const paymentRecord: Record<string, unknown> = {
              [paymentPoIdColumn]: id,
            };

            if (amountColumn) {
              paymentRecord[amountColumn] = paymentAmount;
            }
            if (methodColumn && paymentDetails.method) {
              paymentRecord[methodColumn] = String(paymentDetails.method).trim();
            }

            const paymentDate = this.toIsoDateOrNull(paymentDetails.paymentDate);
            if (paymentDateColumn && paymentDate) {
              paymentRecord[paymentDateColumn] = paymentDate;
            }

            if (termsColumn && paymentDetails.terms) {
              paymentRecord[termsColumn] = String(paymentDetails.terms).trim();
            }

            const termsDueDate = this.toIsoDateOrNull(paymentDetails.termsDueDate);
            if (termsDueDateColumn && termsDueDate) {
              paymentRecord[termsDueDateColumn] = termsDueDate;
            }

            if (paymentStatusColumn && paymentDetails.status) {
              paymentRecord[paymentStatusColumn] = String(paymentDetails.status).trim();
            }

            if (downPaymentColumn && downPayment !== null) {
              paymentRecord[downPaymentColumn] = downPayment;
            }

            const existingPaymentResult = await client.query<{ id: number }>(
              `SELECT id
               FROM tblpo_payments pp
               WHERE COALESCE(to_jsonb(pp)->>'po_id', to_jsonb(pp)->>'poId') = $1
               ORDER BY pp.id DESC
               LIMIT 1`,
              [String(id)],
            );

            if (existingPaymentResult.rowCount > 0) {
              const paymentId = existingPaymentResult.rows[0].id;
              const paymentCols = Object.keys(paymentRecord);
              const paymentValues = Object.values(paymentRecord);
              const setClause = paymentCols
                .map((column, index) => `"${column}" = $${index + 1}`)
                .join(', ');

              await client.query(
                `UPDATE tblpo_payments
                 SET ${setClause}
                 WHERE id = $${paymentValues.length + 1}`,
                [...paymentValues, paymentId],
              );
            } else {
              await this.runInsert(client, 'tblpo_payments', paymentRecord);
            }
          }
        }

        if (productItems.length > 0) {
          const transactionItemColumns = await this.getTableColumns(
            client,
            'tbltransaction_product_items',
          );

          const transTypeColumn = this.pickColumn(transactionItemColumns, [
            'transType',
            'trans_type',
          ]);
          const productIdColumn = this.pickColumn(transactionItemColumns, [
            'productId',
            'product_id',
          ]);
          const capacityIdColumn = this.pickColumn(transactionItemColumns, [
            'capacityId',
            'capacity_id',
          ]);
          const unitPriceColumn = this.pickColumn(transactionItemColumns, [
            'unitPrice',
            'unit_price',
          ]);
          const sellPriceColumn = this.pickColumn(transactionItemColumns, [
            'sellPrice',
            'sell_price',
          ]);
          const discountPriceColumn = this.pickColumn(transactionItemColumns, [
            'discountPrice',
            'discount_price',
          ]);
          const unitTypesQtyColumn = this.pickColumn(transactionItemColumns, [
            'unitTypesQty',
            'unit_types_qty',
          ]);
          const totalSetQtyColumn = this.pickColumn(transactionItemColumns, [
            'totalSetQty',
            'total_set_qty',
          ]);
          const purchaseIdColumn = this.pickColumn(transactionItemColumns, [
            'purchaseId',
            'purchase_id',
            'po_id',
          ]);
          const salesIdColumn = this.pickColumn(transactionItemColumns, [
            'salesId',
            'sales_id',
          ]);
          const itemStatusColumn = this.pickColumn(transactionItemColumns, ['status']);
          const itemCreatedByColumn = this.pickColumn(transactionItemColumns, [
            'created_by',
            'createdBy',
            'createdby',
          ]);
          const unitTypesQtyMeta = unitTypesQtyColumn
            ? await this.getColumnMeta(
                client,
                'tbltransaction_product_items',
                unitTypesQtyColumn,
              )
            : null;

          await client.query(
            `DELETE FROM tbltransaction_product_items
             WHERE COALESCE(
               to_jsonb(tbltransaction_product_items)->>'purchaseId',
               to_jsonb(tbltransaction_product_items)->>'purchase_id',
               to_jsonb(tbltransaction_product_items)->>'po_id'
             ) = $1
             AND LOWER(COALESCE(
               to_jsonb(tbltransaction_product_items)->>'transType',
               to_jsonb(tbltransaction_product_items)->>'trans_type',
               'purchase'
             )) = 'purchase'`,
            [String(id)],
          );

          const serialColumns = await this.getTableColumns(client, 'tblserial_numbers');
          const serialBranchIdColumn = this.pickColumn(serialColumns, ['branchId', 'branch_id']);
          const serialVendorIdColumn = this.pickColumn(serialColumns, ['vendorId', 'vendor_id']);
          const serialPurchaseIdColumn = this.pickColumn(serialColumns, [
            'purchaseId',
            'purchase_id',
          ]);
          const serialSalesIdColumn = this.pickColumn(serialColumns, ['salesId', 'sales_id']);
          const serialProductIdColumn = this.pickColumn(serialColumns, [
            'productId',
            'product_id',
          ]);
          const serialCapacityIdColumn = this.pickColumn(serialColumns, [
            'capacityId',
            'capacity_id',
          ]);
          const serialNumberColumn = this.pickColumn(serialColumns, [
            'serialNumber',
            'serial_number',
          ]);
          const serialUnitTypeColumn = this.pickColumn(serialColumns, ['unitType', 'unit_type']);
          const serialStatusColumn = this.pickColumn(serialColumns, ['status']);
          const serialCreatedByColumn = this.pickColumn(serialColumns, [
            'created_by',
            'createdBy',
            'createdby',
          ]);

          for (const item of productItems) {
            const transType = String(item.transType ?? 'purchase').trim().toLowerCase();
            if (transType !== 'purchase') {
              continue;
            }

            const productId = this.toOptionalNumber(item.productId);
            const capacityId = this.toOptionalNumber(item.capacityId);
            if (productId === null || capacityId === null) {
              throw new Error('productId and capacityId are required for purchase items');
            }

            const productExistsResult = await client.query<{ id: string | number }>(
              `SELECT id FROM tblproducts WHERE id::text = $1 LIMIT 1`,
              [String(productId)],
            );
            if (productExistsResult.rowCount === 0) {
              throw new Error(`Product ID ${productId} does not exist in tblproducts`);
            }

            const capacityExistsResult = await client.query<{ id: string | number }>(
              `SELECT id FROM tblcapacity WHERE id::text = $1 LIMIT 1`,
              [String(capacityId)],
            );
            if (capacityExistsResult.rowCount === 0) {
              throw new Error(`Capacity ID ${capacityId} does not exist in tblcapacity`);
            }

            const unitTypesQty = Array.isArray(item.unitTypesQty) ? item.unitTypesQty : [];
            const qtyFromList = unitTypesQty.reduce((sum, current) => {
              const parsedQty = this.toOptionalNumber(current.qty ?? current.value) ?? 0;
              return sum + (parsedQty > 0 ? parsedQty : 0);
            }, 0);
            const fallbackTotalQty = this.toOptionalNumber(item.totalSetQty) ?? 0;
            const totalQty = qtyFromList > 0 ? qtyFromList : fallbackTotalQty;

            const itemRecord: Record<string, unknown> = {};
            if (transTypeColumn) {
              itemRecord[transTypeColumn] = transType;
            }
            if (productIdColumn) {
              itemRecord[productIdColumn] = productId;
            }
            if (capacityIdColumn) {
              itemRecord[capacityIdColumn] = capacityId;
            }
            if (unitPriceColumn) {
              itemRecord[unitPriceColumn] = this.toOptionalNumber(item.unitPrice) ?? 0;
            }
            if (sellPriceColumn) {
              itemRecord[sellPriceColumn] = this.toOptionalNumber(item.sellPrice) ?? 0;
            }
            if (discountPriceColumn) {
              itemRecord[discountPriceColumn] = this.toOptionalNumber(item.discountPrice) ?? 0;
            }

            if (unitTypesQtyColumn) {
              const normalizedUnitTypesQty = unitTypesQty.map((entry) => ({
                label: String(entry.label ?? entry.unitType ?? 'set').trim() || 'set',
                value: this.toOptionalNumber(entry.value ?? entry.qty) ?? 0,
              }));

              if (
                unitTypesQtyMeta &&
                (unitTypesQtyMeta.data_type === 'ARRAY' ||
                  unitTypesQtyMeta.udt_name.startsWith('_'))
              ) {
                itemRecord[unitTypesQtyColumn] = normalizedUnitTypesQty.map(
                  (entry) => `${entry.label}:${entry.value}`,
                );
              } else {
                itemRecord[unitTypesQtyColumn] = JSON.stringify(normalizedUnitTypesQty);
              }
            }

            if (totalSetQtyColumn) {
              itemRecord[totalSetQtyColumn] = totalQty;
            }
            if (purchaseIdColumn) {
              itemRecord[purchaseIdColumn] = id;
            }
            if (salesIdColumn) {
              itemRecord[salesIdColumn] = this.toOptionalNumber(item.salesId);
            }
            if (itemStatusColumn) {
              itemRecord[itemStatusColumn] = 'pending';
            }
            if (itemCreatedByColumn && userId) {
              itemRecord[itemCreatedByColumn] = userId;
            }

            if (Object.keys(itemRecord).length > 0) {
              await this.runInsert(client, 'tbltransaction_product_items', itemRecord);
            }

            const serialPayload =
              item.serialNumbers && typeof item.serialNumbers === 'object'
                ? (item.serialNumbers as Record<string, unknown>)
                : {};

            const serialStatus = String(serialPayload.status ?? 'scanned')
              .trim()
              .toLowerCase() || 'scanned';

            for (const [unitTypeKey, values] of Object.entries(serialPayload)) {
              if (unitTypeKey.toLowerCase() === 'status') {
                continue;
              }

              const serialList = Array.isArray(values) ? values : [];

              for (const serialRaw of serialList) {
                const normalizedSerial = this.normalizeSerialNumber(serialRaw);
                if (!normalizedSerial || !serialNumberColumn) {
                  continue;
                }

                const existingSerialResult = await client.query<{ id: number; purchase_id: string | null }>(
                  `SELECT
                     sn.id,
                     sn."purchaseId"::text AS purchase_id
                   FROM tblserial_numbers sn
                   WHERE LOWER(
                     regexp_replace(BTRIM(COALESCE(sn."serialNumber", '')), '\\s+', ' ', 'g')
                   ) = LOWER($1)
                   LIMIT 1`,
                  [normalizedSerial],
                );

                const serialRecord: Record<string, unknown> = {};
                if (serialBranchIdColumn && branchId) {
                  serialRecord[serialBranchIdColumn] = branchId;
                }
                if (serialVendorIdColumn) {
                  serialRecord[serialVendorIdColumn] = resolvedVendorId;
                }
                if (serialPurchaseIdColumn) {
                  serialRecord[serialPurchaseIdColumn] = id;
                }
                if (serialSalesIdColumn) {
                  serialRecord[serialSalesIdColumn] = null;
                }
                if (serialProductIdColumn) {
                  serialRecord[serialProductIdColumn] = productId;
                }
                if (serialCapacityIdColumn) {
                  serialRecord[serialCapacityIdColumn] = capacityId;
                }
                serialRecord[serialNumberColumn] = normalizedSerial;
                if (serialUnitTypeColumn) {
                  serialRecord[serialUnitTypeColumn] = unitTypeKey;
                }
                if (serialStatusColumn) {
                  serialRecord[serialStatusColumn] = serialStatus;
                }
                if (serialCreatedByColumn && userId) {
                  serialRecord[serialCreatedByColumn] = userId;
                }

                if (existingSerialResult.rowCount > 0) {
                  const existingSerial = existingSerialResult.rows[0];
                  if (
                    existingSerial.purchase_id &&
                    Number(existingSerial.purchase_id) !== id
                  ) {
                    throw new Error(
                      `Serial number ${normalizedSerial} is already linked to purchase ${existingSerial.purchase_id}`,
                    );
                  }

                  const updateColumns = Object.keys(serialRecord);
                  const updateValues = Object.values(serialRecord);
                  const setClause = updateColumns
                    .map((column, idx) => `"${column}" = $${idx + 1}`)
                    .join(', ');

                  await client.query(
                    `UPDATE tblserial_numbers
                     SET ${setClause}
                     WHERE id = $${updateValues.length + 1}`,
                    [...updateValues, existingSerial.id],
                  );
                } else {
                  await this.runInsert(client, 'tblserial_numbers', serialRecord);
                }
              }
            }
          }
        }

        return {
          purchaseOrderId: id,
          vendorId: resolvedVendorId,
          totalAmount,
        };
      });

      return {
        success: true,
        message: 'Purchase order updated successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update purchase order',
      };
    }
  }

  remove(id: number) {
    return `This action removes a #${id} purchase`;
  }

  private async fetchByMode(
    mode: PurchaseMode,
    query: ListPurchaseQueryDto,
  ): Promise<PurchaseListResponseDto> {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const offset = (page - 1) * limit;
    const search = (query.search ?? '').trim().toLowerCase();

    const params: unknown[] = [];
    const whereParts: string[] = [];

    if (mode === 'deliveries') {
      whereParts.push(`LOWER(COALESCE(base.original_status, '')) NOT IN (
        'for_approval', 'for approval', 'approval', 'approved', 'completed', 'cancelled', 'rejected'
      )`);
    } else if (mode === 'approvals') {
      whereParts.push(`LOWER(COALESCE(base.original_status, '')) IN (
        'for_approval', 'for approval', 'approval', 'pending_approval', 'pending approval'
      )`);
    }

    if (search) {
      params.push(`%${search}%`);
      const searchIndex = params.length;
      whereParts.push(`(
        LOWER(COALESCE(base.po_number, '')) LIKE $${searchIndex}
        OR LOWER(COALESCE(base.vendor_name, '')) LIKE $${searchIndex}
        OR LOWER(COALESCE(base.computed_status, '')) LIKE $${searchIndex}
      )`);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const computedStatusExpression =
      mode === 'deliveries'
        ? `CASE
             WHEN COALESCE(sc.serial_count, 0) > 0 THEN 'in-progress'
             ELSE 'pending'
           END`
        : `COALESCE(po.status, 'pending')`;

    const baseCte = `
      WITH serial_counts AS (
        SELECT
          COALESCE(
            to_jsonb(tpi)->>'purchaseId',
            to_jsonb(tpi)->>'purchase_id',
            to_jsonb(tpi)->>'po_id'
          ) AS po_id,
          SUM(
            CASE
              WHEN COALESCE(
                to_jsonb(tpi)->>'totalSetQty',
                to_jsonb(tpi)->>'total_set_qty',
                ''
              ) ~ '^-?\\d+$'
                THEN COALESCE(
                  to_jsonb(tpi)->>'totalSetQty',
                  to_jsonb(tpi)->>'total_set_qty',
                  '0'
                )::int
              ELSE 0
            END
          )::int AS serial_count
        FROM tbltransaction_product_items tpi
        WHERE LOWER(COALESCE(to_jsonb(tpi)->>'transType', to_jsonb(tpi)->>'trans_type', 'purchase')) = 'purchase'
        GROUP BY COALESCE(
          to_jsonb(tpi)->>'purchaseId',
          to_jsonb(tpi)->>'purchase_id',
          to_jsonb(tpi)->>'po_id'
        )
      ),
      base AS (
        SELECT
          po.id,
          po.po_number,
          po.vendor_id::text AS vendor_id,
          v.name AS vendor_name,
          po.total_amount,
          COALESCE(po.status, 'pending') AS original_status,
          po.created_at,
          COALESCE(sc.serial_count, 0)::int AS serial_count,
          ${computedStatusExpression} AS computed_status
        FROM tblpurchase_orders po
        LEFT JOIN tblvendors v
          ON v.id::text = po.vendor_id::text
        LEFT JOIN serial_counts sc
          ON sc.po_id = po.id::text
      )
    `;

    const countSql = `
      ${baseCte}
      SELECT COUNT(*)::text AS total
      FROM base
      ${whereSql}
    `;

    const countResult = await this.databaseService.query<PurchaseCountRow>(countSql, params);
    const total = Number(countResult.rows[0]?.total ?? 0);

    params.push(limit);
    params.push(offset);
    const limitIndex = params.length - 1;
    const offsetIndex = params.length;

    const listSql = `
      ${baseCte}
      SELECT
        base.id,
        base.po_number AS "poNumber",
        base.vendor_id AS "vendorId",
        base.vendor_name AS "vendorName",
        COALESCE(to_jsonb(v)->>'address', '') AS "vendorAddress",
        COALESCE(
          to_jsonb(v)->>'contact_person',
          to_jsonb(v)->>'contactPerson',
          ''
        ) AS "vendorContactPerson",
        COALESCE(
          to_jsonb(v)->>'contact_number',
          to_jsonb(v)->>'contactNumber',
          ''
        ) AS "vendorContactNumber",
        base.total_amount::text AS "totalAmount",
        base.computed_status AS status,
        (
          SELECT json_build_object(
            'method', COALESCE(to_jsonb(pp)->>'method', null),
            'amount', COALESCE(NULLIF(to_jsonb(pp)->>'amount', '')::numeric, 0),
            'terms', COALESCE(to_jsonb(pp)->>'terms', null),
            'termsDueDate', COALESCE(
              to_jsonb(pp)->>'terms_due_date',
              to_jsonb(pp)->>'termsDueDate',
              null
            ),
            'status', COALESCE(to_jsonb(pp)->>'status', null),
            'paymentDate', COALESCE(
              to_jsonb(pp)->>'payment_date',
              to_jsonb(pp)->>'paymentDate',
              null
            ),
            'downPayment', COALESCE(
              NULLIF(
                COALESCE(
                  to_jsonb(pp)->>'down_payment',
                  to_jsonb(pp)->>'downPayment',
                  ''
                ),
                ''
              )::numeric,
              0
            )
          )
          FROM tblpo_payments pp
          WHERE COALESCE(
            to_jsonb(pp)->>'po_id',
            to_jsonb(pp)->>'poId'
          ) = base.id::text
          ORDER BY pp.id DESC
          LIMIT 1
        ) AS "paymentDetails",
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', tpi.id,
                'transType', COALESCE(
                  to_jsonb(tpi)->>'transType',
                  to_jsonb(tpi)->>'trans_type',
                  'purchase'
                ),
                'productId', COALESCE(
                  to_jsonb(tpi)->>'productId',
                  to_jsonb(tpi)->>'product_id'
                ),
                'capacityId', COALESCE(
                  to_jsonb(tpi)->>'capacityId',
                  to_jsonb(tpi)->>'capacity_id'
                ),
                'unitPrice', COALESCE(
                  NULLIF(
                    COALESCE(to_jsonb(tpi)->>'unitPrice', to_jsonb(tpi)->>'unit_price', ''),
                    ''
                  )::numeric,
                  0
                ),
                'sellPrice', COALESCE(
                  NULLIF(
                    COALESCE(to_jsonb(tpi)->>'sellPrice', to_jsonb(tpi)->>'sell_price', ''),
                    ''
                  )::numeric,
                  0
                ),
                'discountPrice', COALESCE(
                  NULLIF(
                    COALESCE(
                      to_jsonb(tpi)->>'discountPrice',
                      to_jsonb(tpi)->>'discount_price',
                      ''
                    ),
                    ''
                  )::numeric,
                  0
                ),
                'unitTypesQty', COALESCE(
                  to_jsonb(tpi)->'unitTypesQty',
                  to_jsonb(tpi)->'unit_types_qty',
                  '[]'::jsonb
                ),
                'totalSetQty', COALESCE(
                  NULLIF(
                    COALESCE(
                      to_jsonb(tpi)->>'totalSetQty',
                      to_jsonb(tpi)->>'total_set_qty',
                      ''
                    ),
                    ''
                  )::int,
                  0
                ),
                'purchaseId', COALESCE(
                  to_jsonb(tpi)->>'purchaseId',
                  to_jsonb(tpi)->>'purchase_id',
                  to_jsonb(tpi)->>'po_id'
                ),
                'salesId', COALESCE(
                  to_jsonb(tpi)->>'salesId',
                  to_jsonb(tpi)->>'sales_id'
                ),
                'status', COALESCE(to_jsonb(tpi)->>'status', null),
                'product', CASE
                  WHEN p.id IS NULL THEN NULL
                  ELSE json_build_object(
                    'id', p.id,
                    'productName', COALESCE(
                      to_jsonb(p)->>'productName',
                      to_jsonb(p)->>'product_name',
                      to_jsonb(p)->>'productname'
                    ),
                    'unit', COALESCE(to_jsonb(p)->>'unit', null),
                    'productType', COALESCE(
                      to_jsonb(p)->>'productType',
                      to_jsonb(p)->>'product_type',
                      to_jsonb(p)->>'producttype'
                    )
                  )
                END,
                'capacity', CASE
                  WHEN c.id IS NULL THEN NULL
                  ELSE json_build_object(
                    'id', c.id,
                    'capacity', COALESCE(to_jsonb(c)->>'capacity', null),
                    'indoorModel', COALESCE(
                      to_jsonb(c)->>'indoorModel',
                      to_jsonb(c)->>'indoor_model'
                    ),
                    'outdoorModel', COALESCE(
                      to_jsonb(c)->>'outdoorModel',
                      to_jsonb(c)->>'outdoor_model'
                    ),
                    'srp', COALESCE(NULLIF(to_jsonb(c)->>'srp', '')::numeric, 0),
                    'netPrice', COALESCE(
                      NULLIF(
                        COALESCE(to_jsonb(c)->>'netPrice', to_jsonb(c)->>'net_price', ''),
                        ''
                      )::numeric,
                      0
                    )
                  )
                END
              )
              ORDER BY tpi.id DESC
            ),
            '[]'::json
          )
          FROM tbltransaction_product_items tpi
          LEFT JOIN tblproducts p
            ON p.id::text = COALESCE(
              to_jsonb(tpi)->>'productId',
              to_jsonb(tpi)->>'product_id'
            )
          LEFT JOIN tblcapacity c
            ON c.id::text = COALESCE(
              to_jsonb(tpi)->>'capacityId',
              to_jsonb(tpi)->>'capacity_id'
            )
          WHERE COALESCE(
            to_jsonb(tpi)->>'purchaseId',
            to_jsonb(tpi)->>'purchase_id',
            to_jsonb(tpi)->>'po_id'
          ) = base.id::text
        ) AS "productItems",
        base.created_at::text AS "createdAt",
        base.serial_count::int AS "serialCount"
      FROM base
      LEFT JOIN tblvendors v
        ON v.id::text = base.vendor_id::text
      ${whereSql}
      ORDER BY base.created_at DESC, base.id DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    const listResult = await this.databaseService.query<PurchaseRow>(listSql, params);

    return {
      success: true,
      items: listResult.rows.map((row) => this.toPurchaseTabItem(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private normalizePage(value: number | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }

  private normalizeLimit(value: number | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 10;
    }

    return Math.min(Math.floor(parsed), 100);
  }

  private toPurchaseTabItem(row: PurchaseRow): PurchaseTabItemDto {
    const totalAmount = Number(row.totalAmount ?? 0);

    return {
      id: row.id,
      poNumber: row.poNumber ?? '-',
      vendorId: row.vendorId,
      vendorName: row.vendorName ?? 'Unknown Vendor',
      vendor: {
        id: row.vendorId,
        name: row.vendorName ?? 'Unknown Vendor',
        address: row.vendorAddress,
        contactPerson: row.vendorContactPerson,
        contactNumber: row.vendorContactNumber,
      },
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
      status: row.status ?? 'pending',
      paymentDetails:
        (row.paymentDetails as PurchaseTabItemDto['paymentDetails']) ?? null,
      productItems:
        (row.productItems as PurchaseTabItemDto['productItems']) ?? [],
      createdAt: row.createdAt,
      serialCount: row.serialCount ?? 0,
    };
  }
}
