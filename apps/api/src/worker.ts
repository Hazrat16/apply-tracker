// Standalone background worker: `node dist/worker.js`. Runs queue consumers and recurring
// jobs without an HTTP server, so it can be scaled separately from the API.
process.env.RUN_WORKERS = 'true';

const { initMonitoring } = await import('./monitoring/sentry.js');
initMonitoring('worker');

const { NestFactory } = await import('@nestjs/core');
const { Logger } = await import('nestjs-pino');
const { AppModule } = await import('./app.module.js');

const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
app.enableShutdownHooks();
app.get(Logger).log('Worker started');
