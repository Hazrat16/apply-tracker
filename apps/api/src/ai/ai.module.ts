import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env, resolveAiProvider } from '../config/env.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AI_WRITER, type AiWriter } from './writers/ai-writer.js';
import { AnthropicWriter } from './writers/anthropic.writer.js';
import { BuiltinWriter } from './writers/builtin.writer.js';
import { OpenAiCompatibleWriter } from './writers/openai-compatible.writer.js';

function createWriter(config: ConfigService<Env, true>): AiWriter {
  const env = (key: keyof Env) => config.get(key, { infer: true }) as string | undefined;
  const provider = resolveAiProvider({
    AI_PROVIDER: config.get('AI_PROVIDER', { infer: true }),
    ANTHROPIC_API_KEY: env('ANTHROPIC_API_KEY'),
  });
  const writer =
    provider === 'anthropic'
      ? new AnthropicWriter(env('ANTHROPIC_API_KEY')!, env('AI_MODEL') ?? 'claude-opus-5-5')
      : provider === 'openai-compatible'
        ? new OpenAiCompatibleWriter({
            baseUrl: env('AI_BASE_URL')!,
            model: env('AI_MODEL')!,
            apiKey: env('AI_API_KEY'),
          })
        : new BuiltinWriter();
  new Logger('AiModule').log(
    `Resume matching & cover letters: ${provider}${writer.model ? ` (${writer.model})` : ''}`,
  );
  return writer;
}

@Module({
  controllers: [AiController],
  providers: [AiService, { provide: AI_WRITER, inject: [ConfigService], useFactory: createWriter }],
  exports: [AI_WRITER],
})
export class AiModule {}
