import { z } from 'zod';

export const USERNAME_RE = /^[a-zA-Z0-9_\-а-яА-ЯёЁ ]{3,20}$/u;

/**
 * Staff/admin login: email + password + secret code (ADMIN_SECRET_CODE).
 * Regular players authenticate exclusively via Steam (see steam.service).
 */
export const LoginDto = z.object({
  email: z.string().email().max(120).toLowerCase(),
  password: z.string().min(1).max(120),
  code: z.string().min(1).max(120),
});
export type LoginInput = z.infer<typeof LoginDto>;
