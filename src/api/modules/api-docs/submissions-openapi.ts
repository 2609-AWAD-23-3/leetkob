import type { StaticDocumentSpec } from '@fastify/swagger';
import { SUBMISSION_NOTICE } from '../../../shared/submission-input.js';

type Document = Extract<StaticDocumentSpec['document'], { openapi: string }>;
export function addSubmissionsOpenApi(document: Document): void {
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const response = (description: string, schema: object) => ({
    description,
    content: { 'application/json': { schema } },
  });
  const errors = Object.fromEntries(
    [400, 401, 403, 404, 409, 413, 415, 429, 500, 503].map((status) => [
      status,
      {
        description: (
          {
            400: 'Invalid input or cursor',
            401: 'Missing/invalid session',
            403: 'Wrong role',
            404: 'Lab/submission unavailable',
            409: 'Different code for key or lab closed',
            413: 'Code/body too large',
            415: 'Unsupported media type',
            429: 'Submission request limit',
            500: 'Internal error',
            503: 'Service unavailable',
          } as Record<number, string>
        )[status],
        content: { 'application/problem+json': { schema: ref('Problem') } },
        ...(status === 401
          ? { headers: { 'WWW-Authenticate': { schema: { type: 'string' } } } }
          : status === 429
            ? { headers: { 'Retry-After': { schema: { type: 'integer' } } } }
            : {}),
      },
    ]),
  );
  const parameter = (name: string) => ({
    name,
    in: 'path' as const,
    required: true,
    schema: { type: 'string' as const, pattern: '^[a-zA-Z0-9_-]{1,64}$' },
    example:
      name === 'labId'
        ? 'replace-with-created-lab-id'
        : 'replace-with-created-submission-id',
  });
  const properties = {
    id: { type: 'string' },
    labId: { type: 'string' },
    studentId: { type: 'string' },
    submittedAt: { type: 'string', format: 'date-time' },
    status: {
      type: 'string' as const,
      enum: ['queued', 'judging', 'judged', 'failed'],
    },
  };
  const judge = {
    type: 'object',
    nullable: true,
    additionalProperties: false,
    required: ['verdict', 'tests'],
    properties: {
      verdict: { type: 'string', enum: ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE'] },
      tests: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['testId', 'verdict'],
          properties: {
            testId: { type: 'string' },
            verdict: { type: 'string', enum: ['AC', 'WA', 'TLE', 'MLE', 'RE'] },
          },
        },
      },
    },
  };
  Object.assign(document.components!.schemas!, {
    Submission: {
      type: 'object',
      additionalProperties: false,
      required: [...Object.keys(properties), 'code', 'judgeResult'],
      properties: {
        ...properties,
        code: {
          type: 'string',
          description: 'Unmodified UTF-8 source, at most 65536 bytes.',
        },
        judgeResult: judge,
      },
    },
    SubmissionSummary: {
      type: 'object',
      additionalProperties: false,
      required: [...Object.keys(properties), 'verdict'],
      properties: {
        ...properties,
        verdict: {
          type: 'string',
          nullable: true,
          enum: ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', null],
        },
      },
    },
    SubmissionPage: {
      type: 'object',
      additionalProperties: false,
      required: ['submissions', 'nextCursor'],
      properties: {
        submissions: { type: 'array', items: ref('SubmissionSummary') },
        nextCursor: { type: 'string', nullable: true },
      },
    },
  });
  document.tags!.push({
    name: 'Submissions',
    description:
      'T04 intake/read only. A new submission is queued; execution belongs to T06.',
  });
  const common = { tags: ['Submissions'], security: [{ bearerAuth: [] }] };
  const listParameters = [
    {
      name: 'limit',
      in: 'query' as const,
      schema: {
        type: 'integer' as const,
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    {
      name: 'cursor',
      in: 'query' as const,
      schema: { type: 'string' as const },
      description:
        'Use nextCursor with the same lab and filters; omit for the first page.',
    },
  ];
  document.paths['/labs/{labId}/submissions'] = {
    post: {
      ...common,
      operationId: 'submitCode',
      summary: 'Nộp một bài C++ (student)',
      description: `${SUBMISSION_NOTICE} Chọn JSON hoặc một file .cpp UTF-8; code tối đa 64 KiB, tổng body 1 MiB. Giữ nguyên key cho retry trong 24 giờ; key mới cho lần nộp mới. Chỉ nhận bài trong hạn; chưa chạy chấm ở phase này.`,
      parameters: [
        parameter('labId'),
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
            pattern:
              '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
          },
          example: '33333333-3333-4333-8333-333333333333',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['code'],
              properties: { code: { type: 'string' } },
            },
            example: {
              code: '#include <iostream>\nint main() { long long a,b; std::cin >> a >> b; std::cout << a+b << "\\n"; }\n',
            },
          },
          'multipart/form-data': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['codeFile'],
              properties: {
                codeFile: {
                  type: 'string',
                  format: 'binary',
                  description:
                    'One UTF-8 .cpp file; no ZIP or additional fields.',
                },
              },
            },
          },
        },
      },
      responses: {
        ...errors,
        201: {
          ...response('Submission created or replayed', {
            type: 'object',
            required: ['submission', 'notice'],
            properties: {
              submission: ref('Submission'),
              notice: { type: 'string', example: SUBMISSION_NOTICE },
            },
          }),
          headers: {
            Location: { schema: { type: 'string' } },
            'Idempotent-Replayed': {
              schema: { type: 'string' },
              description: 'true only for replay',
            },
          },
        },
      },
    },
    get: {
      ...common,
      operationId: 'listLabSubmissions',
      summary: 'TA xem bài nộp của lab',
      parameters: [
        parameter('labId'),
        ...listParameters,
        { name: 'studentId', in: 'query', schema: { type: 'string' } },
        { name: 'status', in: 'query', schema: properties.status },
      ],
      responses: {
        ...errors,
        200: response(
          'All attempts, newest first; metadata only',
          ref('SubmissionPage'),
        ),
      },
    },
  };
  document.paths['/labs/{labId}/submissions/mine'] = {
    get: {
      ...common,
      operationId: 'listMySubmissions',
      summary: 'Student xem lịch sử bài mình',
      parameters: [parameter('labId'), ...listParameters],
      responses: {
        ...errors,
        200: response(
          'Own attempts only, including after deadline',
          ref('SubmissionPage'),
        ),
      },
    },
  };
  document.paths['/submissions/{submissionId}'] = {
    get: {
      ...common,
      operationId: 'getSubmission',
      summary: 'Xem code và trạng thái bài nộp',
      description:
        'Owner with current membership or class TA. No review verdicts, test input/output or job metadata.',
      parameters: [parameter('submissionId')],
      responses: {
        ...errors,
        200: response('Submission detail', {
          type: 'object',
          required: ['submission'],
          properties: { submission: ref('Submission') },
        }),
      },
    },
  };
}
