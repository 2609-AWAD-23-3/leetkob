import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { AuthStore } from '../../../db/auth-store.js';
import {
  normalizeUsername,
  isValidDisplayName,
} from '../../../shared/accounts.js';
import {
  passwords,
  PasswordBusyError,
  DUMMY_PASSWORD_HASH,
} from '../../../shared/passwords.js';
import type { PasswordService } from '../../../shared/passwords.js';
import { ProblemError, sendProblem } from '../../auth/problem-details.js';
import type { ProblemDetails, ProblemSlug } from '../../auth/types.js';
import { AuthLimiter, AuthLimitError } from '../../auth/rate-limit.js';
import {
  createSessionIdentityResolver,
  generateSessionToken,
  hashSessionToken,
  readSessionToken,
} from '../../auth/session.js';

export interface AuthOptions {
  store: AuthStore;
  clock?: () => Date;
  generateToken?: () => string;
  passwords?: Pick<PasswordService, 'hash' | 'verify'>;
  limiter?: AuthLimiter;
}

function fail(
  status: ProblemDetails['status'],
  slug: ProblemSlug,
  detail: string,
): never {
  throw new ProblemError({
    type: `https://leetkob.example/problems/${slug}`,
    title: detail,
    status,
    detail,
  });
}

export function validateAuthBody(
  body: unknown,
  register: boolean,
): { username: string; password: string; displayName: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    fail(400, 'validation', 'A JSON object is required.');
  const value = body as Record<string, unknown>;
  const fields = register
    ? ['username', 'password', 'displayName']
    : ['username', 'password'];
  if (
    Object.keys(value).length !== fields.length ||
    fields.some(
      (key) => !Object.hasOwn(value, key) || typeof value[key] !== 'string',
    )
  )
    fail(400, 'validation', 'Missing, unexpected or incorrectly typed fields.');
  const username = normalizeUsername(value.username as string);
  const password = value.password as string;
  const displayName = register ? (value.displayName as string).trim() : '';
  if (!/^[a-z0-9._-]{3,32}$/.test(username))
    fail(400, 'validation', 'Invalid username.');
  const length = [...password].length;
  if (!password.isWellFormed())
    fail(400, 'validation', 'Password must contain valid Unicode.');
  if (length < (register ? 15 : 1) || length > 128)
    fail(400, 'validation', 'Invalid password length.');
  if (register && !isValidDisplayName(displayName))
    fail(400, 'validation', 'Invalid display name.');
  return { username, password, displayName };
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (
    error instanceof Error &&
    [
      'Connection terminated unexpectedly',
      'Connection terminated due to connection timeout',
      'timeout exceeded when trying to connect',
    ].includes(error.message)
  )
    return true;
  const code = (error as { code?: unknown } | null)?.code;
  return (
    typeof code === 'string' &&
    (code.startsWith('08') ||
      [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'EPIPE',
        'ENOTFOUND',
        '57P01',
        '57P02',
        '57P03',
        '53300',
      ].includes(code))
  );
}

export function createAuthModule(options: AuthOptions): FastifyPluginAsync {
  return async (scope) => {
    const clock = options.clock ?? (() => new Date());
    const service = options.passwords ?? passwords;
    const limiter = options.limiter ?? new AuthLimiter(() => clock().getTime());
    const identity = createSessionIdentityResolver(options.store);
    scope.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
    });
    scope.removeContentTypeParser('text/plain');
    scope.setErrorHandler((error, _request, reply) => {
      const statusCode = (error as { statusCode?: number } | null)?.statusCode;
      if (error instanceof ProblemError)
        return sendProblem(reply, error.problem);
      let status: ProblemDetails['status'] = 500;
      let slug: ProblemSlug = 'internal';
      let detail = 'An internal error occurred.';
      if (error instanceof AuthLimitError) {
        status = error.status;
        slug = status === 429 ? 'rate-limited' : 'internal';
        detail =
          status === 429
            ? 'Too many authentication attempts.'
            : 'Service temporarily unavailable.';
        reply.header('Retry-After', error.retryAfter);
      } else if (
        error instanceof PasswordBusyError ||
        isDatabaseUnavailable(error)
      ) {
        status = 503;
        detail = 'Service temporarily unavailable.';
        if (error instanceof PasswordBusyError) reply.header('Retry-After', 1);
      } else if (statusCode === 413) {
        status = 413;
        slug = 'payload-too-large';
        detail = 'Request body is too large.';
      } else if (statusCode === 415) {
        status = 415;
        slug = 'unsupported-media-type';
        detail = 'Content-Type must be application/json.';
      } else if (statusCode === 400 || error instanceof SyntaxError) {
        status = 400;
        slug = 'invalid-json';
        detail = 'The request body is not valid JSON.';
      }
      return sendProblem(reply, {
        type: `https://leetkob.example/problems/${slug}`,
        title: detail,
        status,
        detail,
      });
    });
    const routeOptions = { bodyLimit: 8192 };
    scope.post('/auth/register', routeOptions, async (request, reply) => {
      const input = validateAuthBody(request.body, true);
      limiter.request('register', request.ip);
      const passwordHash = await service.hash(input.password);
      const result = await options.store.createStudent({
        username: input.username,
        displayName: input.displayName,
        passwordHash,
      });
      if (result.kind === 'username-conflict')
        fail(409, 'conflict', 'Username is unavailable.');
      return reply.code(201).send({ user: result.user });
    });
    scope.post('/auth/login', routeOptions, async (request) => {
      const input = validateAuthBody(request.body, false);
      limiter.request('login', request.ip);
      const reservation = limiter.reserveLogin(request.ip, input.username);
      try {
        const credentials = await options.store.findUserByUsername(
          input.username,
        );
        const valid = await service.verify(
          input.password,
          credentials?.passwordHash ?? DUMMY_PASSWORD_HASH,
        );
        if (!credentials || !valid)
          fail(401, 'unauthenticated', 'Invalid username or password.');
        const token = (options.generateToken ?? generateSessionToken)();
        if (readSessionToken({ authorization: `Bearer ${token}` }) !== token)
          throw new Error('Invalid token generator');
        const expiresAt = new Date(
          clock().getTime() + 12 * 60 * 60 * 1000,
        ).toISOString();
        await options.store.createSession({
          tokenHash: hashSessionToken(token),
          userId: credentials.user.id,
          expiresAt,
        });
        reservation.succeed();
        return {
          accessToken: token,
          tokenType: 'Bearer',
          expiresAt,
          user: credentials.user,
        };
      } catch (error) {
        if (!(error instanceof ProblemError && error.problem.status === 401))
          reservation.cancel();
        throw error;
      }
    });
    const unauthorized = (reply: FastifyReply): never => {
      reply.header('WWW-Authenticate', 'Bearer');
      return fail(
        401,
        'unauthenticated',
        'Authentication credentials are invalid or missing.',
      );
    };
    scope.get('/auth/me', routeOptions, async (request, reply) => {
      const user = await identity.resolve(request.headers);
      if (!user) return unauthorized(reply);
      return {
        user,
        memberships: await options.store.listMemberships(user.id),
      };
    });
    scope.post('/auth/logout', routeOptions, async (request, reply) => {
      const token = readSessionToken(request.headers);
      if (!token) return unauthorized(reply);
      await options.store.deleteSession(hashSessionToken(token));
      return reply.code(204).send();
    });
  };
}
