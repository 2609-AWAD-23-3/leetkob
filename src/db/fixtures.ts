import type { SeedState } from './types.js';

export const FIXTURE_DEADLINE = '2026-11-09T15:00:00.000Z';
export const FIXTURE_AFTER_DEADLINE = '2026-11-09T15:00:00.001Z';

export function createFixedClock(
  timestamp = FIXTURE_AFTER_DEADLINE,
): () => Date {
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds))
    throw new TypeError('Fixed clock timestamp is invalid');
  return () => new Date(milliseconds);
}

// Fictional IDs only. Every call returns an entirely fresh graph of seed objects.
export function createPublishSeed(
  scenario: 'resolved' | 'pending' | 'empty' | 'published' = 'resolved',
): SeedState {
  if (!['resolved', 'pending', 'empty', 'published'].includes(scenario)) {
    throw new TypeError('Unknown publish fixture scenario');
  }
  const queueItems: SeedState['queueItems'] =
    scenario === 'empty'
      ? []
      : [
          {
            id: 'review-1',
            labId: 'lab-1',
            submissionId: 'submission-1',
            constraintId: 'constraint-1',
            verdict: 'violation',
            taDecision: scenario === 'pending' ? null : 'pass',
          },
          {
            id: 'review-2',
            labId: 'lab-1',
            submissionId: 'submission-1',
            constraintId: 'constraint-2',
            verdict: 'unsure',
            taDecision: 'violation',
          },
          {
            id: 'review-3',
            labId: 'lab-1',
            submissionId: 'submission-2',
            constraintId: 'constraint-1',
            verdict: 'pass',
            taDecision: 'pass',
          },
        ];
  return {
    labs: [
      { id: 'lab-1', classId: 'class-1', deadline: FIXTURE_DEADLINE },
      { id: 'lab-2', classId: 'class-2', deadline: FIXTURE_DEADLINE },
    ],
    memberships: [
      { taId: 'ta-one', classId: 'class-1' },
      { taId: 'ta-other', classId: 'class-2' },
      { taId: 'ta-multi', classId: 'class-1' },
      { taId: 'ta-multi', classId: 'class-2' },
    ],
    queueItems,
    publications:
      scenario === 'published'
        ? [
            {
              labId: 'lab-1',
              publishedBy: 'ta-one',
              publishedAt: FIXTURE_AFTER_DEADLINE,
              summary: {
                queueItemCount: 3,
                passDecisionCount: 2,
                violationDecisionCount: 1,
              },
            },
          ]
        : [],
  };
}
