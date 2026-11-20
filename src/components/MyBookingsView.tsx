import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Clock,
  DoorOpen,
  Laptop,
  RotateCcw,
} from 'lucide-react';
import {
  cancelMeetingRoomReservation,
  cancelPendingEquipmentLoan,
} from '../lib/facilityService';
import {
  formatHour,
  formatKoreanDate,
  getEquipmentTypeLabel,
  getTodayYMD,
  validateReservationCancellation,
} from '../lib/policies';
import type {
  EquipmentLoan,
  NavSection,
  PolicySettings,
  RoomReservation,
  UserProfile,
} from '../types/facility';
import { StatusIndicator, type SemanticState } from './StatusIndicator';

interface MyBookingsViewProps {
  user: UserProfile;
  myReservations: RoomReservation[];
  myLoans: EquipmentLoan[];
  policies: PolicySettings;
  onNavigate: (section: NavSection) => void;
  onActionSuccess: (message: string) => void;
}

export function MyBookingsView({
  user,
  myReservations,
  myLoans,
  policies,
  onNavigate,
  onActionSuccess,
}: MyBookingsViewProps) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'equipment'>('rooms');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const today = getTodayYMD();

  const sortedReservations = useMemo(() => {
    return [...myReservations].sort((a, b) => b.start_at.localeCompare(a.start_at));
  }, [myReservations]);

  const sortedLoans = useMemo(() => {
    return [...myLoans].sort((a, b) => b.start_at.localeCompare(a.start_at));
  }, [myLoans]);

  const handleCancelReservation = async (res: RoomReservation) => {
    setActionError(null);
    setBusyId(res.reservation_id);
    try {
      await cancelMeetingRoomReservation({
        actor: user,
        reservation: res,
        policies,
      });
      onActionSuccess(
        `${res.room_name} (${res.date} ${formatHour(res.start_hour)}~${formatHour(res.end_hour)}) 예약이 취소되었습니다.`,
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : '예약 취소 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelPendingLoan = async (loan: EquipmentLoan) => {
    setActionError(null);
    setBusyId(loan.loan_id);
    try {
      await cancelPendingEquipmentLoan(user, loan);
      onActionSuccess(`${loan.management_number} 대여 신청이 취소되었습니다.`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : '대여 신청 취소 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const mapLoanStatus = (status: EquipmentLoan['approval_status']): { state: SemanticState; label: string } => {
    switch (status) {
      case 'pending':
        return { state: 'pending', label: '승인 대기' };
      case 'approved':
        return { state: 'rented', label: '승인됨 · 대여 중' };
      case 'rejected':
        return { state: 'rejected', label: '거절됨' };
      case 'returned':
        return { state: 'returned', label: '반납 완료' };
      case 'cancelled':
        return { state: 'cancelled', label: '신청 취소' };
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">내 예약 · 대여 내역</h2>
            <p className="text-sm text-slate-600 mt-1">
              본인이 예약한 회의실 일정과 신청·대여 중인 공용 비품 이력을 확인하고 관리할 수 있습니다.
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setActiveTab('rooms')}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'rooms'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DoorOpen className="w-4 h-4" />
              회의실 예약 ({sortedReservations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('equipment')}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'equipment'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-4 h-4" />
              비품 대여 ({sortedLoans.length})
            </button>
          </div>
        </div>

        {actionError && (
          <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
            <span>{actionError}</span>
          </div>
        )}
      </section>

      {activeTab === 'rooms' ? (
        <section className="space-y-3">
          {sortedReservations.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
              <p className="text-[15px] text-slate-600">아직 예약한 회의실 내역이 없습니다.</p>
              <button
                type="button"
                onClick={() => onNavigate('rooms')}
                className="min-h-[44px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                회의실 예약하러 가기
              </button>
            </div>
          ) : (
            sortedReservations.map((res) => {
              const cancelCheck = validateReservationCancellation(res, policies, false);
              return (
                <article
                  key={res.reservation_id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-900">
                        {res.room_name}
                      </h3>
                      <span className="text-sm text-slate-500">{res.floor}층</span>
                      <StatusIndicator
                        state={res.status === 'confirmed' ? 'booked' : 'cancelled'}
                        customLabel={res.status === 'confirmed' ? '예약 확정' : '예약 취소됨'}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700 font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {formatKoreanDate(res.date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {formatHour(res.start_hour)} ~ {formatHour(res.end_hour)} (
                        {res.end_hour - res.start_hour}시간)
                      </span>
                    </div>
                    {res.purpose && (
                      <p className="text-sm text-slate-500">목적: {res.purpose}</p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {res.status === 'confirmed' && (
                      <button
                        type="button"
                        disabled={!cancelCheck.valid || busyId === res.reservation_id}
                        title={cancelCheck.reason}
                        onClick={() => handleCancelReservation(res)}
                        className={`min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                          cancelCheck.valid
                            ? 'bg-white hover:bg-red-50 border-red-200 text-red-700 cursor-pointer'
                            : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <RotateCcw className="w-4 h-4" />
                        {busyId === res.reservation_id
                          ? '취소 처리 중...'
                          : cancelCheck.valid
                            ? '예약 취소'
                            : '취소 불가'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {sortedLoans.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
              <p className="text-[15px] text-slate-600">아직 공용 비품 대여 신청 이력이 없습니다.</p>
              <button
                type="button"
                onClick={() => onNavigate('equipment')}
                className="min-h-[44px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                공용 비품 보러 가기
              </button>
            </div>
          ) : (
            sortedLoans.map((loan) => {
              const badge = mapLoanStatus(loan.approval_status);
              const isOverdue =
                loan.approval_status === 'approved' && loan.due_at < today;

              return (
                <article
                  key={loan.loan_id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-900 font-mono">
                        {loan.management_number}
                      </h3>
                      <span className="text-sm text-slate-500">
                        {getEquipmentTypeLabel(loan.equipment_type)} · 7층 창고
                      </span>
                      <StatusIndicator state={badge.state} customLabel={badge.label} />
                      {isOverdue && (
                        <StatusIndicator state="unavailable" customLabel="반납 기한 경과" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700 font-mono tabular-nums">
                      <span>대여 시작: {loan.start_at.replace('T', ' ')}</span>
                      <span>반납 예정일: {loan.due_at}</span>
                      {loan.returned_at && (
                        <span className="text-emerald-700 font-semibold">
                          반납 완료일: {loan.returned_at}
                        </span>
                      )}
                    </div>

                    {loan.purpose && (
                      <p className="text-sm text-slate-500">사용 목적: {loan.purpose}</p>
                    )}
                    {loan.approval_status === 'rejected' && loan.reject_reason && (
                      <p className="text-sm text-red-700 font-medium">
                        거절 사유: {loan.reject_reason}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {loan.approval_status === 'pending' && (
                      <button
                        type="button"
                        disabled={busyId === loan.loan_id}
                        onClick={() => handleCancelPendingLoan(loan)}
                        className="min-h-[42px] px-4 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {busyId === loan.loan_id ? '취소 중...' : '신청 취소'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}
