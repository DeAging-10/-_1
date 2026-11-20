import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  History,
  PackageCheck,
  Settings,
  X,
  XCircle,
} from 'lucide-react';
import {
  approveEquipmentLoan,
  cancelMeetingRoomReservation,
  completeEquipmentReturn,
  rejectEquipmentLoan,
  toggleEquipmentAvailability,
  toggleRoomAvailability,
  updatePolicySettings,
} from '../lib/facilityService';
import {
  formatHour,
  formatKoreanDate,
  getEquipmentTypeLabel,
  getTodayYMD,
} from '../lib/policies';
import type {
  ActivityLog,
  Equipment,
  EquipmentLoan,
  LoanDayCalcMode,
  PolicySettings,
  Room,
  RoomReservation,
  UserProfile,
} from '../types/facility';
import { StatusIndicator } from './StatusIndicator';

interface AdminFacilityViewProps {
  admin: UserProfile;
  rooms: Room[];
  equipment: Equipment[];
  allReservations: RoomReservation[];
  allLoans: EquipmentLoan[];
  activityLogs: ActivityLog[];
  policies: PolicySettings;
  onActionSuccess: (message: string) => void;
}

export function AdminFacilityView({
  admin,
  rooms,
  equipment,
  allReservations,
  allLoans,
  activityLogs,
  policies,
  onActionSuccess,
}: AdminFacilityViewProps) {
  const [subTab, setSubTab] = useState<'pending' | 'rented' | 'rooms' | 'policies'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<EquipmentLoan | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Room reservation filter
  const [resDateFilter, setResDateFilter] = useState('');
  const [resFloorFilter, setResFloorFilter] = useState<'all' | 7 | 10>('all');

  // Editable Policy Settings state
  const [cancelDeadline, setCancelDeadline] = useState(policies.cancel_deadline_minutes);
  const [loanDayMode, setLoanDayMode] = useState<LoanDayCalcMode>(policies.loan_day_calc_mode);
  const [maxLoanDays, setMaxLoanDays] = useState(policies.max_loan_days);
  const [savingPolicies, setSavingPolicies] = useState(false);

  React.useEffect(() => {
    setCancelDeadline(policies.cancel_deadline_minutes);
    setLoanDayMode(policies.loan_day_calc_mode);
    setMaxLoanDays(policies.max_loan_days);
  }, [policies]);

  const today = getTodayYMD();

  const pendingLoans = useMemo(
    () =>
      allLoans
        .filter((l) => l.approval_status === 'pending')
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [allLoans],
  );

  const activeLoans = useMemo(
    () =>
      allLoans
        .filter((l) => l.approval_status === 'approved')
        .sort((a, b) => a.due_at.localeCompare(b.due_at)),
    [allLoans],
  );

  const completedLoans = useMemo(
    () =>
      allLoans
        .filter((l) => ['returned', 'rejected', 'cancelled'].includes(l.approval_status))
        .sort((a, b) => b.start_at.localeCompare(a.start_at))
        .slice(0, 20),
    [allLoans],
  );

  const filteredReservations = useMemo(() => {
    return allReservations
      .filter((r) => (resDateFilter ? r.date === resDateFilter : true))
      .filter((r) => (resFloorFilter === 'all' ? true : r.floor === resFloorFilter))
      .sort((a, b) => b.start_at.localeCompare(a.start_at));
  }, [allReservations, resDateFilter, resFloorFilter]);

  const sortedLogs = useMemo(() => {
    return [...activityLogs]
      .sort((a, b) => (b.created_at?.toMillis?.() ?? 0) - (a.created_at?.toMillis?.() ?? 0))
      .slice(0, 40);
  }, [activityLogs]);

  const handleApprove = async (loan: EquipmentLoan) => {
    setErrorMsg(null);
    setBusyId(loan.loan_id);
    try {
      await approveEquipmentLoan(admin, loan);
      onActionSuccess(`${loan.management_number} 대여를 승인했습니다. (${loan.user_name})`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '승인 처리 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setErrorMsg(null);
    setBusyId(rejectTarget.loan_id);
    try {
      await rejectEquipmentLoan(admin, rejectTarget, rejectReason);
      onActionSuccess(`${rejectTarget.management_number} 대여 신청을 거절했습니다.`);
      setRejectTarget(null);
      setRejectReason('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '거절 처리 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReturn = async (loan: EquipmentLoan) => {
    setErrorMsg(null);
    setBusyId(loan.loan_id);
    try {
      await completeEquipmentReturn(admin, loan);
      onActionSuccess(`${loan.management_number} 반납 완료 처리가 끝났습니다.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '반납 처리 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdminCancelRoom = async (res: RoomReservation) => {
    setErrorMsg(null);
    setBusyId(res.reservation_id);
    try {
      await cancelMeetingRoomReservation({ actor: admin, reservation: res, policies });
      onActionSuccess(`${res.room_name} (${res.user_name}) 예약을 취소했습니다.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '예약 취소 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavingPolicies(true);
    try {
      await updatePolicySettings(admin, {
        cancel_deadline_minutes: cancelDeadline,
        loan_day_calc_mode: loanDayMode,
        max_loan_days: maxLoanDays,
        max_room_hours: policies.max_room_hours,
        booking_horizon_days: policies.booking_horizon_days,
      });
      onActionSuccess('시설 운영 정책이 저장되었습니다.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '정책 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingPolicies(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Sub-tabs */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">시설 담당자 통합 관리</h2>
          <p className="text-sm text-slate-600 mt-1">
            비품 대여 승인·거절, 반납 완료 처리, 전체 회의실 예약 현황 및 운영 정책을 관리합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { key: 'pending', label: `비품 승인 대기 (${pendingLoans.length})`, icon: ClipboardList },
              { key: 'rented', label: `대여 중·반납 관리 (${activeLoans.length})`, icon: PackageCheck },
              { key: 'rooms', label: `전체 회의실 예약 (${allReservations.length})`, icon: DoorOpen },
              { key: 'policies', label: '운영 정책·시설 상태·로그', icon: Settings },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSubTab(t.key)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  subTab === t.key
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {/* Subtab 1: Pending Equipment Loan Approvals */}
      {subTab === 'pending' && (
        <section className="space-y-3">
          {pendingLoans.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 text-[15px]">
              현재 승인 대기 중인 비품 대여 신청이 없습니다.
            </div>
          ) : (
            pendingLoans.map((loan) => (
              <article
                key={loan.loan_id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900 font-mono">
                      {loan.management_number}
                    </h3>
                    <span className="text-sm text-slate-500">
                      {getEquipmentTypeLabel(loan.equipment_type)}
                    </span>
                    <StatusIndicator state="pending" />
                  </div>
                  <div className="text-sm text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      신청자: <strong className="font-semibold text-slate-900">{loan.user_name}</strong>
                    </span>
                    <span className="font-mono tabular-nums">
                      대여 시작: {loan.start_at.replace('T', ' ')}
                    </span>
                    <span className="font-mono tabular-nums">
                      반납 예정일: <strong>{loan.due_at}</strong>
                    </span>
                  </div>
                  {loan.purpose && (
                    <p className="text-sm text-slate-500">사용 목적: {loan.purpose}</p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === loan.loan_id}
                    onClick={() => handleApprove(loan)}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {busyId === loan.loan_id ? '처리 중...' : '승인'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === loan.loan_id}
                    onClick={() => {
                      setRejectTarget(loan);
                      setRejectReason('');
                    }}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    거절
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {/* Subtab 2: Currently Rented Equipment & Return Completion */}
      {subTab === 'rented' && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              현재 대여 중인 비품 ({activeLoans.length}대)
            </h3>
            {activeLoans.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 text-[15px]">
                현재 대여 중인 공용 비품이 없습니다.
              </div>
            ) : (
              activeLoans.map((loan) => {
                const isOverdue = loan.due_at < today;
                return (
                  <article
                    key={loan.loan_id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="text-lg font-bold text-slate-900 font-mono">
                          {loan.management_number}
                        </h4>
                        <StatusIndicator state="rented" />
                        {isOverdue && (
                          <StatusIndicator state="unavailable" customLabel="반납 기한 경과" />
                        )}
                      </div>
                      <div className="text-sm text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          대여자: <strong className="font-semibold">{loan.user_name}</strong>
                        </span>
                        <span className="font-mono tabular-nums">
                          대여일: {loan.start_at.slice(0, 10)}
                        </span>
                        <span
                          className={`font-mono tabular-nums font-semibold ${
                            isOverdue ? 'text-red-700' : 'text-slate-900'
                          }`}
                        >
                          반납 예정일: {loan.due_at}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busyId === loan.loan_id}
                      onClick={() => handleReturn(loan)}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <PackageCheck className="w-4 h-4" />
                      {busyId === loan.loan_id ? '처리 중...' : '반납 완료 처리'}
                    </button>
                  </article>
                );
              })
            )}
          </section>

          {completedLoans.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-bold text-slate-900 mb-4">최근 처리 완료 이력</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-4 font-semibold">관리번호</th>
                      <th className="py-2.5 pr-4 font-semibold">대여자</th>
                      <th className="py-2.5 pr-4 font-semibold">대여 기간</th>
                      <th className="py-2.5 pr-4 font-semibold">상태</th>
                      <th className="py-2.5 font-semibold">반납일 / 비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedLoans.map((loan) => (
                      <tr key={loan.loan_id}>
                        <td className="py-3 pr-4 font-mono font-semibold text-slate-900">
                          {loan.management_number}
                        </td>
                        <td className="py-3 pr-4 text-slate-700">{loan.user_name}</td>
                        <td className="py-3 pr-4 font-mono tabular-nums text-slate-600">
                          {loan.start_at.slice(0, 10)} ~ {loan.due_at}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusIndicator
                            state={
                              loan.approval_status === 'returned'
                                ? 'returned'
                                : loan.approval_status === 'rejected'
                                  ? 'rejected'
                                  : 'cancelled'
                            }
                          />
                        </td>
                        <td className="py-3 text-slate-600 font-mono tabular-nums">
                          {loan.returned_at || loan.reject_reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Subtab 3: All Meeting Room Reservations */}
      {subTab === 'rooms' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">전체 회의실 예약 현황</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={resDateFilter}
                onChange={(e) => setResDateFilter(e.target.value)}
                aria-label="날짜 필터"
                className="min-h-[40px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
              />
              {resDateFilter && (
                <button
                  type="button"
                  onClick={() => setResDateFilter('')}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg cursor-pointer"
                >
                  전체 날짜
                </button>
              )}
              <select
                value={String(resFloorFilter)}
                onChange={(e) =>
                  setResFloorFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 7 | 10))
                }
                aria-label="층 필터"
                className="min-h-[40px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              >
                <option value="all">전체 층</option>
                <option value="7">7층</option>
                <option value="10">10층</option>
              </select>
            </div>
          </div>

          {filteredReservations.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-sm">
              조회된 회의실 예약 내역이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4 font-semibold">회의실</th>
                    <th className="py-2.5 pr-4 font-semibold">날짜 및 시간</th>
                    <th className="py-2.5 pr-4 font-semibold">예약자</th>
                    <th className="py-2.5 pr-4 font-semibold">회의 목적</th>
                    <th className="py-2.5 pr-4 font-semibold">상태</th>
                    <th className="py-2.5 font-semibold text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReservations.map((res) => (
                    <tr key={res.reservation_id}>
                      <td className="py-3 pr-4 font-semibold text-slate-900 whitespace-nowrap">
                        {res.room_name} ({res.floor}층)
                      </td>
                      <td className="py-3 pr-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatKoreanDate(res.date)} {formatHour(res.start_hour)}~{formatHour(res.end_hour)}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 whitespace-nowrap">{res.user_name}</td>
                      <td className="py-3 pr-4 text-slate-600 max-w-[200px] truncate">
                        {res.purpose || '-'}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusIndicator
                          state={res.status === 'confirmed' ? 'booked' : 'cancelled'}
                          customLabel={res.status === 'confirmed' ? '예약 확정' : '취소됨'}
                        />
                      </td>
                      <td className="py-3 text-right">
                        {res.status === 'confirmed' && (
                          <button
                            type="button"
                            disabled={busyId === res.reservation_id}
                            onClick={() => handleAdminCancelRoom(res)}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-md whitespace-nowrap cursor-pointer"
                          >
                            {busyId === res.reservation_id ? '처리 중...' : '관리자 취소'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Subtab 4: Configurable Policies, Room/Equipment Status & Audit Logs */}
      {subTab === 'policies' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              예약·대여 운영 정책 설정
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              회의실 취소 가능 시한과 공용 비품 3일 대여 계산 기준(달력일 / 영업일)을 필요에 따라 조정할 수 있습니다.
            </p>

            <form onSubmit={handleSavePolicies} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  회의실 예약 취소 가능 시한 (시작 전 분 단위)
                </label>
                <select
                  value={cancelDeadline}
                  onChange={(e) => setCancelDeadline(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value={0}>시작 직전까지 취소 가능 (0분)</option>
                  <option value={30}>시작 30분 전까지</option>
                  <option value={60}>시작 1시간 전까지</option>
                  <option value={120}>시작 2시간 전까지</option>
                  <option value={1440}>예약 전날(24시간 전)까지</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  비품 대여 {maxLoanDays}일 계산 기준
                </label>
                <select
                  value={loanDayMode}
                  onChange={(e) => setLoanDayMode(e.target.value as LoanDayCalcMode)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="calendar">달력일 기준 (주말·공휴일 포함)</option>
                  <option value="business">영업일 기준 (주말·대한민국 공휴일 제외)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={savingPolicies}
                className="min-h-[44px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                {savingPolicies ? '저장 중...' : '정책 저장하기'}
              </button>
            </form>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-bold text-slate-900 mb-4">회의실 이용 가능 상태 관리</h3>
              <div className="divide-y divide-slate-100">
                {[...rooms]
                  .sort((a, b) => a.room_id.localeCompare(b.room_id))
                  .map((room) => (
                    <div key={room.room_id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <span className="font-semibold text-slate-900">{room.room_name}</span>
                        <span className="text-slate-500 ml-2">{room.floor}층</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <StatusIndicator state={room.status} />
                        <button
                          type="button"
                          onClick={() => void toggleRoomAvailability(admin, room)}
                          className="px-2.5 py-1 text-xs font-semibold border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                        >
                          {room.status === 'available' ? '점검(불가)' : '이용 재개'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-bold text-slate-900 mb-4">공용 비품 점검 상태 관리</h3>
              <div className="divide-y divide-slate-100">
                {[...equipment]
                  .sort((a, b) => a.equipment_id.localeCompare(b.equipment_id))
                  .map((item) => (
                    <div key={item.equipment_id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="text-sm font-mono font-semibold text-slate-900">
                        {item.management_number}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <StatusIndicator state={item.status} />
                        {item.status !== 'rented' && (
                          <button
                            type="button"
                            onClick={() => void toggleEquipmentAvailability(admin, item)}
                            className="px-2.5 py-1 text-xs font-semibold border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                          >
                            {item.status === 'available' ? '점검(불가)' : '이용 재개'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </div>

          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-slate-500" />
              <h3 className="text-base font-bold text-slate-900">최근 활동 감사 로그</h3>
            </div>
            {sortedLogs.length === 0 ? (
              <p className="text-sm text-slate-500">기록된 활동 로그가 없습니다.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-sm">
                {sortedLogs.map((log) => (
                  <div
                    key={log.log_id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 mr-2">{log.actor_name}</span>
                      <span className="text-slate-700">{log.summary}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
                      {log.created_at?.toDate
                        ? log.created_at.toDate().toLocaleString('ko-KR')
                        : '방금 전'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">비품 대여 신청 거절</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {rejectTarget.management_number} · 신청자: {rejectTarget.user_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                aria-label="닫기"
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmReject} className="pt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  거절 사유 (직원에게 알림으로 전달됩니다)
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="예: 사내 행사 지원으로 해당 기간 사용 예정"
                  className="w-full min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="min-h-[42px] px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={busyId === rejectTarget.loan_id}
                  className="min-h-[42px] px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold cursor-pointer"
                >
                  거절 확정
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
