import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  register(@Body() dto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto) {
    return this.authService.login(dto);
  }
}
