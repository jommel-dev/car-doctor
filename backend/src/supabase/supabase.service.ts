import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly adminClient?: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL') ?? '';
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.client = createClient(url, anonKey);
    this.adminClient = serviceRoleKey ? createClient(url, serviceRoleKey) : undefined;
  }

  getClient() {
    return this.client;
  }

  getAdminClient() {
    return this.adminClient ?? this.client;
  }
}
