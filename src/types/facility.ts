import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'employee' | 'admin';
export type UserStatus = 'active' | 'inactive';
export type InviteStatus = 'pending' | 'claimed' | 'revoked';
export type RoomStatus = 'available' | 'unavailable';
export type ReservationStatus = 'confirmed' | 'cancelled';
export type EquipmentType = 'laptop' | 'tablet' | 'camera';
export type EquipmentStatus = 'available' | 'rented' | 'unavailable';
export type LoanApprovalStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'cancelled';
export type LoanDayCalcMode = 'calendar' | 'business';

export type NotificationType =
  | 'room_booked'
  | 'room_cancelled'
  | 'loan_requested'
  | 'loan_approved'
  | 'loan_rejected'
  | 'return_due'
  | 'loan_returned';

export type NavSection =
  | 'dashboard'
  | 'rooms'
  | 'equipment'
  | 'my-bookings'
  | 'notifications'
  | 'admin-facility'
  | 'admin-users';

export interface UserProfile {
  user_id: string;
  name: string;
  login_id: string;
  email: string;
  department: string;
  role: UserRole;
  status: UserStatus;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface InvitedUser {
  invite_id: string;
  email: string;
  name: string;
  login_id: string;
  department: string;
  role: UserRole;
  status: InviteStatus;
  created_by: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface Room {
  room_id: string;
  room_name: string;
  floor: 7 | 10;
  capacity: number;
  amenities: string;
  status: RoomStatus;
  updated_at?: Timestamp;
}

export interface RoomReservation {
  reservation_id: string;
  room_id: string;
  room_name: string;
  floor: 7 | 10;
  user_id: string;
  user_name: string;
  date: string; // YYYY-MM-DD
  start_hour: number; // 9..17
  end_hour: number; // 10..18
  start_at: string; // YYYY-MM-DDTHH:00
  end_at: string; // YYYY-MM-DDTHH:00
  purpose: string;
  status: ReservationStatus;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface RoomSlot {
  slot_id: string; // {room_id}_{YYYY-MM-DD}_{HH}
  room_id: string;
  reservation_id: string;
  user_id: string;
  user_name: string;
  date: string; // YYYY-MM-DD
  hour: number; // 9..17
  status: 'booked';
  created_at?: Timestamp;
}

export interface Equipment {
  equipment_id: string;
  type: EquipmentType;
  management_number: string;
  storage_location: string;
  status: EquipmentStatus;
  current_loan_id: string;
  current_borrower_name: string;
  current_due_at: string;
  updated_at?: Timestamp;
}

export interface EquipmentLoan {
  loan_id: string;
  equipment_id: string;
  equipment_type: EquipmentType;
  management_number: string;
  user_id: string;
  user_name: string;
  start_at: string; // YYYY-MM-DDTHH:MM
  due_at: string; // YYYY-MM-DD
  purpose: string;
  approval_status: LoanApprovalStatus;
  approved_by: string;
  reject_reason: string;
  returned_at: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface AppNotification {
  notification_id: string;
  user_id: string;
  target_scope: 'user' | 'admin';
  title: string;
  message: string;
  type: NotificationType;
  related_id: string;
  is_read: boolean;
  created_at?: Timestamp;
}

export interface ActivityLog {
  log_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_id: string;
  summary: string;
  created_at?: Timestamp;
}

export interface PolicySettings {
  cancel_deadline_minutes: number;
  loan_day_calc_mode: LoanDayCalcMode;
  max_loan_days: number;
  max_room_hours: number;
  booking_horizon_days: number;
  updated_at?: Timestamp;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
