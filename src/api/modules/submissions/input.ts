import type { FastifyRequest } from 'fastify';
import { requireExactKeys } from '../../../db/validation.js';
import {
  validateSubmissionCode,
  SUBMISSION_BODY_BYTES,
  SUBMISSION_CODE_BYTES,
} from '../../../shared/submission-input.js';

export async function readSubmissionCode(
  request: FastifyRequest,
): Promise<string> {
  let code: unknown;
  if (request.isMultipart()) {
    let seen = false;
    for await (const part of request.parts({
      preservePath: true,
      limits: {
        fields: 0,
        files: 1,
        parts: 1,
        fileSize: SUBMISSION_CODE_BYTES + 3,
        fieldSize: SUBMISSION_BODY_BYTES,
      },
    })) {
      if (seen || part.type !== 'file' || part.fieldname !== 'codeFile')
        throw new TypeError('Exactly one codeFile file is required');
      seen = true;
      if (
        !part.filename ||
        !/\.cpp$/i.test(part.filename) ||
        /[\\/]/.test(part.filename) ||
        part.filename.includes('\u0000')
      ) {
        part.file.resume();
        throw new TypeError('Upload one .cpp filename without a path');
      }
      code = new TextDecoder('utf-8', { fatal: true }).decode(
        await part.toBuffer(),
      );
    }
    if (!seen) throw new TypeError('Missing codeFile');
  } else {
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new TypeError('Body must be an object');
    requireExactKeys(body as Record<string, unknown>, ['code'], 'submission');
    code = (body as { code?: unknown }).code;
  }
  validateSubmissionCode(code);
  return code;
}
