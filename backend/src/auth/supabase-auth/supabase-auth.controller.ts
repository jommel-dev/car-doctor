import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthService } from './supabase-auth.service';

@Controller('auth/supabase')
export class SupabaseAuthController {
  constructor(private readonly authService: SupabaseAuthService) {}

  @Post('signup')
  signUp(@Body() body: { email: string; password: string }) {
    return this.authService.signUp(body.email, body.password);
  }

  @Post('signin')
  signIn(@Body() body: { email: string; password: string }) {
    return this.authService.signIn(body.email, body.password);
  }

  @Get('verify')
  verify(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const accessToken = authorization.slice('Bearer '.length);
    return this.authService.verify(accessToken);
  }
}
