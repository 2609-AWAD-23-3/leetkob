import type { FastifyRequest } from 'fastify';
import {
  DEFAULT_LAB_LIMITS,
  type NewLab,
} from '../../../shared/domain/index.js';
import { LAB_INPUT_LIMITS } from '../../../shared/lab-input.js';
import {
  requireExactKeys,
  validateNewLab,
  copyNewLab,
} from '../../../db/validation.js';

export function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${field} must be an object`);
  return value as Record<string, unknown>;
}

// UTF-8 decoding is fatal, never replaces malformed bytes. JSON.parse may
// contain escaped surrogates: shared field validation rejects those afterwards.
function parseJson(bytes: Uint8Array | string): unknown {
  const text =
    typeof bytes === 'string'
      ? bytes.replace(/^\uFEFF/, '')
      : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return JSON.parse(text);
}

export async function readLabPayload(
  request: FastifyRequest,
): Promise<unknown> {
  if (!request.isMultipart()) return request.body;
  let lab: Record<string, unknown> | undefined;
  const files = new Map<string, unknown>();
  const seen = new Set<string>();
  for await (const part of request.parts({
    limits: {
      fields: 1,
      files: 2,
      parts: 3,
      fieldSize: LAB_INPUT_LIMITS.requestBytes,
      fileSize: LAB_INPUT_LIMITS.requestBytes,
    },
  })) {
    if (seen.has(part.fieldname))
      throw new TypeError('Duplicate multipart part');
    seen.add(part.fieldname);
    if (part.type === 'field') {
      if (part.fieldname !== 'lab')
        throw new TypeError('Only lab is allowed as a field');
      if (part.valueTruncated)
        throw Object.assign(new Error('Multipart field too large'), {
          statusCode: 413,
        });
      lab = object(
        typeof part.value === 'string' ? parseJson(part.value) : part.value,
        'lab',
      );
    } else {
      if (!['testsFile', 'constraintsFile'].includes(part.fieldname)) {
        // Consume the bounded stream before rejecting; never persist uploads.
        part.file.resume();
        throw new TypeError('Unknown file part');
      }
      const value = object(parseJson(await part.toBuffer()), part.fieldname);
      const group = part.fieldname === 'testsFile' ? 'tests' : 'constraints';
      requireExactKeys(value, [group], part.fieldname);
      files.set(group, value[group]);
    }
  }
  if (!lab) throw new TypeError('Missing lab field');
  for (const [group, value] of files) {
    if (Object.hasOwn(lab, group))
      throw new TypeError(`Choose one source for ${group}`);
    lab[group] = value;
  }
  return lab;
}

export function normalizeLabPayload(
  value: unknown,
  classId: string,
  createdBy: string,
): NewLab {
  const body = object(value, 'lab');
  requireExactKeys(
    body,
    ['title', 'statement', 'tests', 'constraints', 'deadline'],
    'lab',
    ['opensAt', 'limits'],
  );
  const candidate = {
    ...body,
    title: typeof body.title === 'string' ? body.title.trim() : body.title,
    limits: Object.hasOwn(body, 'limits')
      ? body.limits
      : { ...DEFAULT_LAB_LIMITS },
    classId,
    createdBy,
  };
  validateNewLab(candidate);
  return copyNewLab(candidate);
}
