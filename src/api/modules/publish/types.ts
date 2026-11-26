import type { PublicationSummary } from '../../../db/types.js';
import type {
  PublishIdentityResolver,
  PublishRouteStore,
} from '../../auth/types.js';

export interface LabPublication {
  readonly labId: string;
  readonly classId: string;
  readonly status: 'published';
  readonly publishedAt: string;
  readonly publishedBy: string;
  readonly summary: PublicationSummary;
}

// The PA02 synchronous PublishStore and the PA03 async Store (PublicationStore
// + LabStore) both fit PublishRouteStore; contract v1 is the same for both.
export interface PublishModuleOptions {
  readonly store?: PublishRouteStore;
  readonly identityResolver?: PublishIdentityResolver;
}
