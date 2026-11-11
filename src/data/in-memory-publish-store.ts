import type {
  InMemoryPublishStoreOptions,
  Lab,
  Publication,
  PublishStoreFixture,
  ReviewState,
  SeedState,
} from './types.js';

interface State {
  labs: Map<string, Lab>;
  memberships: Set<string>;
  reviews: Map<string, ReviewState>;
  publications: Map<string, Publication>;
}

function emptySeed(): SeedState {
  return { labs: [], memberships: [], queueItems: [], publications: [] };
}

function requireId(value: unknown, field: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new TypeError(
      `${field} must be a nonempty ID without surrounding whitespace`,
    );
  }
}

function requireTimestamp(
  value: unknown,
  field: string,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new TypeError(`${field} must be a canonical UTC ISO timestamp`);
  }
}

function unique(set: Set<string>, key: string, field: string): void {
  if (set.has(key)) throw new TypeError(`Duplicate ${field}`);
  set.add(key);
}

// Tuple encoding avoids collisions when IDs themselves contain separators.
function tuple(...ids: string[]): string {
  return JSON.stringify(ids);
}

function buildState(seed: SeedState): State {
  const labs = new Map<string, Lab>();
  const memberships = new Set<string>();
  const reviews = new Map<string, ReviewState>();
  const publications = new Map<string, Publication>();
  const reviewIds = new Set<string>();
  const reviewPairs = new Set<string>();

  for (const field of [
    'labs',
    'memberships',
    'queueItems',
    'publications',
  ] as const) {
    if (!Array.isArray(seed[field]))
      throw new TypeError(`seed.${field} must be an array`);
  }
  for (const lab of seed.labs) {
    requireId(lab.id, 'lab.id');
    requireId(lab.classId, 'lab.classId');
    requireTimestamp(lab.deadline, 'lab.deadline');
    if (labs.has(lab.id)) throw new TypeError('Duplicate lab.id');
    labs.set(lab.id, {
      id: lab.id,
      classId: lab.classId,
      deadline: lab.deadline,
    });
    reviews.set(lab.id, {
      queueItemCount: 0,
      pendingCount: 0,
      passDecisionCount: 0,
      violationDecisionCount: 0,
    });
  }
  for (const membership of seed.memberships) {
    requireId(membership.taId, 'membership.taId');
    requireId(membership.classId, 'membership.classId');
    unique(
      memberships,
      tuple(membership.taId, membership.classId),
      'membership',
    );
  }
  for (const item of seed.queueItems) {
    requireId(item.id, 'queueItem.id');
    requireId(item.labId, 'queueItem.labId');
    requireId(item.submissionId, 'queueItem.submissionId');
    requireId(item.constraintId, 'queueItem.constraintId');
    const review = reviews.get(item.labId);
    if (!review) throw new TypeError('queueItem references an unknown lab');
    unique(reviewIds, item.id, 'queueItem.id');
    unique(
      reviewPairs,
      tuple(item.labId, item.submissionId, item.constraintId),
      'review pair',
    );
    if (!['pass', 'violation', 'unsure'].includes(item.verdict)) {
      throw new TypeError('queueItem.verdict is invalid');
    }
    if (
      item.taDecision !== null &&
      item.taDecision !== 'pass' &&
      item.taDecision !== 'violation'
    ) {
      throw new TypeError('queueItem.taDecision is invalid');
    }
    review.queueItemCount += 1;
    if (item.taDecision === null) review.pendingCount += 1;
    else if (item.taDecision === 'pass') review.passDecisionCount += 1;
    else review.violationDecisionCount += 1;
  }
  for (const publication of seed.publications) {
    requireId(publication.labId, 'publication.labId');
    requireId(publication.publishedBy, 'publication.publishedBy');
    requireTimestamp(publication.publishedAt, 'publication.publishedAt');
    const lab = labs.get(publication.labId);
    const review = reviews.get(publication.labId);
    if (!lab || !review)
      throw new TypeError('publication references an unknown lab');
    if (publications.has(publication.labId))
      throw new TypeError('Duplicate publication.labId');
    if (Date.parse(publication.publishedAt) < Date.parse(lab.deadline)) {
      throw new TypeError('publication cannot precede the deadline');
    }
    if (review.pendingCount !== 0)
      throw new TypeError('publication cannot have pending reviews');
    const summary = publication.summary;
    if (
      !summary ||
      summary.queueItemCount !== review.queueItemCount ||
      summary.passDecisionCount !== review.passDecisionCount ||
      summary.violationDecisionCount !== review.violationDecisionCount
    ) {
      throw new TypeError('publication.summary must match the resolved queue');
    }
    publications.set(publication.labId, {
      labId: publication.labId,
      publishedAt: publication.publishedAt,
      publishedBy: publication.publishedBy,
      summary: {
        queueItemCount: review.queueItemCount,
        passDecisionCount: review.passDecisionCount,
        violationDecisionCount: review.violationDecisionCount,
      },
    });
  }
  return { labs, memberships, reviews, publications };
}

function copyPublication(publication: Publication): Publication {
  return { ...publication, summary: { ...publication.summary } };
}

export function createInMemoryPublishStore(
  options: InMemoryPublishStoreOptions = {},
): PublishStoreFixture {
  const clock = options.clock ?? (() => new Date());
  let state = buildState(options.initialState ?? emptySeed());

  return {
    store: {
      getLab(labId) {
        const lab = state.labs.get(labId);
        return lab ? { ...lab } : undefined;
      },
      isTaAssignedToClass(taId, classId) {
        return state.memberships.has(tuple(taId, classId));
      },
      getReviewState(labId) {
        const review = state.reviews.get(labId);
        return review ? { ...review } : undefined;
      },
      getPublication(labId) {
        const publication = state.publications.get(labId);
        return publication ? copyPublication(publication) : undefined;
      },
      publishLab({ labId, publishedBy }) {
        const lab = state.labs.get(labId);
        if (!lab) return { kind: 'lab_not_found' };
        const existing = state.publications.get(labId);
        if (existing)
          return {
            kind: 'already_published',
            publication: copyPublication(existing),
          };
        requireId(publishedBy, 'publishedBy');

        // Read the trusted clock once before the deadline/pending checks and write.
        // It must not re-enter this store or reset its fixture lifecycle.
        const now = clock();
        if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
          throw new TypeError('clock must return a valid Date');
        }
        const timestamp = now.toISOString();
        if (now.getTime() < Date.parse(lab.deadline)) {
          return { kind: 'before_deadline', deadline: lab.deadline };
        }
        const review = state.reviews.get(labId)!;
        if (review.pendingCount !== 0) {
          return { kind: 'pending_reviews', pendingCount: review.pendingCount };
        }
        const publication: Publication = {
          labId,
          publishedBy,
          publishedAt: timestamp,
          summary: {
            queueItemCount: review.queueItemCount,
            passDecisionCount: review.passDecisionCount,
            violationDecisionCount: review.violationDecisionCount,
          },
        };
        state.publications.set(labId, publication);
        return { kind: 'published', publication: copyPublication(publication) };
      },
    },
    reset(nextState = emptySeed()) {
      // Build first, then swap: failed validation leaves all old state intact.
      state = buildState(nextState);
    },
  };
}
