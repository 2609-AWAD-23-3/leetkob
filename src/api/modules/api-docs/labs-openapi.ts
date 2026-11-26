import type { StaticDocumentSpec } from '@fastify/swagger';
type Document = Extract<StaticDocumentSpec['document'], { openapi: string }>;
type Schema = NonNullable<
  NonNullable<Document['components']>['schemas']
>[string];

export const labExample = {
  title: 'Sum two integers',
  statement: 'Read two integers and print their sum.\n',
  deadline: '2027-01-01T00:00:00.000Z',
  tests: [{ id: 't1', input: '2 3\n', expectedOutput: '5\n' }],
  constraints: [],
};

export function addLabsOpenApi(document: Document): void {
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const response = (description: string, schema: Schema) => ({
    description,
    content: { 'application/json': { schema } },
  });
  const error = (status: number, description: string) => ({
    description,
    content: {
      'application/problem+json': {
        schema: ref('Problem'),
        example: {
          type: `https://leetkob.example/problems/${status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : status === 404 ? 'not-found' : status === 409 ? 'conflict' : status === 413 ? 'payload-too-large' : status === 415 ? 'unsupported-media-type' : status >= 500 ? 'internal' : 'validation'}`,
          title: description,
          status,
          detail: description,
        },
      },
    },
  });
  const errors = {
    400: error(400, 'Invalid request data.'),
    401: error(401, 'Authentication credentials are invalid or missing.'),
    403: error(403, 'This role cannot access this lab operation.'),
    404: error(404, 'Class or lab not found.'),
    500: error(500, 'An internal error occurred.'),
    503: error(503, 'Service temporarily unavailable.'),
  };
  const parameter = (name: string, example: string) => ({
    name,
    in: 'path' as const,
    required: true,
    schema: { type: 'string' as const, pattern: '^[a-zA-Z0-9_-]{1,64}$' },
    example,
  });
  const security = [{ bearerAuth: [] }];
  document.tags!.push({
    name: 'Labs',
    description:
      'TA creates labs; students see only their own classes, without judge test data.',
  });
  Object.assign(document.components!.schemas!, {
    LabTest: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'input', 'expectedOutput'],
      properties: {
        id: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,64}$' },
        input: {
          type: 'string',
          description: 'stdin, at most 1 MiB UTF-8; whitespace preserved.',
        },
        expectedOutput: {
          type: 'string',
          description:
            'stdout expectation, at most 1 MiB UTF-8; comparison belongs to runner.',
        },
      },
    },
    LabConstraint: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'text', 'deduction'],
      properties: {
        id: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,64}$' },
        text: {
          type: 'string',
          description: 'Nonblank Unicode text, at most 4 KiB UTF-8.',
        },
        deduction: {
          type: 'number',
          minimum: 0,
          exclusiveMinimum: true,
          maximum: 10,
        },
      },
    },
    LabLimits: {
      type: 'object',
      additionalProperties: false,
      required: ['cpuTimeMs', 'memoryMb'],
      properties: {
        cpuTimeMs: {
          type: 'integer',
          minimum: 1000,
          maximum: 5000,
          default: 1000,
        },
        memoryMb: { type: 'integer', minimum: 64, maximum: 512, default: 256 },
      },
    },
    LabCreateInput: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'statement', 'tests', 'constraints', 'deadline'],
      properties: {
        title: {
          type: 'string',
          description: 'Trimmed, 1–200 Unicode code points.',
        },
        statement: {
          type: 'string',
          description: 'Nonblank, at most 256 KiB UTF-8; whitespace retained.',
        },
        opensAt: {
          type: 'string',
          format: 'date-time',
          description:
            'Canonical UTC ISO with milliseconds; omitted means open on creation.',
        },
        deadline: {
          type: 'string',
          format: 'date-time',
          description:
            'Canonical UTC ISO with milliseconds; future for new creation.',
        },
        limits: ref('LabLimits'),
        tests: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: ref('LabTest'),
        },
        constraints: {
          type: 'array',
          maxItems: 50,
          items: ref('LabConstraint'),
        },
      },
      example: labExample,
    },
    LabSummary: {
      type: 'object',
      additionalProperties: false,
      required: [
        'id',
        'classId',
        'title',
        'opensAt',
        'deadline',
        'createdAt',
        'phase',
      ],
      properties: {
        id: { type: 'string' },
        classId: { type: 'string' },
        title: { type: 'string' },
        opensAt: { type: 'string', format: 'date-time' },
        deadline: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        phase: { type: 'string', enum: ['draft', 'open', 'closed'] },
      },
    },
    StudentLab: {
      type: 'object',
      additionalProperties: false,
      required: [
        'id',
        'classId',
        'title',
        'statement',
        'opensAt',
        'deadline',
        'limits',
        'constraints',
        'phase',
      ],
      properties: {
        id: { type: 'string' },
        classId: { type: 'string' },
        title: { type: 'string' },
        statement: { type: 'string' },
        opensAt: { type: 'string', format: 'date-time' },
        deadline: { type: 'string', format: 'date-time' },
        limits: ref('LabLimits'),
        constraints: { type: 'array', items: ref('LabConstraint') },
        phase: { type: 'string', enum: ['draft', 'open', 'closed'] },
      },
    },
    TaLab: {
      type: 'object',
      additionalProperties: false,
      required: [
        'id',
        'classId',
        'title',
        'statement',
        'opensAt',
        'deadline',
        'limits',
        'tests',
        'constraints',
        'createdBy',
        'createdAt',
        'phase',
      ],
      properties: {
        id: { type: 'string' },
        classId: { type: 'string' },
        title: { type: 'string' },
        statement: { type: 'string' },
        opensAt: { type: 'string', format: 'date-time' },
        deadline: { type: 'string', format: 'date-time' },
        limits: ref('LabLimits'),
        tests: { type: 'array', items: ref('LabTest') },
        constraints: { type: 'array', items: ref('LabConstraint') },
        createdBy: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        phase: { type: 'string', enum: ['draft', 'open', 'closed'] },
      },
    },
  });
  document.paths['/classes/{classId}/labs'] = {
    post: {
      tags: ['Labs'],
      operationId: 'createLab',
      summary: 'Tạo lab (TA)',
      security,
      description:
        'Tạo bằng JSON hoặc chọn multipart để upload testsFile/constraintsFile. Trường lab là JSON text: bỏ tests nếu dùng testsFile, bỏ constraints nếu dùng constraintsFile. Mỗi nhóm chỉ nhận một nguồn. Tổng body tối đa 20 MiB, dữ liệu test đã giải mã tối đa 16 MiB. Không lưu file gốc. Key mới cho lab mới; giữ nguyên key khi bấm lại/retry trong 24 giờ. Replay được kiểm tra quyền lại và không tạo lab mới.',
      parameters: [
        parameter('classId', 'demo-class-1'),
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
          example: '11111111-1111-4111-8111-111111111111',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ref('LabCreateInput'),
            example: labExample,
          },
          'multipart/form-data': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['lab'],
              properties: {
                lab: {
                  type: 'string',
                  description:
                    'JSON metadata; include groups inline or omit them when uploading their file. Uncheck Send empty value for files you do not upload.',
                  example: JSON.stringify({
                    title: labExample.title,
                    statement: labExample.statement,
                    deadline: labExample.deadline,
                    constraints: [],
                  }),
                },
                testsFile: {
                  type: 'string',
                  format: 'binary',
                  description:
                    'UTF-8 JSON {"tests":[{"id":"t1","input":"2 3\\n","expectedOutput":"5\\n"}]}',
                },
                constraintsFile: {
                  type: 'string',
                  format: 'binary',
                  description:
                    'UTF-8 JSON {"constraints":[]}; omit constraints from lab when uploading.',
                },
              },
            },
            encoding: {
              testsFile: { contentType: 'application/json' },
              constraintsFile: { contentType: 'application/json' },
            },
          },
        },
      },
      responses: {
        ...errors,
        201: {
          ...response('Lab created or replayed.', {
            type: 'object',
            required: ['lab'],
            properties: { lab: ref('TaLab') },
          }),
          headers: {
            Location: { schema: { type: 'string' }, description: '/labs/<id>' },
            'Idempotent-Replayed': {
              schema: { type: 'string', enum: ['true'] },
              description: 'Present only on replay.',
            },
          },
        },
        409: error(
          409,
          'Idempotency-Key was already used with different lab data.',
        ),
        413: error(413, 'Request body is too large.'),
        415: error(
          415,
          'Content-Type must be application/json or multipart/form-data.',
        ),
      },
    },
    get: {
      tags: ['Labs'],
      operationId: 'listClassLabs',
      summary: 'Danh sách lab trong lớp',
      security,
      parameters: [parameter('classId', 'demo-class-1')],
      description:
        'Không phân trang. Mới nhất trước, tie-break ID tăng dần. Student không thấy draft. Chỉ metadata, không tải đề/test/constraints.',
      responses: {
        ...errors,
        200: response('Accessible lab summaries.', {
          type: 'object',
          required: ['labs'],
          properties: { labs: { type: 'array', items: ref('LabSummary') } },
        }),
      },
    },
  };
  document.paths['/labs/{labId}'] = {
    get: {
      tags: ['Labs'],
      operationId: 'getLab',
      summary: 'Chi tiết lab theo role',
      security,
      parameters: [parameter('labId', 'replace-with-created-lab-id')],
      description:
        'TA cùng lớp xem đầy đủ. Student cùng lớp xem khi đã mở, không nhận bộ test. Tài nguyên ngoài quyền hoặc chưa mở trả 404. Admin không có quyền TA tự động.',
      responses: {
        ...errors,
        200: response('Role-specific lab detail.', {
          type: 'object',
          required: ['lab'],
          properties: { lab: { oneOf: [ref('TaLab'), ref('StudentLab')] } },
        }),
      },
    },
  };
}
