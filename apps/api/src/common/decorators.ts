import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Injects req.user, or a single field: @CurrentUser('id'). */
export const CurrentUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest().user;
  return data ? user?.[data] : user;
});
