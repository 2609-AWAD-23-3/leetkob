import { isIP } from 'node:net';

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

function isValidProxyEntry(entry: string): boolean {
  if (!entry || entry === '*' || entry === '0.0.0.0/0' || entry === '::/0') {
    return false;
  }
  const slashIndex = entry.indexOf('/');
  if (slashIndex === -1) {
    return isIP(entry) !== 0;
  }
  const ip = entry.slice(0, slashIndex);
  const prefixText = entry.slice(slashIndex + 1);
  if (!/^[0-9]+$/.test(prefixText)) {
    return false;
  }
  const ipVersion = isIP(ip);
  if (ipVersion === 0) {
    return false;
  }
  const prefix = Number(prefixText);
  const maxPrefix = ipVersion === 4 ? 32 : 128;
  return Number.isInteger(prefix) && prefix >= 1 && prefix <= maxPrefix;
}

/**
 * Loads explicit reverse-proxy IPs or CIDRs from TRUST_PROXY.
 * Rejects wildcard/global entries ('true', '*', '0.0.0.0/0', '::/0').
 */
export function loadTrustProxy(
  env: NodeJS.ProcessEnv = process.env,
): false | string[] {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw || raw.toLowerCase() === 'false') {
    return false;
  }
  if (raw.toLowerCase() === 'true') {
    throw new Error(
      'TRUST_PROXY must list explicit proxy IP/CIDR addresses, not "true"',
    );
  }
  const entries = raw.split(',').map((part) => part.trim());
  if (entries.some((entry) => !isValidProxyEntry(entry))) {
    throw new Error(
      'TRUST_PROXY must contain valid comma-separated proxy IP or CIDR entries',
    );
  }
  return entries;
}
