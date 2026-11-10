import type { Lab, PublishResult, PublishStore } from '../data/types.js';

export type PrincipalRole = 'admin' | 'TA' | 'student';

export interface Principal {
  readonly id: string;
  readonly role: PrincipalRole;
}

export type UnauthenticatedReason =
  | 'missing_credentials'
  | 'malformed_credentials'
  | 'invalid_credentials';

export type IdentityResolution =
  | { readonly kind: 'authenticated'; readonly principal: Principal }
  | { readonly kind: 'unauthenticated'; readonly reason: UnauthenticatedReason };

export type IncomingHeaders = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export interface IdentityResolver {
  resolve(headers: IncomingHeaders): IdentityResolution;
}

export interface TokenIdentityResolverOptions {
  readonly tokens?:
    | ReadonlyMap<string, Principal>
    | Readonly<Record<string, Principal>>;
}

export interface TestHeaderIdentityResolverOptions {
  // Explicit test-only opt-in. Must remain false in default server startup.
  readonly allowTestHeader?: boolean;
  readonly fallbackResolver?: IdentityResolver;
}

export type PublishAccessDecision =
  | { readonly kind: 'unauthenticated'; readonly reason: UnauthenticatedReason }
  | { readonly kind: 'forbidden_role'; readonly principal: Principal }
  | { readonly kind: 'lab_not_found'; readonly labId: string }
  | {
      readonly kind: 'forbidden_class';
      readonly principal: Principal & { readonly role: 'TA' };
      readonly labId: string;
    }
  | {
      readonly kind: 'authorized';
      readonly principal: Principal & { readonly role: 'TA' };
      readonly lab: Lab;
    };

export interface AuthorizePublishInput {
  readonly headers: IncomingHeaders;
  readonly labId: string;
  readonly store: Pick<PublishStore, 'getLab' | 'isTaAssignedToClass'>;
  readonly identityResolver: IdentityResolver;
}

export type ProblemSlug =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid-json'
  | 'validation'
  | 'not-found'
  | 'conflict'
  | 'before-deadline'
  | 'pending-reviews'
  | 'payload-too-large'
  | 'unsupported-media-type'
  | 'unprocessable-content'
  | 'rate-limited'
  | 'client-error'
  | 'internal';

export type ValidationIssue =
  | { readonly parameter: string; readonly detail: string }
  | { readonly pointer: string; readonly detail: string };

export interface ProblemDetails {
  readonly type: `https://leetkob.example/problems/${ProblemSlug}`;
  readonly title: string;
  readonly status: 400 | 401 | 403 | 404 | 405 | 409 | 413 | 415 | 422 | 429 | 500;
  readonly detail: string;
  readonly errors?: readonly ValidationIssue[];
  readonly deadline?: string;
  readonly pendingCount?: number;
}

export type PublishResultProblem = Exclude<
  PublishResult,
  { kind: 'published' } | { kind: 'already_published' }
>;
