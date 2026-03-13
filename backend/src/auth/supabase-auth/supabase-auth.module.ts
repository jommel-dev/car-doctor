import { Module } from '@nestjs/common';
import { SupabaseAuthController } from './supabase-auth.controller';
import { SupabaseAuthService } from './supabase-auth.service';

@Module({
  controllers: [SupabaseAuthController],
  providers: [SupabaseAuthService],
})
export class SupabaseAuthModule {}
