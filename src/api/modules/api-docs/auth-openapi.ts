import type { StaticDocumentSpec } from '@fastify/swagger';

type Document = Extract<StaticDocumentSpec['document'], { openapi: string }>;
type Schema = NonNullable<
  NonNullable<Document['components']>['schemas']
>[string];

const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});
const noStore = {
  'Cache-Control': { schema: { type: 'string' as const }, example: 'no-store' },
};
const jsonResponse = (
  description: string,
  schema: Schema,
  example: unknown,
) => ({
  description,
  headers: noStore,
  content: { 'application/json': { schema, example } },
});
const problemSlugs: Record<number, string> = {
  400: 'validation',
  401: 'unauthenticated',
  409: 'conflict',
  413: 'payload-too-large',
  415: 'unsupported-media-type',
  429: 'rate-limited',
  500: 'internal',
  503: 'internal',
};
const problemResponse = (status: number, description: string) => ({
  description,
  headers: {
    ...noStore,
    ...(status === 401
      ? {
          'WWW-Authenticate': {
            schema: { type: 'string' as const },
            example: 'Bearer',
          },
        }
      : {}),
    ...(status === 429 || status === 503
      ? {
          'Retry-After': {
            description:
              'Seconds before retrying (503 includes this header for overload).',
            schema: { type: 'integer' as const, minimum: 1 },
          },
        }
      : {}),
  },
  content: {
    'application/problem+json': {
      schema: ref('Problem'),
      example: {
        type: `https://leetkob.example/problems/${problemSlugs[status]}`,
        title: description,
        status,
        detail: description,
      },
    },
  },
});

// Wire specification for the existing auth contract, served without changing
// handler validation/serialization. Keep tests and docs/contract/auth.md aligned.
export function createAuthOpenApi(): Document {
  const student = {
    id: 'demo-student001',
    username: 'student001',
    displayName: 'Student 1',
    role: 'student',
  };
  const registeredStudent = {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'student.demo',
    displayName: 'Sinh viên Demo',
    role: 'student',
  };
  const requestBody = (
    schema: string,
    examples: Record<
      string,
      { summary: string; value: Record<string, string> }
    >,
  ) => ({
    required: true,
    description: 'JSON only; maximum 8192 bytes.',
    content: { 'application/json': { schema: ref(schema), examples } },
  });
  const commonErrors = {
    400: {
      ...problemResponse(
        400,
        'Missing, unexpected or incorrectly typed fields.',
      ),
      content: {
        'application/problem+json': {
          schema: ref('Problem'),
          examples: {
            validation: {
              summary: 'Thiếu trường, thừa trường hoặc sai kiểu dữ liệu',
              value: {
                type: 'https://leetkob.example/problems/validation',
                title: 'Missing, unexpected or incorrectly typed fields.',
                status: 400,
                detail: 'Missing, unexpected or incorrectly typed fields.',
              },
            },
            invalidJson: {
              summary: 'JSON không hợp lệ',
              value: {
                type: 'https://leetkob.example/problems/invalid-json',
                title: 'The request body is not valid JSON.',
                status: 400,
                detail: 'The request body is not valid JSON.',
              },
            },
          },
        },
      },
    },
    413: problemResponse(413, 'Request body is too large.'),
    415: problemResponse(415, 'Content-Type must be application/json.'),
    429: problemResponse(429, 'Too many authentication attempts.'),
    500: problemResponse(500, 'An internal error occurred.'),
    503: problemResponse(503, 'Service temporarily unavailable.'),
  };
  return {
    openapi: '3.0.3',
    info: {
      title: 'LeeTKOB Auth API',
      version: '0.1.0',
      description:
        'Đăng ký student, đăng nhập và quản lý phiên. Để test: login, copy accessToken, bấm Authorize và chỉ nhập token (không thêm Bearer). Token hết hạn sau 12 giờ. Tài khoản mới chưa thuộc lớp nào. Tài khoản seed dev dùng password công khai password123. Tài khoản tự đăng ký vẫn cần password 15–128 ký tự.',
    },
    // Origin-relative: requests use the API hosting this page, including custom ports.
    servers: [{ url: '/', description: 'API hiện tại' }],
    tags: [
      {
        name: 'Auth',
        description: 'Stateful server sessions, opaque Bearer tokens.',
      },
    ],
    paths: {
      '/auth/register': {
        post: {
          operationId: 'registerStudent',
          tags: ['Auth'],
          summary: 'Đăng ký student',
          security: [],
          description:
            'Server gán role student; không tạo session hoặc membership. Username được trim/lowercase; trường thừa bị từ chối. Gọi lại cùng username trả 409. Giới hạn 20 request/IP/giờ.',
          requestBody: requestBody('RegisterInput', {
            student: {
              summary: 'Tạo student thử nghiệm (đổi username nếu đã tồn tại)',
              value: {
                username: 'student.demo',
                password: 'DemoStudent123!2026',
                displayName: 'Sinh viên Demo',
              },
            },
          }),
          responses: {
            ...commonErrors,
            201: jsonResponse(
              'Student created. Login separately.',
              ref('UserResponse'),
              { user: registeredStudent },
            ),
            409: problemResponse(409, 'Username is unavailable.'),
          },
        },
      },
      '/auth/login': {
        post: {
          operationId: 'login',
          tags: ['Auth'],
          summary: 'Đăng nhập và lấy token',
          security: [],
          description:
            'Mỗi lần thành công tạo một phiên mới, thời hạn tuyệt đối 12 giờ. Sai username/password trả cùng lỗi. Giới hạn 120 request/IP/phút và 10 lần thất bại hoặc đang xử lý/cặp IP–username/15 phút. Password giữ nguyên khoảng trắng.',
          requestBody: requestBody('LoginInput', {
            student: {
              summary: 'Student seed — học cả hai lớp',
              value: { username: 'student001', password: 'password123' },
            },
            ta: {
              summary: 'TA seed — phụ trách lớp 1',
              value: { username: 'ta01', password: 'password123' },
            },
            admin: {
              summary: 'Admin seed',
              value: { username: 'admin.vuong', password: 'password123' },
            },
            registeredStudent: {
              summary: 'Student vừa tạo bằng mẫu đăng ký',
              value: {
                username: 'student.demo',
                password: 'DemoStudent123!2026',
              },
            },
          }),
          responses: {
            ...commonErrors,
            200: jsonResponse(
              'Login successful. The example token is illustrative; copy accessToken from your executed response into Authorize.',
              ref('LoginResponse'),
              {
                accessToken: 'A'.repeat(43),
                tokenType: 'Bearer',
                expiresAt: '2026-11-21T12:00:00.000Z',
                user: student,
              },
            ),
            401: problemResponse(401, 'Invalid username or password.'),
          },
        },
      },
      '/auth/me': {
        get: {
          operationId: 'getCurrentUser',
          tags: ['Auth'],
          summary: 'Xem danh tính và lớp hiện tại',
          security: [{ bearerAuth: [] }],
          description:
            'Đọc user và membership hiện tại từ server; không nhận token trong query hoặc body.',
          responses: {
            200: jsonResponse(
              'Current user and memberships.',
              ref('MeResponse'),
              {
                user: student,
                memberships: [
                  {
                    userId: student.id,
                    classId: 'demo-class-1',
                    role: 'student',
                  },
                  {
                    userId: student.id,
                    classId: 'demo-class-2',
                    role: 'student',
                  },
                ],
              },
            ),
            401: problemResponse(
              401,
              'Authentication credentials are invalid or missing.',
            ),
            500: commonErrors[500],
            503: commonErrors[503],
          },
        },
      },
      '/auth/logout': {
        post: {
          operationId: 'logout',
          tags: ['Auth'],
          summary: 'Đăng xuất phiên hiện tại',
          security: [{ bearerAuth: [] }],
          description:
            'Không cần body. Thu hồi token đang dùng, giữ các phiên khác. Token đúng định dạng đã hết hạn/thu hồi vẫn trả 204. Swagger không tự xóa token trong Authorize sau khi logout.',
          responses: {
            204: {
              description: 'Session revoked or already absent; empty body.',
              headers: noStore,
            },
            401: problemResponse(
              401,
              'Authentication credentials are invalid or missing.',
            ),
            500: commonErrors[500],
            503: commonErrors[503],
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Opaque session token',
          description:
            'Paste accessToken only. Swagger adds the Bearer prefix.',
        },
      },
      schemas: {
        LoginInput: {
          type: 'object',
          additionalProperties: false,
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description:
                'Trim/lowercase first, then 3–32 ASCII letters, digits, dot, underscore or hyphen.',
              example: 'student001',
            },
            password: {
              type: 'string',
              format: 'password',
              writeOnly: true,
              minLength: 1,
              maxLength: 128,
              description:
                '1–128 Unicode code points; must be well-formed Unicode. No trimming or normalization. Enter your own password.',
            },
          },
        },
        RegisterInput: {
          type: 'object',
          additionalProperties: false,
          required: ['username', 'password', 'displayName'],
          properties: {
            username: {
              type: 'string',
              description:
                'Trim/lowercase first, then match [a-z0-9._-]{3,32}.',
              example: 'manual.student',
            },
            password: {
              type: 'string',
              format: 'password',
              writeOnly: true,
              minLength: 15,
              maxLength: 128,
              description:
                '15–128 Unicode code points; must be well-formed Unicode. Enter a new password; do not reuse a production password.',
            },
            displayName: {
              type: 'string',
              description:
                'Trim first, then 1–100 Unicode code points. Must be well-formed Unicode and contain no NUL (U+0000).',
              example: 'Manual Student',
            },
          },
        },
        User: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'username', 'displayName', 'role'],
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            displayName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'TA', 'student'] },
          },
        },
        Membership: {
          type: 'object',
          additionalProperties: false,
          required: ['userId', 'classId', 'role'],
          properties: {
            userId: { type: 'string' },
            classId: { type: 'string' },
            role: { type: 'string', enum: ['TA', 'student'] },
          },
        },
        UserResponse: {
          type: 'object',
          additionalProperties: false,
          required: ['user'],
          properties: { user: ref('User') },
        },
        LoginResponse: {
          type: 'object',
          additionalProperties: false,
          required: ['accessToken', 'tokenType', 'expiresAt', 'user'],
          properties: {
            accessToken: {
              type: 'string',
              pattern: '^[A-Za-z0-9_-]{43}$',
              description: 'Private opaque token. Copy into Authorize.',
            },
            tokenType: { type: 'string', enum: ['Bearer'] },
            expiresAt: { type: 'string', format: 'date-time' },
            user: ref('User'),
          },
        },
        MeResponse: {
          type: 'object',
          additionalProperties: false,
          required: ['user', 'memberships'],
          properties: {
            user: ref('User'),
            memberships: { type: 'array', items: ref('Membership') },
          },
        },
        Problem: {
          type: 'object',
          required: ['type', 'title', 'status', 'detail'],
          properties: {
            type: { type: 'string', format: 'uri' },
            title: { type: 'string' },
            status: { type: 'integer' },
            detail: { type: 'string' },
          },
        },
      },
    },
  };
}
