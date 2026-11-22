import { createApp } from './app.js';
import { loadConfig, loadDatabaseUrl } from '../shared/config.js';
import { createPostgresStore } from '../db/postgres/index.js';

// Caller owns listen/close. Injectable factory permits lifecycle tests without IO.
export async function createRuntimeApp(
  env: NodeJS.ProcessEnv = process.env,
  factory: typeof createPostgresStore = createPostgresStore,
) {
  loadConfig(env);
  const fixture = factory({ connectionString: loadDatabaseUrl(env) });
  try {
    await fixture.ready;
    const app = createApp({
      logger: true,
      auth: { store: fixture.store },
      labs: { store: fixture.store },
      submissions: { store: fixture.store },
    });
    app.addHook('onClose', () => fixture.store.close());
    return app;
  } catch {
    await fixture.store.close();
    throw new Error(
      'Database initialization failed; check connectivity and pending migrations.',
    );
  }
}
