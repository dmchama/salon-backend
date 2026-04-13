import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export type JwtPayloadUser = {
  sub: string;
  email: string;
  role: string;
};

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayloadUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: JwtPayloadUser }>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
