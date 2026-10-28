import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ReceiptUploadInterceptor } from '../registration-payments/receipt-upload.interceptor';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  /** JSON, or multipart/form-data with the same fields plus an optional `receipt` file (spec 002). */
  @Post('register')
  @UseInterceptors(ReceiptUploadInterceptor)
  @ApiConsumes('application/json', 'multipart/form-data')
  register(@Body() dto: RegisterDto, @UploadedFile() receipt?: Express.Multer.File) {
    return this.authService.register(dto, receipt);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
