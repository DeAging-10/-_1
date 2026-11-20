/**
 * Phase 0 Security TDD Specification — Dirty Dozen Verification Matrix
 * Verifies all 12 adversarial payloads against firestore.rules constraints.
 * Run with Firebase Emulator Suite (`@firebase/rules-unit-testing`) when testing locally.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  actor: {
    uid: string;
    email: string;
    email_verified: boolean;
    role: 'anonymous' | 'employee' | 'admin';
  };
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Role Self-Escalation on User Create',
    actor: { uid: 'emp1', email: 'emp1@company.com', email_verified: true, role: 'employee' },
    operation: 'create',
    path: 'users/emp1',
    payload: {
      user_id: 'emp1',
      name: 'Mallory',
      login_id: 'mallory',
      email: 'emp1@company.com',
      department: 'IT',
      role: 'admin',
      status: 'active',
    },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'users create requires isAdmin() or matching pending invited_users with identical role',
  },
  {
    id: 2,
    name: 'Role Escalation on User Update',
    actor: { uid: 'emp1', email: 'emp1@company.com', email_verified: true, role: 'employee' },
    operation: 'update',
    path: 'users/emp1',
    payload: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'users update strictly restricted to isAdmin()',
  },
  {
    id: 3,
    name: 'Email Spoofing with Unverified Admin Email',
    actor: { uid: 'spoof1', email: 'bhkang1030@gmail.com', email_verified: false, role: 'employee' },
    operation: 'create',
    path: 'rooms/room-99',
    payload: { room_id: 'room-99', room_name: 'Fake Room', floor: 7, capacity: 8, status: 'available' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isBootstrappedAdmin() mandates request.auth.token.email_verified == true',
  },
  {
    id: 4,
    name: 'PII Blanket Read on Another User',
    actor: { uid: 'emp1', email: 'emp1@company.com', email_verified: true, role: 'employee' },
    operation: 'get',
    path: 'users/emp2',
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'users get requires request.auth.uid == userId || isAdmin()',
  },
  {
    id: 5,
    name: 'Shadow Field Injection on Reservation',
    actor: { uid: 'emp1', email: 'emp1@company.com', email_verified: true, role: 'employee' },
    operation: 'create',
    path: 'room_reservations/res_shadow',
    payload: {
      reservation_id: 'res_shadow',
      room_id: 'room-01',
      room_name: '회의실 1',
      floor: 7,
      user_id: 'emp1',
      user_name: '김민수',
      date: '2026-11-23',
      start_hour: 9,
      end_hour: 10,
      start_at: '2026-11-23T09:00',
      end_at: '2026-11-23T10:00',
      purpose: '주간 회의',
      status: 'confirmed',
      isVerified: true,
    },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidRoomReservation() enforces data.keys().hasOnly(...)',
  },
  {
    id: 6,
    name: 'Identity Spoofing on Room Reservation',
    actor: { uid: 'emp1', email: 'emp1@company.com', email_verified: true, role: 'employee' },
    operation: 'create',
    path: 'room_reservations/res_spoof',
    payload: { user_id: 'emp2', status: 'confirmed' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'room_reservations create mandates incoming().user_id == request.auth.uid',
  },
  {
    id: 7,
    name: '5-Hour Booking Exceeding 4-Hour Max Policy',
    actor: { uid: 'emp1', email: 'emp1@company.com', email_verified: true, role: 'employee' },
    operation: 'create',
    path: 'room_reservations/res_5hr',
    payload: { start_hour: 9, end_hour: 14, status: 'confirmed' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidRoomReservation() enforces (end_hour - start_hour) <= 4',
  },
  {
    id: 8,
    name: 'Double-Booking Overwrite on Room Slot Lock',
    actor: { uid: 'emp2', email: 'emp2@company.com', email_verified: true, role: 'employee' },
    operation: 'update',
    path: 'room_slots/room-01_2026-11-23_09',
    payload: { user_id: 'emp2', reservation_id: 'res_hijack' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'room_slots forbids update (allow update: if false)',
  },
  {
    id: 9,
    name: 'Employee Self-Approving Equipment Loan',
    actor: { uid: 'emp1', email: 'emp1@company.com', email_verified: true, role: 'employee' },
    operation: 'update',
    path: 'equipment_loans/loan1',
    payload: { approval_status: 'approved', approved_by: 'emp1' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'equipment_loans approve branch requires isAdmin()',
  },
  {
    id: 10,
    name: 'Terminal State Mutation on Cancelled Reservation',
    actor: { uid: 'emp1', email: 'emp1@company.com', email_verified: true, role: 'employee' },
    operation: 'update',
    path: 'room_reservations/res_cancelled',
    payload: { status: 'confirmed' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'room_reservations update enforces existing().status == "confirmed" && incoming().status == "cancelled"',
  },
  {
    id: 11,
    name: 'Resource Poisoning with Invalid Document ID / Oversized Purpose',
    actor: { uid: 'emp1', email: 'emp1@company.com', email_verified: true, role: 'employee' },
    operation: 'create',
    path: 'room_reservations/bad$id!with*symbols',
    payload: { purpose: 'A'.repeat(500) },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId() regex + purpose.size() <= 120',
  },
  {
    id: 12,
    name: 'Audit Log Tampering & Client Timestamp Forgery',
    actor: { uid: 'admin1', email: 'bhkang1030@gmail.com', email_verified: true, role: 'admin' },
    operation: 'delete',
    path: 'activity_logs/log1',
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'activity_logs enforces allow update, delete: if false and created_at == request.time',
  },
];
