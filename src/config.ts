export interface ServerConfig {
  host: string;
  port: number;
}

// Explicit environment input keeps configuration testable without mutating process.env.
// No .env loading, provider keys or remote service connections in the T01 baseline.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = env.PORT ?? '3000';
  if (!/^[0-9]+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const host = env.HOST ?? '127.0.0.1';
  if (!host.trim()) throw new Error('HOST must not be empty');
  return { host, port: Number(port) };
}
