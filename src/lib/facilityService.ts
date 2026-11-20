import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User as FirebaseAuthUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  auth,
  db,
  emailToInviteId,
  getSecondaryAuth,
  handleFirestoreError,
  loginIdToAuthEmail,
} from './firebase';
import {
  DEFAULT_POLICIES,
  addCalendarDays,
  buildSlotId,
  formatHour,
  formatKoreanDate,
  getTodayYMD,
  validateEquipmentLoanPolicy,
  validateReservationCancellation,
  validateRoomBookingPolicy,
} from './policies';
import { INITIAL_EQUIPMENT, INITIAL_ROOMS } from './seedData';
import {
  OperationType,
  type Equipment,
  type EquipmentLoan,
  type InvitedUser,
  type PolicySettings,
  type Room,
  type RoomReservation,
  type UserProfile,
  type UserRole,
} from '../types/facility';

function clampStr(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function createSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function isFirestorePermissionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('permission') || msg.includes('insufficient');
}

/**
 * Resolves the signed-in Firebase Auth user to an authorized UserProfile.
 * - Bootstrapped admin (bhkang1030@gmail.com) is automatically initialized and seeds rooms/equipment/policies.
 * - Existing active users in /users/{uid} are loaded directly.
 * - Pre-invited Google users in /invited_users/{inviteId} atomically claim their profile on first login.
 * - Unregistered or deactivated accounts are denied entry (zero self-signup).
 */
export async function resolveAndBootstrapUser(
  authUser: FirebaseAuthUser,
): Promise<{ status: 'authorized'; profile: UserProfile } | { status: 'inactive' | 'unregistered'; email: string }> {
  const uid = authUser.uid;
  const email = (authUser.email ?? '').trim().toLowerCase();
  const isBootstrapped =
    email === BOOTSTRAPPED_ADMIN_EMAIL && authUser.emailVerified === true;

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const profile = userSnap.data() as UserProfile;
      if (isBootstrapped) {
        await ensureAdminAndInitialFacilitySeed(authUser, profile);
      }
      if (profile.status !== 'active' && !isBootstrapped) {
        return { status: 'inactive', email };
      }
      return { status: 'authorized', profile };
    }

    // Bootstrapped administrator first sign-in
    if (isBootstrapped) {
      const displayName = clampStr(authUser.displayName || '시설 담당자', 60);
      const loginId = clampStr(email.split('@')[0] || 'admin', 80);
      const newAdminProfile: UserProfile = {
        user_id: uid,
        name: displayName,
        login_id: loginId,
        email,
        department: '총무·시설관리팀',
        role: 'admin',
        status: 'active',
      };

      const batch = writeBatch(db);
      batch.set(userRef, {
        ...newAdminProfile,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      batch.set(doc(db, 'admins', uid), {
        user_id: uid,
        granted_by: uid,
        created_at: serverTimestamp(),
      });
      await batch.commit();

      await ensureAdminAndInitialFacilitySeed(authUser, newAdminProfile);
      return { status: 'authorized', profile: newAdminProfile };
    }

    // Check pre-authorized Google employee invitation
    if (email && authUser.emailVerified) {
      const inviteId = emailToInviteId(email);
      const inviteRef = doc(db, 'invited_users', inviteId);
      const inviteSnap = await getDoc(inviteRef);

      if (inviteSnap.exists()) {
        const invite = inviteSnap.data() as InvitedUser;
        if (invite.status === 'pending' && invite.email.toLowerCase() === email) {
          const claimedProfile: UserProfile = {
            user_id: uid,
            name: clampStr(invite.name, 60),
            login_id: clampStr(invite.login_id, 80),
            email,
            department: clampStr(invite.department || '', 60),
            role: invite.role,
            status: 'active',
          };

          const batch = writeBatch(db);
          batch.set(userRef, {
            ...claimedProfile,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
          batch.update(inviteRef, {
            status: 'claimed',
            updated_at: serverTimestamp(),
          });
          if (invite.role === 'admin') {
            batch.set(doc(db, 'admins', uid), {
              user_id: uid,
              granted_by: invite.created_by,
              created_at: serverTimestamp(),
            });
          }
          await batch.commit();

          return { status: 'authorized', profile: claimedProfile };
        }
      }
    }

    return { status: 'unregistered', email };
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
    throw error;
  }
}

async function ensureAdminAndInitialFacilitySeed(
  authUser: FirebaseAuthUser,
  profile: UserProfile,
): Promise<void> {
  try {
    // 1. Ensure /admins/{uid} doc exists
    const adminRef = doc(db, 'admins', authUser.uid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, {
        user_id: authUser.uid,
        granted_by: authUser.uid,
        created_at: serverTimestamp(),
      });
    }

    // 2. Ensure settings/policies exists
    const policyRef = doc(db, 'settings', 'policies');
    const policySnap = await getDoc(policyRef);
    if (!policySnap.exists()) {
      await setDoc(policyRef, {
        ...DEFAULT_POLICIES,
        updated_at: serverTimestamp(),
      });
    }

    // 3. Seed 11 meeting rooms if not yet present
    const firstRoomSnap = await getDoc(doc(db, 'rooms', INITIAL_ROOMS[0].room_id));
    if (!firstRoomSnap.exists()) {
      const batch = writeBatch(db);
      for (const room of INITIAL_ROOMS) {
        batch.set(doc(db, 'rooms', room.room_id), {
          ...room,
          updated_at: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    // 4. Seed 13 shared equipment items if not yet present
    const firstEqSnap = await getDoc(doc(db, 'equipment', INITIAL_EQUIPMENT[0].equipment_id));
    if (!firstEqSnap.exists()) {
      const batch = writeBatch(db);
      for (const item of INITIAL_EQUIPMENT) {
        batch.set(doc(db, 'equipment', item.equipment_id), {
          ...item,
          updated_at: serverTimestamp(),
        });
      }
      const logId = createSafeId('log');
      batch.set(doc(db, 'activity_logs', logId), {
        log_id: logId,
        actor_id: authUser.uid,
        actor_name: clampStr(profile.name, 60),
        action: 'SYSTEM_SEED',
        target_id: 'initial_facilities',
        summary: '초기 회의실 11개 및 공용 비품 13대 데이터 등록 완료',
        created_at: serverTimestamp(),
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'rooms/equipment/settings');
  }
}

/**
 * Atomically reserves a meeting room via Firestore Transaction + deterministic hourly slot locks.
 * Guarantees database-level prevention of concurrent double bookings.
 */
export async function bookMeetingRoom(params: {
  user: UserProfile;
  room: Room;
  date: string;
  startHour: number;
  endHour: number;
  purpose: string;
  policies: PolicySettings;
}): Promise<{ reservationId: string }> {
  const { user, room, date, startHour, endHour, purpose, policies } = params;

  const check = validateRoomBookingPolicy(date, startHour, endHour, policies);
  if (!check.valid) {
    throw new Error(check.reason || '예약 정책을 위반하여 예약할 수 없습니다.');
  }

  const reservationId = createSafeId('res');
  const notifId = createSafeId('ntf');
  const logId = createSafeId('log');
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h += 1) {
    hours.push(h);
  }

  const sanitizedPurpose = clampStr(purpose || '일반 회의', 120);
  const startAt = `${date}T${formatHour(startHour)}`;
  const endAt = `${date}T${formatHour(endHour)}`;

  try {
    await runTransaction(db, async (tx) => {
      // 1. Read room + every required hourly slot lock BEFORE any writes
      const roomRef = doc(db, 'rooms', room.room_id);
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists()) {
        throw new Error('선택한 회의실 정보를 찾을 수 없습니다.');
      }
      const liveRoom = roomSnap.data() as Room;
      if (liveRoom.status !== 'available') {
        throw new Error('현재 이용 불가 상태인 회의실입니다.');
      }

      const slotChecks = await Promise.all(
        hours.map(async (h) => {
          const slotId = buildSlotId(room.room_id, date, h);
          const slotRef = doc(db, 'room_slots', slotId);
          const snap = await tx.get(slotRef);
          return { hour: h, slotId, slotRef, exists: snap.exists() };
        }),
      );

      const conflicting = slotChecks.find((s) => s.exists);
      if (conflicting) {
        throw new Error(
          `${room.room_name}의 ${formatHour(conflicting.hour)}~${formatHour(conflicting.hour + 1)} 시간대는 이미 예약이 확정되었습니다. 다른 시간이나 회의실을 선택해 주세요.`,
        );
      }

      // 2. Atomically create reservation + all hourly lock docs + notification + activity log
      tx.set(doc(db, 'room_reservations', reservationId), {
        reservation_id: reservationId,
        room_id: room.room_id,
        room_name: clampStr(liveRoom.room_name, 60),
        floor: liveRoom.floor,
        user_id: user.user_id,
        user_name: clampStr(user.name, 60),
        date,
        start_hour: startHour,
        end_hour: endHour,
        start_at: startAt,
        end_at: endAt,
        purpose: sanitizedPurpose,
        status: 'confirmed',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      for (const s of slotChecks) {
        tx.set(s.slotRef, {
          slot_id: s.slotId,
          room_id: room.room_id,
          reservation_id: reservationId,
          user_id: user.user_id,
          user_name: clampStr(user.name, 60),
          date,
          hour: s.hour,
          status: 'booked',
          created_at: serverTimestamp(),
        });
      }

      tx.set(doc(db, 'notifications', notifId), {
        notification_id: notifId,
        user_id: user.user_id,
        target_scope: 'user',
        title: '회의실 예약 완료',
        message: clampStr(
          `${liveRoom.room_name} (${liveRoom.floor}층) · ${formatKoreanDate(date)} ${formatHour(startHour)}~${formatHour(endHour)} 예약이 확정되었습니다.`,
          240,
        ),
        type: 'room_booked',
        related_id: reservationId,
        is_read: false,
        created_at: serverTimestamp(),
      });

      tx.set(doc(db, 'activity_logs', logId), {
        log_id: logId,
        actor_id: user.user_id,
        actor_name: clampStr(user.name, 60),
        action: 'ROOM_BOOKED',
        target_id: reservationId,
        summary: clampStr(
          `${liveRoom.room_name}(${liveRoom.floor}층) ${date} ${formatHour(startHour)}-${formatHour(endHour)} 예약`,
          200,
        ),
        created_at: serverTimestamp(),
      });
    });

    return { reservationId };
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `room_reservations/${reservationId}`);
    }
    throw error;
  }
}

/**
 * Atomically cancels a confirmed meeting room reservation and frees all hourly slot locks.
 */
export async function cancelMeetingRoomReservation(params: {
  actor: UserProfile;
  reservation: RoomReservation;
  policies: PolicySettings;
}): Promise<void> {
  const { actor, reservation, policies } = params;
  const isAdmin = actor.role === 'admin';

  const check = validateReservationCancellation(reservation, policies, isAdmin);
  if (!check.valid) {
    throw new Error(check.reason || '예약을 취소할 수 없습니다.');
  }

  const notifId = createSafeId('ntf');
  const logId = createSafeId('log');
  const hours: number[] = [];
  for (let h = reservation.start_hour; h < reservation.end_hour; h += 1) {
    hours.push(h);
  }

  try {
    await runTransaction(db, async (tx) => {
      const resRef = doc(db, 'room_reservations', reservation.reservation_id);
      const resSnap = await tx.get(resRef);
      if (!resSnap.exists()) {
        throw new Error('예약 정보를 찾을 수 없습니다.');
      }
      const liveRes = resSnap.data() as RoomReservation;
      if (liveRes.status !== 'confirmed') {
        throw new Error('이미 취소된 예약입니다.');
      }

      const slotRefs = hours.map((h) =>
        doc(db, 'room_slots', buildSlotId(liveRes.room_id, liveRes.date, h)),
      );
      const slotSnaps = await Promise.all(slotRefs.map((r) => tx.get(r)));

      tx.update(resRef, {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      });

      slotSnaps.forEach((snap, idx) => {
        if (snap.exists()) {
          tx.delete(slotRefs[idx]);
        }
      });

      const isSelf = actor.user_id === liveRes.user_id;
      tx.set(doc(db, 'notifications', notifId), {
        notification_id: notifId,
        user_id: liveRes.user_id,
        target_scope: 'user',
        title: '회의실 예약 취소',
        message: clampStr(
          `${liveRes.room_name} (${liveRes.floor}층) · ${formatKoreanDate(liveRes.date)} ${formatHour(liveRes.start_hour)}~${formatHour(liveRes.end_hour)} 예약이 ${isSelf ? '취소' : '시설 담당자에 의해 취소'}되었습니다.`,
          240,
        ),
        type: 'room_cancelled',
        related_id: liveRes.reservation_id,
        is_read: false,
        created_at: serverTimestamp(),
      });

      tx.set(doc(db, 'activity_logs', logId), {
        log_id: logId,
        actor_id: actor.user_id,
        actor_name: clampStr(actor.name, 60),
        action: 'ROOM_CANCELLED',
        target_id: liveRes.reservation_id,
        summary: clampStr(
          `${liveRes.room_name} ${liveRes.date} ${formatHour(liveRes.start_hour)}-${formatHour(liveRes.end_hour)} 예약 취소`,
          200,
        ),
        created_at: serverTimestamp(),
      });
    });
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `room_reservations/${reservation.reservation_id}`,
      );
    }
    throw error;
  }
}

/**
 * Employee submits an equipment loan application (approval_status: "pending").
 */
export async function requestEquipmentLoan(params: {
  user: UserProfile;
  equipment: Equipment;
  startDate: string;
  startTime: string;
  dueDate: string;
  purpose: string;
  policies: PolicySettings;
}): Promise<{ loanId: string }> {
  const { user, equipment, startDate, startTime, dueDate, purpose, policies } = params;

  const check = validateEquipmentLoanPolicy(startDate, dueDate, policies);
  if (!check.valid) {
    throw new Error(check.reason || '비품 대여 정책을 확인해 주세요.');
  }

  if (equipment.status !== 'available') {
    throw new Error('현재 대여 가능 상태가 아닌 비품입니다.');
  }

  const loanId = createSafeId('loan');
  const userNotifId = createSafeId('ntf');
  const adminNotifId = createSafeId('ntfA');
  const logId = createSafeId('log');
  const startAt = `${startDate}T${startTime || '09:00'}`;

  try {
    const batch = writeBatch(db);

    batch.set(doc(db, 'equipment_loans', loanId), {
      loan_id: loanId,
      equipment_id: equipment.equipment_id,
      equipment_type: equipment.type,
      management_number: clampStr(equipment.management_number, 40),
      user_id: user.user_id,
      user_name: clampStr(user.name, 60),
      start_at: startAt,
      due_at: dueDate,
      purpose: clampStr(purpose || '업무용 대여', 160),
      approval_status: 'pending',
      approved_by: '',
      reject_reason: '',
      returned_at: '',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    batch.set(doc(db, 'notifications', userNotifId), {
      notification_id: userNotifId,
      user_id: user.user_id,
      target_scope: 'user',
      title: '비품 대여 신청 접수',
      message: clampStr(
        `${equipment.management_number} 대여 신청(${startDate} ~ ${dueDate})이 접수되어 시설 담당자 승인 대기 중입니다.`,
        240,
      ),
      type: 'loan_requested',
      related_id: loanId,
      is_read: false,
      created_at: serverTimestamp(),
    });

    batch.set(doc(db, 'notifications', adminNotifId), {
      notification_id: adminNotifId,
      user_id: 'ADMIN_INBOX',
      target_scope: 'admin',
      title: '새 비품 대여 승인 요청',
      message: clampStr(
        `${user.name}님이 ${equipment.management_number} 대여를 신청했습니다. (반납 예정: ${dueDate})`,
        240,
      ),
      type: 'loan_requested',
      related_id: loanId,
      is_read: false,
      created_at: serverTimestamp(),
    });

    batch.set(doc(db, 'activity_logs', logId), {
      log_id: logId,
      actor_id: user.user_id,
      actor_name: clampStr(user.name, 60),
      action: 'LOAN_REQUESTED',
      target_id: loanId,
      summary: clampStr(`${equipment.management_number} 대여 신청 (${startDate}~${dueDate})`, 200),
      created_at: serverTimestamp(),
    });

    await batch.commit();
    return { loanId };
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      handleFirestoreError(error, OperationType.CREATE, `equipment_loans/${loanId}`);
    }
    throw error;
  }
}

/**
 * Employee cancels their own pending equipment loan application.
 */
export async function cancelPendingEquipmentLoan(
  user: UserProfile,
  loan: EquipmentLoan,
): Promise<void> {
  if (loan.approval_status !== 'pending') {
    throw new Error('승인 대기 상태인 신청만 취소할 수 있습니다.');
  }

  const logId = createSafeId('log');
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'equipment_loans', loan.loan_id), {
      approval_status: 'cancelled',
      updated_at: serverTimestamp(),
    });
    batch.set(doc(db, 'activity_logs', logId), {
      log_id: logId,
      actor_id: user.user_id,
      actor_name: clampStr(user.name, 60),
      action: 'LOAN_CANCELLED',
      target_id: loan.loan_id,
      summary: clampStr(`${loan.management_number} 대여 신청 본인 취소`, 200),
      created_at: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      handleFirestoreError(error, OperationType.UPDATE, `equipment_loans/${loan.loan_id}`);
    }
    throw error;
  }
}

/**
 * Facility manager atomically approves a pending loan and locks the equipment as rented.
 */
export async function approveEquipmentLoan(
  admin: UserProfile,
  loan: EquipmentLoan,
): Promise<void> {
  if (admin.role !== 'admin') {
    throw new Error('시설 담당자 권한이 필요합니다.');
  }

  const notifId = createSafeId('ntf');
  const logId = createSafeId('log');

  try {
    await runTransaction(db, async (tx) => {
      const loanRef = doc(db, 'equipment_loans', loan.loan_id);
      const eqRef = doc(db, 'equipment', loan.equipment_id);
      const [loanSnap, eqSnap] = await Promise.all([tx.get(loanRef), tx.get(eqRef)]);

      if (!loanSnap.exists() || !eqSnap.exists()) {
        throw new Error('비품 또는 대여 신청 정보를 찾을 수 없습니다.');
      }

      const liveLoan = loanSnap.data() as EquipmentLoan;
      const liveEq = eqSnap.data() as Equipment;

      if (liveLoan.approval_status !== 'pending') {
        throw new Error('이미 처리된 대여 신청입니다.');
      }
      if (liveEq.status !== 'available') {
        throw new Error(
          `${liveEq.management_number}은(는) 현재 대여 중이거나 이용 불가 상태입니다. 중복 대여를 승인할 수 없습니다.`,
        );
      }

      tx.update(eqRef, {
        status: 'rented',
        current_loan_id: liveLoan.loan_id,
        current_borrower_name: clampStr(liveLoan.user_name, 60),
        current_due_at: liveLoan.due_at,
        updated_at: serverTimestamp(),
      });

      tx.update(loanRef, {
        approval_status: 'approved',
        approved_by: admin.user_id,
        updated_at: serverTimestamp(),
      });

      tx.set(doc(db, 'notifications', notifId), {
        notification_id: notifId,
        user_id: liveLoan.user_id,
        target_scope: 'user',
        title: '비품 대여 승인',
        message: clampStr(
          `${liveLoan.management_number} 대여가 승인되었습니다. 7층 창고에서 수령 후 ${liveLoan.due_at}까지 반납해 주세요.`,
          240,
        ),
        type: 'loan_approved',
        related_id: liveLoan.loan_id,
        is_read: false,
        created_at: serverTimestamp(),
      });

      tx.set(doc(db, 'activity_logs', logId), {
        log_id: logId,
        actor_id: admin.user_id,
        actor_name: clampStr(admin.name, 60),
        action: 'LOAN_APPROVED',
        target_id: liveLoan.loan_id,
        summary: clampStr(
          `${liveLoan.management_number} 대여 승인 (대여자: ${liveLoan.user_name}, 반납예정: ${liveLoan.due_at})`,
          200,
        ),
        created_at: serverTimestamp(),
      });
    });
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      handleFirestoreError(error, OperationType.UPDATE, `equipment_loans/${loan.loan_id}`);
    }
    throw error;
  }
}

/**
 * Facility manager rejects a pending equipment loan request with an optional reason.
 */
export async function rejectEquipmentLoan(
  admin: UserProfile,
  loan: EquipmentLoan,
  reason: string,
): Promise<void> {
  if (admin.role !== 'admin') {
    throw new Error('시설 담당자 권한이 필요합니다.');
  }

  const notifId = createSafeId('ntf');
  const logId = createSafeId('log');
  const cleanReason = clampStr(reason || '시설 운영 일정으로 인해 승인 불가', 160);

  try {
    await runTransaction(db, async (tx) => {
      const loanRef = doc(db, 'equipment_loans', loan.loan_id);
      const loanSnap = await tx.get(loanRef);
      if (!loanSnap.exists()) {
        throw new Error('대여 신청 정보를 찾을 수 없습니다.');
      }
      const liveLoan = loanSnap.data() as EquipmentLoan;
      if (liveLoan.approval_status !== 'pending') {
        throw new Error('이미 처리된 대여 신청입니다.');
      }

      tx.update(loanRef, {
        approval_status: 'rejected',
        approved_by: admin.user_id,
        reject_reason: cleanReason,
        updated_at: serverTimestamp(),
      });

      tx.set(doc(db, 'notifications', notifId), {
        notification_id: notifId,
        user_id: liveLoan.user_id,
        target_scope: 'user',
        title: '비품 대여 거절',
        message: clampStr(
          `${liveLoan.management_number} 대여 신청이 거절되었습니다. 사유: ${cleanReason}`,
          240,
        ),
        type: 'loan_rejected',
        related_id: liveLoan.loan_id,
        is_read: false,
        created_at: serverTimestamp(),
      });

      tx.set(doc(db, 'activity_logs', logId), {
        log_id: logId,
        actor_id: admin.user_id,
        actor_name: clampStr(admin.name, 60),
        action: 'LOAN_REJECTED',
        target_id: liveLoan.loan_id,
        summary: clampStr(`${liveLoan.management_number} 대여 거절 (${liveLoan.user_name})`, 200),
        created_at: serverTimestamp(),
      });
    });
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      handleFirestoreError(error, OperationType.UPDATE, `equipment_loans/${loan.loan_id}`);
    }
    throw error;
  }
}

/**
 * Facility manager marks an active equipment loan as returned and restores availability.
 */
export async function completeEquipmentReturn(
  admin: UserProfile,
  loan: EquipmentLoan,
): Promise<void> {
  if (admin.role !== 'admin') {
    throw new Error('시설 담당자 권한이 필요합니다.');
  }

  const notifId = createSafeId('ntf');
  const logId = createSafeId('log');
  const returnedDate = getTodayYMD();

  try {
    await runTransaction(db, async (tx) => {
      const loanRef = doc(db, 'equipment_loans', loan.loan_id);
      const eqRef = doc(db, 'equipment', loan.equipment_id);
      const [loanSnap, eqSnap] = await Promise.all([tx.get(loanRef), tx.get(eqRef)]);

      if (!loanSnap.exists() || !eqSnap.exists()) {
        throw new Error('비품 또는 대여 정보를 찾을 수 없습니다.');
      }

      const liveLoan = loanSnap.data() as EquipmentLoan;
      if (liveLoan.approval_status !== 'approved') {
        throw new Error('대여 중 상태인 항목만 반납 완료 처리할 수 있습니다.');
      }

      tx.update(loanRef, {
        approval_status: 'returned',
        returned_at: returnedDate,
        updated_at: serverTimestamp(),
      });

      tx.update(eqRef, {
        status: 'available',
        current_loan_id: '',
        current_borrower_name: '',
        current_due_at: '',
        updated_at: serverTimestamp(),
      });

      tx.set(doc(db, 'notifications', notifId), {
        notification_id: notifId,
        user_id: liveLoan.user_id,
        target_scope: 'user',
        title: '비품 반납 완료',
        message: clampStr(
          `${liveLoan.management_number}의 반납 처리가 완료되었습니다. (${returnedDate}) 이용해 주셔서 감사합니다.`,
          240,
        ),
        type: 'loan_returned',
        related_id: liveLoan.loan_id,
        is_read: false,
        created_at: serverTimestamp(),
      });

      tx.set(doc(db, 'activity_logs', logId), {
        log_id: logId,
        actor_id: admin.user_id,
        actor_name: clampStr(admin.name, 60),
        action: 'LOAN_RETURNED',
        target_id: liveLoan.loan_id,
        summary: clampStr(`${liveLoan.management_number} 반납 완료 처리 (${liveLoan.user_name})`, 200),
        created_at: serverTimestamp(),
      });
    });
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      handleFirestoreError(error, OperationType.UPDATE, `equipment_loans/${loan.loan_id}`);
    }
    throw error;
  }
}

/**
 * Generates deduplicated in-app return-due reminders for approved loans due today, tomorrow, or overdue.
 */
export async function ensureReturnDueReminders(
  user: UserProfile,
  userLoans: EquipmentLoan[],
): Promise<void> {
  const today = getTodayYMD();
  const tomorrow = addCalendarDays(today, 1);

  const dueSoon = userLoans.filter(
    (loan) => loan.approval_status === 'approved' && loan.due_at <= tomorrow,
  );

  for (const loan of dueSoon) {
    const notifId = `due_${loan.loan_id}_${today}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    const notifRef = doc(db, 'notifications', notifId);
    try {
      const snap = await getDoc(notifRef);
      if (!snap.exists()) {
        const isOverdue = loan.due_at < today;
        const isToday = loan.due_at === today;
        const title = isOverdue ? '비품 반납 기한 경과 알림' : '비품 반납 예정 알림';
        const message = isOverdue
          ? `${loan.management_number}의 반납 예정일(${loan.due_at})이 지났습니다. 즉시 7층 창고로 반납해 주세요.`
          : isToday
            ? `${loan.management_number}의 반납 예정일은 오늘(${loan.due_at})입니다. 업무 종료 전 반납해 주세요.`
            : `${loan.management_number}의 반납 예정일은 내일(${loan.due_at})입니다.`;

        await setDoc(notifRef, {
          notification_id: notifId,
          user_id: user.user_id,
          target_scope: 'user',
          title,
          message: clampStr(message, 240),
          type: 'return_due',
          related_id: loan.loan_id,
          is_read: false,
          created_at: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal background reminder
    }
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      is_read: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsAsRead(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of notificationIds) {
      batch.update(doc(db, 'notifications', id), { is_read: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

export async function updatePolicySettings(
  admin: UserProfile,
  next: Omit<PolicySettings, 'updated_at'>,
): Promise<void> {
  if (admin.role !== 'admin') {
    throw new Error('시설 담당자 권한이 필요합니다.');
  }
  const logId = createSafeId('log');
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'settings', 'policies'), {
      cancel_deadline_minutes: Math.max(0, Math.min(1440, Math.round(next.cancel_deadline_minutes))),
      loan_day_calc_mode: next.loan_day_calc_mode,
      max_loan_days: Math.max(1, Math.min(30, Math.round(next.max_loan_days))),
      max_room_hours: Math.max(1, Math.min(9, Math.round(next.max_room_hours))),
      booking_horizon_days: Math.max(1, Math.min(90, Math.round(next.booking_horizon_days))),
      updated_at: serverTimestamp(),
    });
    batch.set(doc(db, 'activity_logs', logId), {
      log_id: logId,
      actor_id: admin.user_id,
      actor_name: clampStr(admin.name, 60),
      action: 'POLICY_UPDATED',
      target_id: 'policies',
      summary: clampStr(
        `운영 정책 변경: 취소 시한 ${next.cancel_deadline_minutes}분 전, 비품 3일 기준 ${next.loan_day_calc_mode === 'business' ? '영업일' : '달력일'}`,
        200,
      ),
      created_at: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/policies');
  }
}

export async function toggleRoomAvailability(
  admin: UserProfile,
  room: Room,
): Promise<void> {
  if (admin.role !== 'admin') throw new Error('시설 담당자 권한이 필요합니다.');
  const nextStatus = room.status === 'available' ? 'unavailable' : 'available';
  const logId = createSafeId('log');
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'rooms', room.room_id), {
      status: nextStatus,
      updated_at: serverTimestamp(),
    });
    batch.set(doc(db, 'activity_logs', logId), {
      log_id: logId,
      actor_id: admin.user_id,
      actor_name: clampStr(admin.name, 60),
      action: 'ROOM_STATUS_CHANGED',
      target_id: room.room_id,
      summary: clampStr(`${room.room_name} 상태 변경: ${nextStatus === 'available' ? '이용 가능' : '이용 불가'}`, 200),
      created_at: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${room.room_id}`);
  }
}

export async function toggleEquipmentAvailability(
  admin: UserProfile,
  item: Equipment,
): Promise<void> {
  if (admin.role !== 'admin') throw new Error('시설 담당자 권한이 필요합니다.');
  if (item.status === 'rented') {
    throw new Error('현재 대여 중인 비품은 반납 완료 후 상태를 변경할 수 있습니다.');
  }
  const nextStatus = item.status === 'available' ? 'unavailable' : 'available';
  const logId = createSafeId('log');
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'equipment', item.equipment_id), {
      status: nextStatus,
      updated_at: serverTimestamp(),
    });
    batch.set(doc(db, 'activity_logs', logId), {
      log_id: logId,
      actor_id: admin.user_id,
      actor_name: clampStr(admin.name, 60),
      action: 'EQUIPMENT_STATUS_CHANGED',
      target_id: item.equipment_id,
      summary: clampStr(`${item.management_number} 상태 변경: ${nextStatus === 'available' ? '이용 가능' : '이용 불가'}`, 200),
      created_at: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `equipment/${item.equipment_id}`);
  }
}

/**
 * Facility manager issues a new ID + initial password employee account using secondary Firebase Auth.
 * Password is handled exclusively by Firebase Auth and NEVER stored in Firestore.
 */
export async function issuePasswordEmployeeAccount(
  admin: UserProfile,
  payload: {
    name: string;
    loginId: string;
    initialPassword: string;
    department: string;
    role: UserRole;
  },
): Promise<void> {
  if (admin.role !== 'admin') {
    throw new Error('시설 담당자 권한이 필요합니다.');
  }

  const cleanName = clampStr(payload.name, 60);
  const cleanLoginId = clampStr(payload.loginId, 80);
  const cleanDept = clampStr(payload.department || '일반부서', 60);

  if (!cleanName || cleanLoginId.length < 2) {
    throw new Error('직원 이름과 로그인 아이디(2자 이상)를 입력해 주세요.');
  }
  if (!/^[a-zA-Z0-9._@-]+$/.test(cleanLoginId)) {
    throw new Error('아이디는 영문, 숫자, 마침표(.), 밑줄(_), 하이픈(-), @만 사용할 수 있습니다.');
  }
  if (payload.initialPassword.length < 6) {
    throw new Error('초기 비밀번호는 안전을 위해 6자 이상으로 설정해 주세요.');
  }

  const authEmail = loginIdToAuthEmail(cleanLoginId);
  const secondaryAuth = getSecondaryAuth();
  const credential = await createUserWithEmailAndPassword(
    secondaryAuth,
    authEmail,
    payload.initialPassword,
  );
  const newUid = credential.user.uid;
  await signOut(secondaryAuth);

  const logId = createSafeId('log');
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', newUid), {
      user_id: newUid,
      name: cleanName,
      login_id: cleanLoginId,
      email: authEmail,
      department: cleanDept,
      role: payload.role,
      status: 'active',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    if (payload.role === 'admin') {
      batch.set(doc(db, 'admins', newUid), {
        user_id: newUid,
        granted_by: admin.user_id,
        created_at: serverTimestamp(),
      });
    }
    batch.set(doc(db, 'activity_logs', logId), {
      log_id: logId,
      actor_id: admin.user_id,
      actor_name: clampStr(admin.name, 60),
      action: 'USER_ISSUED',
      target_id: newUid,
      summary: clampStr(
        `직원 계정 신규 발급: ${cleanName} (${cleanLoginId}, ${payload.role === 'admin' ? '시설 담당자' : '일반 직원'})`,
        200,
      ),
      created_at: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${newUid}`);
  }
}

/**
 * Facility manager pre-authorizes an employee's Google email so they can log in via Google without self-signup.
 */
export async function issueGoogleInvitedAccount(
  admin: UserProfile,
  payload: {
    name: string;
    loginId: string;
    email: string;
    department: string;
    role: UserRole;
  },
): Promise<void> {
  if (admin.role !== 'admin') {
    throw new Error('시설 담당자 권한이 필요합니다.');
  }

  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanName = clampStr(payload.name, 60);
  const cleanLoginId = clampStr(payload.loginId || cleanEmail.split('@')[0], 80);
  const cleanDept = clampStr(payload.department || '일반부서', 60);

  if (!cleanEmail.includes('@') || !cleanName) {
    throw new Error('직원 이름과 올바른 Google 이메일 주소를 입력해 주세요.');
  }
  if (!/^[a-zA-Z0-9._@-]+$/.test(cleanLoginId)) {
    throw new Error('아이디는 영문, 숫자, 마침표(.), 밑줄(_), 하이픈(-), @만 사용할 수 있습니다.');
  }

  const inviteId = emailToInviteId(cleanEmail);
  const logId = createSafeId('log');

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'invited_users', inviteId), {
      invite_id: inviteId,
      email: cleanEmail,
      name: cleanName,
      login_id: cleanLoginId,
      department: cleanDept,
      role: payload.role,
      status: 'pending',
      created_by: admin.user_id,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    batch.set(doc(db, 'activity_logs', logId), {
      log_id: logId,
      actor_id: admin.user_id,
      actor_name: clampStr(admin.name, 60),
      action: 'USER_INVITED',
      target_id: inviteId,
      summary: clampStr(`Google 계정 사전 발급 등록: ${cleanName} (${cleanEmail})`, 200),
      created_at: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `invited_users/${inviteId}`);
  }
}

export async function updateEmployeeAccount(
  admin: UserProfile,
  target: UserProfile,
  updates: { status?: 'active' | 'inactive'; role?: UserRole; name?: string; department?: string },
): Promise<void> {
  if (admin.role !== 'admin') {
    throw new Error('시설 담당자 권한이 필요합니다.');
  }
  if (target.user_id === admin.user_id && updates.status === 'inactive') {
    throw new Error('현재 로그인한 본인 계정은 비활성화할 수 없습니다.');
  }
  if (target.user_id === admin.user_id && updates.role === 'employee') {
    throw new Error('현재 로그인한 본인 계정의 시설 담당자 권한은 해제할 수 없습니다.');
  }

  const nextRole = updates.role ?? target.role;
  const nextStatus = updates.status ?? target.status;
  const logId = createSafeId('log');

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', target.user_id), {
      name: clampStr(updates.name ?? target.name, 60),
      department: clampStr(updates.department ?? target.department, 60),
      role: nextRole,
      status: nextStatus,
      updated_at: serverTimestamp(),
    });

    if (nextRole === 'admin' && nextStatus === 'active') {
      batch.set(doc(db, 'admins', target.user_id), {
        user_id: target.user_id,
        granted_by: admin.user_id,
        created_at: serverTimestamp(),
      });
    } else if (target.user_id !== admin.user_id) {
      batch.delete(doc(db, 'admins', target.user_id));
    }

    batch.set(doc(db, 'activity_logs', logId), {
      log_id: logId,
      actor_id: admin.user_id,
      actor_name: clampStr(admin.name, 60),
      action: 'USER_UPDATED',
      target_id: target.user_id,
      summary: clampStr(
        `계정 변경: ${target.name} (${nextRole === 'admin' ? '시설 담당자' : '일반 직원'} / ${nextStatus === 'active' ? '활성' : '비활성'})`,
        200,
      ),
      created_at: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${target.user_id}`);
  }
}

export async function deleteInvitedUser(admin: UserProfile, inviteId: string): Promise<void> {
  if (admin.role !== 'admin') throw new Error('시설 담당자 권한이 필요합니다.');
  try {
    await deleteDoc(doc(db, 'invited_users', inviteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `invited_users/${inviteId}`);
  }
}

export async function triggerPasswordResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}
