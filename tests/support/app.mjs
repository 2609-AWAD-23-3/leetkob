import { createApp } from '../../dist/app.js';

// Đăng ký cleanup trước ready để app vẫn đóng khi bootstrap/test thất bại.
export async function createTestApp(t, options = {}) {
  const app = createApp(options);
  t.after(() => app.close());
  await app.ready();
  return app;
}
