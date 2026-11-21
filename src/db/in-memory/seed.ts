import { DEFAULT_LAB_LIMITS } from '../../shared/domain/index.js';
import { FIXTURE_DEADLINE } from '../fixtures.js';
import type { StoreSeed } from './state.js';

export const STORE_FIXTURE_CREATED_AT = '2026-11-01T00:00:00.000Z';
export const STORE_FIXTURE_OPENS_AT = '2026-11-02T00:00:00.000Z';

// Test fixture with fictional accounts: one admin, two classes with one TA
// each, two students in the first class and one lab with two constraints.
// Password hashes are placeholders, not real credentials. The PA3.md demo
// accounts belong to PA03-T04. Every call returns a fresh object graph.
export function createStoreSeed(): StoreSeed {
  return {
    users: [
      {
        id: 'admin-1',
        username: 'admin',
        displayName: 'Admin',
        role: 'admin',
        passwordHash: 'test-hash-admin',
      },
      {
        id: 'ta-1',
        username: 'ta1',
        displayName: 'TA One',
        role: 'TA',
        passwordHash: 'test-hash-ta1',
      },
      {
        id: 'ta-2',
        username: 'ta2',
        displayName: 'TA Two',
        role: 'TA',
        passwordHash: 'test-hash-ta2',
      },
      {
        id: 'student-1',
        username: 'student1',
        displayName: 'Student One',
        role: 'student',
        passwordHash: 'test-hash-student1',
      },
      {
        id: 'student-2',
        username: 'student2',
        displayName: 'Student Two',
        role: 'student',
        passwordHash: 'test-hash-student2',
      },
    ],
    classes: [
      { id: 'class-1', name: 'Class 1' },
      { id: 'class-2', name: 'Class 2' },
    ],
    memberships: [
      { userId: 'ta-1', classId: 'class-1', role: 'TA' },
      { userId: 'ta-2', classId: 'class-2', role: 'TA' },
      { userId: 'student-1', classId: 'class-1', role: 'student' },
      { userId: 'student-2', classId: 'class-1', role: 'student' },
    ],
    labs: [
      {
        id: 'lab-sort',
        classId: 'class-1',
        title: 'Sort an array',
        statement: 'Read n integers and print them in ascending order.',
        opensAt: STORE_FIXTURE_OPENS_AT,
        deadline: FIXTURE_DEADLINE,
        limits: { ...DEFAULT_LAB_LIMITS },
        tests: [
          { id: 't1', input: '3\n3 1 2\n', expectedOutput: '1 2 3\n' },
          { id: 't2', input: '1\n5\n', expectedOutput: '5\n' },
        ],
        constraints: [
          { id: 'c1', text: 'Do not use `std::sort`.', deduction: 3 },
          { id: 'c2', text: 'Implement merge sort yourself.', deduction: 4 },
        ],
        createdBy: 'ta-1',
        createdAt: STORE_FIXTURE_CREATED_AT,
      },
    ],
  };
}
