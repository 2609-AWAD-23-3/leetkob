export type Role = 'admin' | 'TA' | 'student';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}

export interface ClassRoom {
  id: string;
  name: string;
}

// A TA may belong to many classes; a student may study in many classes (FAQ-01).
export interface ClassMembership {
  classId: string;
  userId: string;
  role: 'TA' | 'student';
}
