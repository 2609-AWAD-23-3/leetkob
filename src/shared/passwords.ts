import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export class PasswordBusyError extends Error {}

const PREFIX = 'scrypt$v1$16384$8$5$';
const pattern = /^scrypt\$v1\$16384\$8\$5\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

export class PasswordService {
  private running = 0;
  private waiting: Array<() => void> = [];

  constructor(
    private readonly derive = (
      password: string,
      salt: Buffer,
    ): Promise<Buffer> =>
      new Promise((resolve, reject) => {
        scrypt(
          password,
          salt,
          64,
          { N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 },
          (error, key) => (error ? reject(error) : resolve(key)),
        );
      }),
  ) {}

  private async run(password: string, salt: Buffer): Promise<Buffer> {
    // UTF-8 replaces unpaired surrogates: reject before encoding, never repair.
    if (!password.isWellFormed())
      throw new TypeError('Password must contain valid Unicode');
    if (this.running >= 2) {
      if (this.waiting.length >= 32)
        throw new PasswordBusyError('Password service busy');
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else this.running++;
    try {
      return await this.derive(password, salt);
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.running--;
    }
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    return `${PREFIX}${salt.toString('hex')}$${(await this.run(password, salt)).toString('hex')}`;
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const match = pattern.exec(encoded);
    if (!match) throw new Error('Invalid stored password hash');
    const actual = await this.run(password, Buffer.from(match[1]!, 'hex'));
    return timingSafeEqual(actual, Buffer.from(match[2]!, 'hex'));
  }
}

// Deliberately not a credential: a valid-format dummy for unknown-user work.
export const DUMMY_PASSWORD_HASH = `${PREFIX}${'00'.repeat(16)}$${'00'.repeat(64)}`;
// One scheduler per process, shared by app instances unless explicitly injected.
export const passwords = new PasswordService();
