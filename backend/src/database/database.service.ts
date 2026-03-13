import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    this.pool = databaseUrl
      ? new Pool({ connectionString: databaseUrl })
      : new Pool({
          host: this.configService.get<string>('DB_HOST', '127.0.0.1'),
          port: Number(this.configService.get<string>('DB_PORT', '5432')),
          database: this.configService.get<string>('DB_NAME', 'postgres'),
          user: this.configService.get<string>('DB_USER', 'postgres'),
          password: this.configService.get<string>('DB_PASSWORD', ''),
        });
  }

  async query<T = unknown>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
