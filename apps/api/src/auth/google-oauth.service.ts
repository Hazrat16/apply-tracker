import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeIdToken, generateCodeVerifier, generateState, Google } from 'arctic';
import type { Env } from '../config/env.js';
import type { OAuthProfile } from './auth.service.js';

interface GoogleIdTokenClaims {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/** Google sign-in using the Authorization Code flow with PKCE. */
@Injectable()
export class GoogleOAuthService {
  private readonly client: Google | null;

  constructor(config: ConfigService<Env, true>) {
    const clientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
    const clientSecret = config.get('GOOGLE_CLIENT_SECRET', { infer: true });
    // The callback goes through the web app's /api proxy so cookies stay first-party.
    const redirectUri = `${config.get('WEB_URL', { infer: true })}/api/v1/auth/google/callback`;
    this.client = clientId && clientSecret ? new Google(clientId, clientSecret, redirectUri) : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  createAuthorizationUrl(): { url: URL; state: string; codeVerifier: string } {
    const client = this.requireClient();
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = client.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);
    return { url, state, codeVerifier };
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<OAuthProfile> {
    const client = this.requireClient();
    try {
      const tokens = await client.validateAuthorizationCode(code, codeVerifier);
      // The ID token comes straight from Google's token endpoint over TLS, so decoding is sufficient.
      const claims = decodeIdToken(tokens.idToken()) as GoogleIdTokenClaims;
      return {
        providerAccountId: claims.sub,
        email: claims.email,
        emailVerified: claims.email_verified === true,
        name: claims.name,
        avatarUrl: claims.picture,
      };
    } catch {
      throw new UnauthorizedException('Google sign-in failed');
    }
  }

  private requireClient(): Google {
    if (!this.client) throw new NotFoundException('Google sign-in is not configured');
    return this.client;
  }
}
