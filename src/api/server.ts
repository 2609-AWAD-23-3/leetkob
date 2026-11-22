import { createRuntimeApp } from './runtime.js';
import { loadConfig } from '../shared/config.js';

// Deliberately separate executable entry point from the app factory used by tests.
async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createRuntimeApp();
  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    try {
      await app.close();
    } catch (error) {
      app.log.error(error, 'Shutdown failed');
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  app.addHook('onClose', async () => {
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
  });

  try {
    const address = await app.listen(config);
    const docsUrl = new URL('/docs/', address);
    if (docsUrl.hostname === '0.0.0.0') docsUrl.hostname = '127.0.0.1';
    if (docsUrl.hostname === '[::]') docsUrl.hostname = '[::1]';
    app.log.info({ docsUrl: docsUrl.href }, `API docs: ${docsUrl.href}`);
  } catch (error) {
    await app.close();
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'API startup failed.');
  process.exitCode = 1;
});
