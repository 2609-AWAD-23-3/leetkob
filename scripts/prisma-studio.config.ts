import { defineConfig, env } from 'prisma/config';

// Studio introspects PostgreSQL directly. Store/migrations remain owned by pg.
// npm run db:studio loads optional .env; process environment takes precedence.
export default defineConfig({
  datasource: { url: env('DATABASE_URL') },
});
