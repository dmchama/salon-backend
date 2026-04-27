import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Roles(Role.SUPER_ADMIN, Role.SALON_ADMIN)
  async me(@CurrentUser() user: JwtPayloadUser) {
    const full = await this.usersService.findById(user.sub);
    if (!full) {
      return { message: 'User not found' };
    }
    const { passwordHash: _, ...safe } = full;
    return safe;
  }
}
