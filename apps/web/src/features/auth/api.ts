import {
  type AuthProviders,
  authProvidersSchema,
  type ChangePasswordInput,
  type DeleteAccountInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type UpdateProfileInput,
  type User,
  userSchema,
} from '@apply-tracker/shared';
import { apiFetch } from '@/lib/api-client';

export const authApi = {
  me: (signal?: AbortSignal) => apiFetch<User>('/v1/users/me', { schema: userSchema, signal }),
  providers: () => apiFetch<AuthProviders>('/v1/auth/providers', { schema: authProvidersSchema }),
  login: (body: LoginInput) =>
    apiFetch<User>('/v1/auth/login', { method: 'POST', body, schema: userSchema }),
  register: (body: RegisterInput) =>
    apiFetch<User>('/v1/auth/register', { method: 'POST', body, schema: userSchema }),
  logout: () => apiFetch('/v1/auth/logout', { method: 'POST' }),
  verifyEmail: (token: string) =>
    apiFetch('/v1/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: () => apiFetch('/v1/auth/resend-verification', { method: 'POST' }),
  forgotPassword: (body: ForgotPasswordInput) =>
    apiFetch('/v1/auth/forgot-password', { method: 'POST', body }),
  resetPassword: (body: ResetPasswordInput) =>
    apiFetch('/v1/auth/reset-password', { method: 'POST', body }),
  updateProfile: (body: UpdateProfileInput) =>
    apiFetch<User>('/v1/users/me', { method: 'PATCH', body, schema: userSchema }),
  changePassword: (body: ChangePasswordInput) =>
    apiFetch('/v1/users/me/password', { method: 'POST', body }),
  deleteAccount: (body: DeleteAccountInput) => apiFetch('/v1/users/me', { method: 'DELETE', body }),
};
