import type { Lab, NewLab } from '../shared/domain/index.js';

// Used by PA03-T04 (create and read labs) and PA03-T09.
export interface LabStore {
  // Throws TypeError for invalid input: unknown class or creator, bad limits
  // or deductions, opensAt not before deadline, or any field beyond the
  // documented ones. Without opensAt the lab opens at createdAt.
  createLab(input: NewLab): Promise<Lab>;
  getLab(labId: string): Promise<Lab | undefined>;
  // Labs of the classes the user belongs to, in every phase. The API hides
  // 'draft' labs from students with labPhase (src/shared/domain/labs.ts).
  listLabsForUser(userId: string): Promise<Lab[]>;
}
