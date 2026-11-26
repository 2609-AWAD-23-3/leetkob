import type { StaticDocumentSpec } from '@fastify/swagger';
type Document = Extract<StaticDocumentSpec['document'], { openapi: string }>;

// OpenAPI for the PA03-T09 review queue (docs/contract/review-queue.md) and
// Publish v1 on session tokens (docs/contract/publish.md).
export function addReviewOpenApi(
  document: Document,
  options: { reviewQueue: boolean; publish: boolean },
): void {
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const json = (description: string, schema: object) => ({
    description,
    content: { 'application/json': { schema } },
  });
  const error = (status: number, slug: string, description: string) => ({
    description,
    content: {
      'application/problem+json': {
        schema: ref('Problem'),
        example: {
          type: `https://leetkob.example/problems/${slug}`,
          title: description,
          status,
          detail: description,
        },
      },
    },
  });
  const id = (name: string, example: string) => ({
    name,
    in: 'path' as const,
    required: true,
    schema: { type: 'string' as const, pattern: '^[a-zA-Z0-9_-]{1,64}$' },
    example,
  });
  const security = [{ bearerAuth: [] }];
  const reviewErrors = {
    400: error(400, 'validation', 'Invalid path ID or decision body.'),
    401: error(
      401,
      'unauthenticated',
      'Authentication credentials are invalid or missing.',
    ),
    403: error(403, 'forbidden', 'Only a TA of the class may review this lab.'),
    404: error(404, 'not-found', 'Lab or review item not found.'),
    500: error(500, 'internal', 'An internal error occurred.'),
    503: error(503, 'internal', 'Service temporarily unavailable.'),
  };
  const locked = error(
    409,
    'conflict',
    'The lab is already published; review decisions are locked.',
  );
  const evidence = {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['line', 'text'],
      properties: {
        line: { type: 'integer', minimum: 1 },
        text: { type: 'string' },
      },
    },
  };
  const nullableString = { type: 'string', nullable: true };

  if (options.reviewQueue) {
    document.tags!.push({
      name: 'Review queue',
      description:
        'TA của lớp duyệt từng bài × ràng buộc trước khi Publish. Student không bao giờ nhận verdict trước Publish (FAQ-08); chọn violation phải chỉ dòng code (FAQ-09).',
    });
    Object.assign(document.components!.schemas!, {
      ReviewState: {
        type: 'object',
        required: [
          'queueItemCount',
          'passDecisionCount',
          'violationDecisionCount',
          'pendingCount',
        ],
        properties: {
          queueItemCount: { type: 'integer', minimum: 0 },
          passDecisionCount: { type: 'integer', minimum: 0 },
          violationDecisionCount: { type: 'integer', minimum: 0 },
          pendingCount: {
            type: 'integer',
            minimum: 0,
            description:
              'Items without a TA decision plus counted submissions or verdicts the pipeline has not finished.',
          },
        },
      },
      ReviewItem: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'labId',
          'submissionId',
          'studentId',
          'constraintId',
          'constraintText',
          'deduction',
          'verdict',
          'source',
          'evidence',
          'unsureCause',
          'reason',
          'createdAt',
          'taDecision',
          'taEvidence',
          'reviewedBy',
          'reviewedAt',
        ],
        properties: {
          id: { type: 'string' },
          labId: { type: 'string' },
          submissionId: { type: 'string' },
          studentId: { type: 'string' },
          constraintId: { type: 'string' },
          constraintText: { type: 'string' },
          deduction: {
            type: 'number',
            description: 'Set by the TA on the constraint, never by the model.',
          },
          verdict: { type: 'string', enum: ['pass', 'violation', 'unsure'] },
          source: { type: 'string', enum: ['hard_rule', 'model'] },
          evidence,
          unsureCause: {
            type: 'string',
            nullable: true,
            enum: [
              'model_unsure',
              'schema_error',
              'evidence_mismatch',
              'timeout',
              'cost_cap',
              'model_off',
              null,
            ],
          },
          reason: {
            ...nullableString,
            description: 'Untrusted model or rule text; escape when shown.',
          },
          createdAt: { type: 'string', format: 'date-time' },
          taDecision: {
            type: 'string',
            nullable: true,
            enum: ['pass', 'violation', null],
          },
          taEvidence: evidence,
          reviewedBy: nullableString,
          reviewedAt: { ...nullableString, format: 'date-time' },
        },
      },
      ReviewDecisionInput: {
        type: 'object',
        additionalProperties: false,
        required: ['decision'],
        properties: {
          decision: { type: 'string', enum: ['pass', 'violation'] },
          evidenceLines: {
            type: 'array',
            maxItems: 50,
            uniqueItems: true,
            items: { type: 'integer', minimum: 1 },
            description:
              'Required (at least one) for violation, empty or absent for pass. Line numbers of the submitted code; the server reads each line text from the code.',
          },
        },
      },
    });
    document.paths['/labs/{labId}/review-queue'] = {
      get: {
        tags: ['Review queue'],
        operationId: 'getReviewQueue',
        summary: 'Hàng chờ duyệt của lab',
        security,
        parameters: [id('labId', 'replace-with-lab-id')],
        description:
          'Chỉ TA của lớp sở hữu lab. TA lớp khác nhận 404 như lab không tồn tại. Danh sách không chứa code.',
        responses: {
          ...reviewErrors,
          200: json('Review queue of the lab.', {
            type: 'object',
            required: [
              'labId',
              'classId',
              'published',
              'publishedAt',
              'state',
              'items',
            ],
            properties: {
              labId: { type: 'string' },
              classId: { type: 'string' },
              published: { type: 'boolean' },
              publishedAt: { ...nullableString, format: 'date-time' },
              state: ref('ReviewState'),
              items: { type: 'array', items: ref('ReviewItem') },
            },
          }),
        },
      },
    };
    document.paths['/review-items/{itemId}'] = {
      get: {
        tags: ['Review queue'],
        operationId: 'getReviewItem',
        summary: 'Chi tiết một mục, kèm toàn bộ code (FAQ-09)',
        security,
        parameters: [id('itemId', 'replace-with-item-id')],
        responses: {
          ...reviewErrors,
          200: json('Item and the whole submitted code.', {
            type: 'object',
            required: ['item', 'code'],
            properties: { item: ref('ReviewItem'), code: { type: 'string' } },
          }),
        },
      },
    };
    document.paths['/review-items/{itemId}/decision'] = {
      post: {
        tags: ['Review queue'],
        operationId: 'decideReviewItem',
        summary: 'TA chọn pass hoặc violation',
        security,
        parameters: [id('itemId', 'replace-with-item-id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: ref('ReviewDecisionInput'),
              examples: {
                violation: {
                  value: { decision: 'violation', evidenceLines: [4] },
                },
                pass: { value: { decision: 'pass' } },
              },
            },
          },
        },
        responses: {
          ...reviewErrors,
          200: json('Updated item.', {
            type: 'object',
            required: ['item'],
            properties: { item: ref('ReviewItem') },
          }),
          409: locked,
          415: error(
            415,
            'unsupported-media-type',
            'Content-Type must be application/json.',
          ),
        },
      },
    };
    document.paths['/labs/{labId}/review-queue/confirm-passes'] = {
      post: {
        tags: ['Review queue'],
        operationId: 'confirmReviewPasses',
        summary: 'Xác nhận hàng loạt các verdict pass chưa duyệt',
        security,
        parameters: [id('labId', 'replace-with-lab-id')],
        responses: {
          ...reviewErrors,
          200: json('Number of confirmed items and the new state.', {
            type: 'object',
            required: ['confirmedCount', 'state'],
            properties: {
              confirmedCount: { type: 'integer', minimum: 0 },
              state: ref('ReviewState'),
            },
          }),
          409: locked,
        },
      },
    };
  }

  if (options.publish) {
    document.tags!.push({
      name: 'Publish',
      description:
        'Contract v1 (docs/contract/publish.md): chỉ sau deadline và khi hàng chờ không còn mục chưa duyệt.',
    });
    document.paths['/labs/{labId}/publish'] = {
      post: {
        tags: ['Publish'],
        operationId: 'publishLab',
        summary: 'Công bố điểm cả lab (idempotent)',
        security,
        parameters: [id('labId', 'replace-with-lab-id')],
        description:
          'Student/admin hoặc TA lớp khác: 403 (contract v1). Lab không tồn tại: 404. Trước deadline: 409 before-deadline. Còn mục chưa duyệt, kể cả pass: 409 pending-reviews. Gọi lại sau khi đã publish: 200 với Idempotent-Replayed: true.',
        responses: {
          200: {
            description: 'LabPublication.',
            headers: {
              'Idempotent-Replayed': {
                schema: { type: 'string', enum: ['true'] },
                description: 'Present only on a repeat call.',
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: [
                    'labId',
                    'classId',
                    'status',
                    'publishedAt',
                    'publishedBy',
                    'summary',
                  ],
                  properties: {
                    labId: { type: 'string' },
                    classId: { type: 'string' },
                    status: { type: 'string', enum: ['published'] },
                    publishedAt: { type: 'string', format: 'date-time' },
                    publishedBy: { type: 'string' },
                    summary: {
                      type: 'object',
                      required: [
                        'queueItemCount',
                        'passDecisionCount',
                        'violationDecisionCount',
                      ],
                      properties: {
                        queueItemCount: { type: 'integer', minimum: 0 },
                        passDecisionCount: { type: 'integer', minimum: 0 },
                        violationDecisionCount: { type: 'integer', minimum: 0 },
                      },
                    },
                  },
                },
              },
            },
          },
          400: error(400, 'validation', 'Invalid request.'),
          401: error(401, 'unauthenticated', 'Authentication required'),
          403: error(403, 'forbidden', 'Forbidden'),
          404: error(404, 'not-found', 'Not found'),
          409: error(
            409,
            'pending-reviews',
            'Pending reviews block publication (or before-deadline).',
          ),
          500: error(500, 'internal', 'Internal error'),
        },
      },
    };
  }
}
