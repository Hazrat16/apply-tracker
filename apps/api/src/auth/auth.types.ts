import type { Request } from 'express';

/** Claims in the access token JWT. */
export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthUser {
  userId: string;
  sessionId: string;
}

export type AuthenticatedRequest = Request & { user: AuthUser };

export interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  refreshExpiresAt: Date;
}
