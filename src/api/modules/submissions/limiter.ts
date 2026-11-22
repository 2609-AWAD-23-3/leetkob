import { AuthLimitError } from '../../auth/rate-limit.js';

export class SubmissionLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; expires: number }
  >();
  constructor(
    private readonly clock = () => Date.now(),
    private readonly capacity = 10_000,
  ) {}
  request(studentId: string): void {
    const now = this.clock();
    for (const [key, bucket] of this.buckets)
      if (bucket.expires <= now) this.buckets.delete(key);
    let bucket = this.buckets.get(studentId);
    if (!bucket) {
      if (this.buckets.size >= this.capacity) throw new AuthLimitError(503, 1);
      bucket = { count: 0, expires: (Math.floor(now / 60_000) + 1) * 60_000 };
      this.buckets.set(studentId, bucket);
    }
    if (bucket.count >= 10)
      throw new AuthLimitError(
        429,
        Math.max(1, Math.ceil((bucket.expires - now) / 1000)),
      );
    bucket.count++;
  }
}
