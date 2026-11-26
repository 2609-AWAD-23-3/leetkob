export class AuthLimitError extends Error {
  constructor(
    readonly status: 429 | 503,
    readonly retryAfter: number,
  ) {
    super('Authentication request limit reached');
  }
}

interface Bucket {
  count: number;
  expires: number;
}

export class AuthLimiter {
  private readonly buckets = new Map<string, Bucket>();
  constructor(
    private readonly clock = () => Date.now(),
    private readonly capacity = 10_000,
  ) {}

  private bucket(key: string, windowMs: number): Bucket {
    const now = this.clock();
    for (const [name, entry] of this.buckets) {
      if (entry.expires <= now) this.buckets.delete(name);
    }
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.capacity) throw new AuthLimitError(503, 1);
      bucket = {
        count: 0,
        expires: (Math.floor(now / windowMs) + 1) * windowMs,
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private check(bucket: Bucket, limit: number): void {
    if (bucket.count >= limit)
      throw new AuthLimitError(
        429,
        Math.max(1, Math.ceil((bucket.expires - this.clock()) / 1000)),
      );
  }

  request(kind: 'login' | 'register', ip: string): void {
    const bucket = this.bucket(
      JSON.stringify([kind, ip]),
      kind === 'login' ? 60_000 : 3_600_000,
    );
    this.check(bucket, kind === 'login' ? 120 : 20);
    bucket.count++;
  }

  // Reserve before awaiting password work: concurrent failures cannot bypass limits.
  reserveLogin(
    ip: string,
    username: string,
  ): { succeed(): void; cancel(): void } {
    const key = JSON.stringify(['failure', ip, username]);
    const bucket = this.bucket(key, 900_000);
    this.check(bucket, 10);
    bucket.count++;
    return {
      succeed: () => {
        if (this.buckets.get(key) === bucket) this.buckets.delete(key);
      },
      cancel: () => {
        if (this.buckets.get(key) === bucket) bucket.count--;
      },
    };
  }
}
