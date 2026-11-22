import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { LabSizeError } from '../shared/lab-input.js';
import { ProblemError } from './auth/problem-details.js';

// Both text-upload APIs consume the original raw stream through busboy.
// Count framing too, and reject UTF-8 before fields can be silently repaired.
export function registerUploadParsing(
  scope: FastifyInstance,
  bodyLimit: number,
): void {
  scope.register(multipart);
  scope.removeContentTypeParser('text/plain');
  const parseJson = scope.getDefaultJsonParser('error', 'error');
  scope.removeContentTypeParser('application/json');
  const invalidUtf8 = () =>
    new ProblemError({
      type: 'https://leetkob.example/problems/invalid-json',
      title: 'Invalid UTF-8',
      status: 400,
      detail: 'The request must contain valid UTF-8.',
    });
  scope.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer', bodyLimit },
    (request, body, done) => {
      try {
        parseJson(
          request,
          new TextDecoder('utf-8', { fatal: true }).decode(body as Buffer),
          done,
        );
      } catch {
        done(invalidUtf8());
      }
    },
  );
  scope.addHook('preParsing', async (request, _reply, payload) => {
    if (request.method !== 'POST') return payload;
    const raw = request.raw;
    const utf8 = new TextDecoder('utf-8', { fatal: true });
    let received = 0;
    let rejected = false;
    const detach = () => raw.removeListener('data', count);
    const reject = (error: Error) => {
      if (rejected) return;
      rejected = true;
      detach();
      raw.emit('error', error);
      raw.resume();
    };
    const count = (chunk: Buffer) => {
      received += chunk.length;
      if (received > bodyLimit) {
        reject(new LabSizeError('Request body exceeds its byte limit'));
        return;
      }
      try {
        utf8.decode(chunk, { stream: true });
      } catch {
        reject(invalidUtf8());
      }
    };
    raw.on('data', count);
    raw.pause();
    raw.once('end', () => {
      detach();
      if (rejected) return;
      try {
        utf8.decode();
      } catch {
        reject(invalidUtf8());
      }
    });
    raw.once('close', detach);
    return payload;
  });
}
