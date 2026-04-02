import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export async function loadSystemOverrideAppend() {
  const systemOverridePath = path.join(os.homedir(), '.claude', 'system_override.txt');
  try {
    const content = await fs.readFile(systemOverridePath, 'utf8');
    const trimmed = content.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export async function loadCcrEnvOverrides() {
  const configPath = path.join(os.homedir(), '.claude-code-router', 'config.json');

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(raw);
    const port = config.PORT || 3456;
    const apiKey = config.APIKEY || 'test';
    const timeoutMs = String(config.API_TIMEOUT_MS ?? 600000);

    return {
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
      NO_PROXY: '127.0.0.1',
      DISABLE_TELEMETRY: 'true',
      DISABLE_COST_WARNINGS: 'true',
      API_TIMEOUT_MS: timeoutMs,
      CLAUDE_CODE_USE_BEDROCK: undefined,
    };
  } catch (error) {
    console.error('Failed to load Claude Code Router config:', error);
    return {
      ANTHROPIC_AUTH_TOKEN: 'test',
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:3456',
      NO_PROXY: '127.0.0.1',
      DISABLE_TELEMETRY: 'true',
      DISABLE_COST_WARNINGS: 'true',
      API_TIMEOUT_MS: '600000',
      CLAUDE_CODE_USE_BEDROCK: undefined,
    };
  }
}
