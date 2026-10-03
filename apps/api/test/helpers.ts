import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { MailMessage } from '../src/mail/mail.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Captures outgoing email so tests can follow verification / reset links. */
export class FakeMailService {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  /** Token from the most recent email to `to` whose link contains `path`. */
  tokenFor(to: string, path: '/verify-email' | '/reset-password'): string {
    const message = this.sent.filter((m) => m.to === to && m.text.includes(path)).at(-1);
    const match = message?.text.match(/token=([\w-]+)/);
    if (!match?.[1]) throw new Error(`No ${path} email sent to ${to}`);
    return match[1];
  }
}

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  mail: FakeMailService;
  /** A fresh browser-like client with its own cookie jar. */
  agent: () => TestAgent;
  resetDb: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const mail = new FakeMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  return {
    app,
    prisma,
    mail,
    agent: () => request.agent(app.getHttpServer()),
    resetDb: async () => {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
      mail.sent.length = 0;
    },
  };
}

export const validUser = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  password: 'correct-horse-1',
};

/** Value of a Set-Cookie header by cookie name. */
export function getCookie(res: request.Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${name}=`));
}
