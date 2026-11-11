import type { PublishStore, PublicationSummary } from '../../data/types.js';
import type { IdentityResolver } from '../../auth/types.js';

export interface LabPublication {
  readonly labId: string;
  readonly classId: string;
  readonly status: 'published';
  readonly publishedAt: string;
  readonly publishedBy: string;
  readonly summary: PublicationSummary;
}

export interface PublishModuleOptions {
  readonly store?: PublishStore;
  readonly identityResolver?: IdentityResolver;
}
