export interface ServerConfig {
  host: string;
  port: number;
}

// Explicit environment input keeps configuration testable without mutating process.env.
// npm runtime/database entry commands load optional .env using Node's CLI;
// this module only validates its explicit input and never reads files.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = env.PORT ?? '3000';
  if (!/^[0-9]+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const host = env.HOST ?? '127.0.0.1';
  if (!host.trim()) throw new Error('HOST must not be empty');
  return { host, port: Number(port) };
}

export function loadDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.DATABASE_URL;
  if (!value?.trim()) throw new Error('DATABASE_URL is required');
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname)
      throw new Error();
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }
  return value;
}
