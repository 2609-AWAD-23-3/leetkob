import type {
  AuthorizePublishInput,
  IdentityResolution,
  IdentityResolver,
  IncomingHeaders,
  Principal,
  PrincipalRole,
  PublishAccessDecision,
  TestHeaderIdentityResolverOptions,
  TokenIdentityResolverOptions,
} from './types.js';

const VALID_ROLES: ReadonlySet<PrincipalRole> = new Set([
  'admin',
  'TA',
  'student',
]);

function isNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.trim() === value
  );
}

function isPrincipalRole(value: unknown): value is PrincipalRole {
  return typeof value === 'string' && VALID_ROLES.has(value as PrincipalRole);
}

export function validatePrincipal(
  value: unknown,
  label = 'principal',
): Principal {
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object`);
  }
  const candidate = value as Record<string, unknown>;
  if (!isNonEmptyTrimmedString(candidate.id)) {
    throw new TypeError(
      `${label}.id must be a non-empty string without surrounding whitespace`,
    );
  }
  if (!isPrincipalRole(candidate.role)) {
    throw new TypeError(`${label}.role must be admin, TA or student`);
  }
  return { id: candidate.id, role: candidate.role };
}

function readHeaderCaseInsensitive(
  headers: IncomingHeaders,
  targetName: string,
): string | readonly string[] | undefined {
  const lower = targetName.toLowerCase();
  if (lower in headers) {
    return headers[lower];
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }
  return undefined;
}

function cloneTokenEntries(
  tokens: TokenIdentityResolverOptions['tokens'],
): Map<string, Principal> {
  const map = new Map<string, Principal>();
  if (!tokens) return map;

  const entries: Iterable<readonly [string, Principal]> =
    tokens instanceof Map ? tokens.entries() : Object.entries(tokens);

  for (const [token, principal] of entries) {
    if (!isNonEmptyTrimmedString(token) || /\s/.test(token)) {
      throw new TypeError(
        'Bearer token key must be a non-empty string without whitespace',
      );
    }
    if (map.has(token)) {
      throw new TypeError(`Duplicate bearer token key: ${token}`);
    }
    map.set(token, validatePrincipal(principal, `tokens[${token}]`));
  }
  return map;
}

// Resolves caller identity strictly from Authorization: Bearer <token>.
// Never inspects request body, query parameters or client-declared role/userId fields.
export function createTokenIdentityResolver(
  options: TokenIdentityResolverOptions = {},
): IdentityResolver {
  const tokenDirectory = cloneTokenEntries(options.tokens);

  return {
    resolve(headers: IncomingHeaders): IdentityResolution {
      if (!headers || typeof headers !== 'object') {
        return { kind: 'unauthenticated', reason: 'missing_credentials' };
      }
      const rawAuth = readHeaderCaseInsensitive(headers, 'authorization');
      if (rawAuth === undefined) {
        return { kind: 'unauthenticated', reason: 'missing_credentials' };
      }
      if (typeof rawAuth !== 'string') {
        return { kind: 'unauthenticated', reason: 'malformed_credentials' };
      }
      if (rawAuth.trim() !== rawAuth || rawAuth.length === 0) {
        return { kind: 'unauthenticated', reason: 'malformed_credentials' };
      }
      const match = /^Bearer\s+(\S+)$/i.exec(rawAuth);
      if (!match || !match[1]) {
        return { kind: 'unauthenticated', reason: 'malformed_credentials' };
      }
      const principal = tokenDirectory.get(match[1]);
      if (!principal) {
        return { kind: 'unauthenticated', reason: 'invalid_credentials' };
      }
      return {
        kind: 'authenticated',
        principal: { id: principal.id, role: principal.role },
      };
    },
  };
}

// Explicit test-only helper. Default allowTestHeader is false so normal server startup
// never accepts x-test-user-id / x-test-role headers as an authorization bypass.
export function createTestHeaderIdentityResolver(
  options: TestHeaderIdentityResolverOptions = {},
): IdentityResolver {
  const allowTestHeader = options.allowTestHeader === true;
  const fallback = options.fallbackResolver ?? createTokenIdentityResolver();

  return {
    resolve(headers: IncomingHeaders): IdentityResolution {
      if (!headers || typeof headers !== 'object') {
        return { kind: 'unauthenticated', reason: 'missing_credentials' };
      }
      if (!allowTestHeader) {
        return fallback.resolve(headers);
      }

      const rawUserId = readHeaderCaseInsensitive(headers, 'x-test-user-id');
      const rawRole = readHeaderCaseInsensitive(headers, 'x-test-role');

      if (rawUserId === undefined && rawRole === undefined) {
        return fallback.resolve(headers);
      }
      if (typeof rawUserId !== 'string' || typeof rawRole !== 'string') {
        return { kind: 'unauthenticated', reason: 'malformed_credentials' };
      }
      if (!isNonEmptyTrimmedString(rawUserId) || !isPrincipalRole(rawRole)) {
        return { kind: 'unauthenticated', reason: 'malformed_credentials' };
      }
      return {
        kind: 'authenticated',
        principal: { id: rawUserId, role: rawRole },
      };
    },
  };
}

// Fictional fixture tokens matching the T02 publish fixture TA IDs plus non-TA roles.
export function createPublishFixtureTokens(): Record<string, Principal> {
  return {
    'token-ta-one': { id: 'ta-one', role: 'TA' },
    'token-ta-other': { id: 'ta-other', role: 'TA' },
    'token-ta-multi': { id: 'ta-multi', role: 'TA' },
    'token-student-one': { id: 'student-one', role: 'student' },
    'token-admin-one': { id: 'admin-one', role: 'admin' },
  };
}

// Enforces the publish authorization boundary using T02's PublishStore lookup interface:
// 1. Caller must be authenticated.
// 2. Caller must have role === 'TA'.
// 3. Target lab must exist in PublishStore.
// 4. TA must be assigned to the class that owns the target lab.
export function authorizePublishAccess(
  input: AuthorizePublishInput,
): PublishAccessDecision {
  const resolution = input.identityResolver.resolve(input.headers);
  if (resolution.kind === 'unauthenticated') {
    return resolution;
  }

  const { principal } = resolution;
  if (principal.role !== 'TA') {
    return {
      kind: 'forbidden_role',
      principal: { id: principal.id, role: principal.role },
    };
  }

  const lab = input.store.getLab(input.labId);
  if (!lab) {
    return { kind: 'lab_not_found', labId: input.labId };
  }

  if (!input.store.isTaAssignedToClass(principal.id, lab.classId)) {
    return {
      kind: 'forbidden_class',
      principal: { id: principal.id, role: 'TA' },
      labId: lab.id,
    };
  }

  return {
    kind: 'authorized',
    principal: { id: principal.id, role: 'TA' },
    lab: { ...lab },
  };
}
