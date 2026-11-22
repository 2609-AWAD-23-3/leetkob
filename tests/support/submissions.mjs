import { labsHarness, newLab, LAB_KEY } from './labs.mjs';

export async function submissionHarness(t) {
  const h = await labsHarness(t, true);
  const lab = await h.store.createLab(
    newLab({ deadline: '2026-11-22T02:00:00.000Z' }),
  );
  const send = (
    code = 'int main() { return 0; }\n',
    key = LAB_KEY,
    user = 'student-1',
  ) =>
    h.app.inject({
      method: 'POST',
      url: `/labs/${lab.id}/submissions`,
      headers: { ...h.headers[user], 'idempotency-key': key },
      payload: { code },
    });
  const upload = (form, key = LAB_KEY, user = 'student-1') =>
    h.app.inject({
      method: 'POST',
      url: `/labs/${lab.id}/submissions`,
      headers: {
        ...h.headers[user],
        'idempotency-key': key,
        'content-type': form.contentType,
      },
      payload: form.payload,
    });
  return { ...h, lab, send, upload };
}
export function codeForm(
  code,
  filename = 'main.cpp',
  name = 'codeFile',
  boundary = 'submission-test-boundary',
) {
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n`,
      ),
      Buffer.isBuffer(code) ? code : Buffer.from(code),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}
