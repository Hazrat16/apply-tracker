import { createTestApp, getCookie, type TestContext, validUser } from './helpers.js';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await ctx.resetDb();
  });

  const register = (agent = ctx.agent(), body: object = validUser) =>
    agent.post('/api/v1/auth/register').send(body);

  const login = (agent = ctx.agent(), password = validUser.password) =>
    agent.post('/api/v1/auth/login').send({ email: validUser.email, password });

  describe('register', () => {
    it('creates the user, signs them in and sends a verification email', async () => {
      const agent = ctx.agent();
      const res = await register(agent).expect(201);

      expect(res.body).toMatchObject({
        email: validUser.email,
        name: validUser.name,
        emailVerified: false,
        hasPassword: true,
        providers: [],
      });
      expect(res.body).not.toHaveProperty('passwordHash');

      const access = getCookie(res, 'access_token');
      expect(access).toMatch(/HttpOnly/);
      expect(access).toMatch(/Path=\/api;/);
      expect(getCookie(res, 'refresh_token')).toMatch(
        /Path=\/api\/v1\/auth;.*HttpOnly.*SameSite=Strict/,
      );

      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0]?.to).toBe(validUser.email);

      await agent.get('/api/v1/users/me').expect(200);
    });

    it('rejects a duplicate email regardless of case', async () => {
      await register().expect(201);
      const res = await register(ctx.agent(), { ...validUser, email: 'JANE@Example.com' }).expect(
        409,
      );
      expect(res.body.message).toBe('An account with this email already exists');
    });

    it('returns field-level validation errors', async () => {
      const res = await register(ctx.agent(), {
        name: '',
        email: 'nope',
        password: 'short',
      }).expect(400);
      expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(
        expect.arrayContaining(['name', 'email', 'password']),
      );
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    it('signs in with the right password', async () => {
      const agent = ctx.agent();
      const res = await login(agent).expect(200);
      expect(res.body.email).toBe(validUser.email);
      await agent.get('/api/v1/users/me').expect(200);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const wrongPassword = await login(ctx.agent(), 'wrong-password-1').expect(401);
      const unknownEmail = await ctx
        .agent()
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@example.com', password: validUser.password })
        .expect(401);
      expect(wrongPassword.body.message).toBe('Invalid email or password');
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });
  });

  describe('protected routes', () => {
    it('reject requests without an access token', async () => {
      await ctx.agent().get('/api/v1/users/me').expect(401);
    });

    it('accept a bearer token', async () => {
      const res = await register().expect(201);
      const token = getCookie(res, 'access_token')!.split(';')[0]!.split('=')[1];
      await ctx.agent().get('/api/v1/users/me').set('Authorization', `Bearer ${token}`).expect(200);
    });

    it('reject a tampered token', async () => {
      await ctx
        .agent()
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad')
        .expect(401);
    });
  });

  describe('refresh token rotation', () => {
    it('issues a new refresh token each time', async () => {
      const agent = ctx.agent();
      const first = getCookie(await register(agent).expect(201), 'refresh_token');
      const second = getCookie(
        await agent.post('/api/v1/auth/refresh').expect(204),
        'refresh_token',
      );
      expect(second).toBeDefined();
      expect(second).not.toBe(first);
      await agent.get('/api/v1/users/me').expect(200);
    });

    it('revokes the session when an old refresh token is replayed (theft detection)', async () => {
      const agent = ctx.agent();
      const stolen = getCookie(await register(agent).expect(201), 'refresh_token')!.split(';')[0]!;
      await agent.post('/api/v1/auth/refresh').expect(204);

      // Replay right away: treated as a benign race, rejected without revoking.
      const attacker = () => ctx.agent().post('/api/v1/auth/refresh').set('Cookie', stolen);
      await attacker().expect(401);
      await agent.post('/api/v1/auth/refresh').expect(204);

      // Replay outside the grace window: the whole session is revoked.
      await ctx.prisma.refreshToken.updateMany({
        where: { usedAt: { not: null } },
        data: { usedAt: new Date(Date.now() - 60_000) },
      });
      const res = await attacker().expect(401);
      expect(res.body.message).toBe('Refresh token already used');
      await agent.post('/api/v1/auth/refresh').expect(401);
    });

    it('fails without a refresh cookie', async () => {
      await ctx.agent().post('/api/v1/auth/refresh').expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the session and clears cookies', async () => {
      const agent = ctx.agent();
      await register(agent).expect(201);
      const res = await agent.post('/api/v1/auth/logout').expect(204);
      expect(getCookie(res, 'refresh_token')).toMatch(/Expires=Thu, 01 Jan 1970/);
      await agent.post('/api/v1/auth/refresh').expect(401);
      expect(await ctx.prisma.session.count({ where: { revokedAt: null } })).toBe(0);
    });
  });

  describe('email verification', () => {
    it('verifies the email with the emailed token, once', async () => {
      const agent = ctx.agent();
      await register(agent).expect(201);
      const token = ctx.mail.tokenFor(validUser.email, '/verify-email');

      await ctx.agent().post('/api/v1/auth/verify-email').send({ token }).expect(204);
      const me = await agent.get('/api/v1/users/me').expect(200);
      expect(me.body.emailVerified).toBe(true);

      await ctx.agent().post('/api/v1/auth/verify-email').send({ token }).expect(400);
    });

    it('invalidates the previous link when a new one is requested', async () => {
      const agent = ctx.agent();
      await register(agent).expect(201);
      const oldToken = ctx.mail.tokenFor(validUser.email, '/verify-email');
      await agent.post('/api/v1/auth/resend-verification').expect(204);

      await ctx.agent().post('/api/v1/auth/verify-email').send({ token: oldToken }).expect(400);
      const newToken = ctx.mail.tokenFor(validUser.email, '/verify-email');
      await ctx.agent().post('/api/v1/auth/verify-email').send({ token: newToken }).expect(204);
      await agent.post('/api/v1/auth/resend-verification').expect(400);
    });
  });

  describe('password reset', () => {
    it('does not reveal whether an email is registered', async () => {
      await ctx
        .agent()
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'ghost@example.com' })
        .expect(204);
      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('sets a new password and signs out every device', async () => {
      const device = ctx.agent();
      await register(device).expect(201);

      await ctx
        .agent()
        .post('/api/v1/auth/forgot-password')
        .send({ email: validUser.email })
        .expect(204);
      const token = ctx.mail.tokenFor(validUser.email, '/reset-password');

      await ctx
        .agent()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'brand-new-pass-2' })
        .expect(204);

      await device.post('/api/v1/auth/refresh').expect(401);
      await login(ctx.agent()).expect(401);
      await login(ctx.agent(), 'brand-new-pass-2').expect(200);
      // The link is single-use.
      await ctx
        .agent()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'another-pass-3' })
        .expect(400);
    });
  });

  describe('account management', () => {
    it('updates the profile', async () => {
      const agent = ctx.agent();
      await register(agent).expect(201);
      const res = await agent.patch('/api/v1/users/me').send({ name: '  Janet ' }).expect(200);
      expect(res.body.name).toBe('Janet');
    });

    it('changes the password and signs out other devices only', async () => {
      const current = ctx.agent();
      const other = ctx.agent();
      await register(current).expect(201);
      await login(other).expect(200);

      await current
        .post('/api/v1/users/me/password')
        .send({ currentPassword: 'wrong-pass-1', newPassword: 'new-password-9' })
        .expect(400);
      await current
        .post('/api/v1/users/me/password')
        .send({ currentPassword: validUser.password, newPassword: 'new-password-9' })
        .expect(204);

      await current.post('/api/v1/auth/refresh').expect(204);
      await other.post('/api/v1/auth/refresh').expect(401);
      await login(ctx.agent(), 'new-password-9').expect(200);
    });

    it('deletes the account after confirming the password', async () => {
      const agent = ctx.agent();
      await register(agent).expect(201);

      await agent.delete('/api/v1/users/me').send({ password: 'wrong-pass-1' }).expect(400);
      await agent.delete('/api/v1/users/me').send({ password: validUser.password }).expect(204);

      expect(await ctx.prisma.user.count()).toBe(0);
      await login(ctx.agent()).expect(401);
    });
  });

  describe('Google sign-in', () => {
    it('reports Google as unavailable when not configured', async () => {
      const res = await ctx.agent().get('/api/v1/auth/providers').expect(200);
      expect(res.body).toEqual({ google: false });
      await ctx.agent().get('/api/v1/auth/google').expect(404);
    });

    it('redirects to the login page when the OAuth state does not match', async () => {
      const res = await ctx
        .agent()
        .get('/api/v1/auth/google/callback?code=abc&state=forged')
        .expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/login?error=oauth_failed');
    });
  });
});
