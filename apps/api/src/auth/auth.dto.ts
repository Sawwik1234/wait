import { z } from 'zod';

export const USERNAME_RE = /^[a-zA-Z0-9_\-а-яА-ЯёЁ ]{3,20}$/u;

export const RegisterDto = z.object({
  email: z.string().email().max(120).toLowerCase(),
  username: z.string().regex(USERNAME_RE, '3–20 chars: letters, digits, _ - space'),
  password: z.string().min(6).max(120),
});
export type RegisterInput = z.infer<typeof RegisterDto>;

export const LoginDto = z.object({
  email: z.string().email().max(120).toLowerCase(),
  password: z.string().min(1).max(120),
});
export type LoginInput = z.infer<typeof LoginDto>;
