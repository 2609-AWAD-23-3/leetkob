// Grades use a 10-point scale; a constraint deducts at most once per submission (FAQ-11).
export const MAX_SCORE = 10;

// FAQ-05 defaults and the ranges a TA may choose per lab.
export const DEFAULT_LAB_LIMITS = { cpuTimeMs: 1000, memoryMb: 256 } as const;
export const LAB_LIMIT_RANGES = {
  cpuTimeMs: { min: 1000, max: 5000 },
  memoryMb: { min: 64, max: 512 },
} as const;

// FAQ-05 limits a TA cannot change.
export const FIXED_JUDGE_LIMITS = {
  compileCommand: 'g++ -std=c++17 -O2',
  compileTimeMs: 10_000,
  maxCodeBytes: 64 * 1024,
  wallTimeFactor: 3,
  maxProcesses: 16,
  maxOutputBytes: 1024 * 1024,
} as const;

export interface Constraint {
  id: string; // stable inside the lab, for example "c1"
  text: string; // as written by the TA; hard rules classify ban-list vs semantic
  deduction: number; // 0 < deduction <= MAX_SCORE, set by the TA; never by the model
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface LabLimits {
  cpuTimeMs: number;
  memoryMb: number;
}

// The three milestones of a lab (FAQ glossary): opens for submissions at
// opensAt, closes at deadline, then the TA publishes grades.
export interface Lab {
  id: string;
  classId: string;
  title: string;
  statement: string;
  opensAt: string; // canonical UTC ISO timestamp, before deadline
  deadline: string; // canonical UTC ISO timestamp
  limits: LabLimits;
  tests: TestCase[];
  constraints: Constraint[];
  createdBy: string;
  createdAt: string;
}

// opensAt is optional when creating a lab: without it the lab opens at createdAt.
export type NewLab = Omit<Lab, 'id' | 'createdAt' | 'opensAt'> & {
  opensAt?: string;
};

// draft: before opensAt. The TA may still add, remove and edit constraints
// freely (FAQ-07); students neither see the lab nor submit.
// open: opensAt <= now < deadline. Students see statement, constraints and
// deductions (FAQ-06) and submit (FAQ-02).
// closed: now >= deadline. No more submissions (FAQ-03).
export type LabPhase = 'draft' | 'open' | 'closed';

export function labPhase(
  lab: Pick<Lab, 'opensAt' | 'deadline'>,
  now: Date,
): LabPhase {
  const ms = now.getTime();
  if (ms < Date.parse(lab.opensAt)) return 'draft';
  if (ms < Date.parse(lab.deadline)) return 'open';
  return 'closed';
}
