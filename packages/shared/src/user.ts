import { z } from 'zod';
import { nameSchema, passwordSchema, PASSWORD_MAX_LENGTH } from './auth.js';

export const OAUTH_PROVIDERS = ['GOOGLE'] as const;
export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

/** Public representation of the signed-in user. Never includes secrets. */
export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  emailVerified: z.boolean(),
  hasPassword: z.boolean(),
  providers: z.array(oauthProviderSchema),
  createdAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const updateProfileSchema = z.object({ name: nameSchema });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  // Optional so accounts created with Google can set their first password.
  currentPassword: z.string().max(PASSWORD_MAX_LENGTH).optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().max(PASSWORD_MAX_LENGTH).optional(),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
