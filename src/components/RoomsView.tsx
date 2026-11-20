import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DoorOpen,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import { bookMeetingRoom } from '../lib/facilityService';
import {
  OPERATING_HOURS,
  addCalendarDays,
  formatHour,
  formatKoreanDate,
  getTodayYMD,
  validateRoomBookingPolicy,
} from '../lib/policies';
import type { PolicySettings, Room, RoomSlot, UserProfile } from '../types/facility';
import { StatusIndicator, type SemanticState } from './StatusIndicator';

interface RoomsViewProps {
  user: UserProfile;
  rooms: Room[];
  roomSlots: RoomSlot[];
  policies: PolicySettings;
  selectedDate: string;
  startHour: number;
  endHour: number;
  initialModalRoom: Room | null;
  onClearInitialModalRoom: () => void;
  onDateChange: (date: string) => void;
  onStartHourChange: (hour: number) => void;
  onEndHourChange: (hour: number) => void;
  onBookingSuccess: (message: string) => void;
}

export function RoomsView({
  user,
  rooms,
  roomSlots,
  policies,
  selectedDate,
  startHour,
  endHour,
  initialModalRoom,
  onClearInitialModalRoom,
  onDateChange,
  onStartHourChange,
  onEndHourChange,
  onBookingSuccess,
}: RoomsViewProps) {
  const [floorFilter, setFloorFilter] = useState<'all' | 7 | 10>('all');
  const [activeRoom, setActiveRoom] = useState<Room | null>(initialModalRoom);
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [completedBooking, setCompletedBooking] = useState<{
    roomName: string;
    floor: number;
    date: string;
    startHour: number;
    endHour: number;
  } | null>(null);

  React.useEffect(() => {
    if (initialModalRoom) {
      setActiveRoom(initialModalRoom);
      setCompletedBooking(null);
      setBookingError(null);
      onClearInitialModalRoom();
    }
  }, [initialModalRoom, onClearInitialModalRoom]);

  const today = getTodayYMD();
  const maxBookableDate = addCalendarDays(today, policies.booking_horizon_days || 30);

  const policyCheck = validateRoomBookingPolicy(selectedDate, startHour, endHour, policies);

  const selectedHours = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h < endHour; h += 1) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  // Map room_id -> Map<hour, RoomSlot> for the selected date
  const slotMapByRoom = useMemo(() => {
    const outer = new Map<string, Map<number, RoomSlot>>();
    roomSlots
      .filter((s) => s.date === selectedDate)
      .forEach((slot) => {
        if (!outer.has(slot.room_id)) outer.set(slot.room_id, new Map());
        outer.get(slot.room_id)!.set(slot.hour, slot);
      });
    return outer;
  }, [roomSlots, selectedDate]);

  const filteredRooms = useMemo(() => {
    return rooms
      .filter((r) => (floorFilter === 'all' ? true : r.floor === floorFilter))
      .sort((a, b) => a.room_id.localeCompare(b.room_id));
  }, [rooms, floorFilter]);

  const endHourOptions = Array.from(
    { length: Math.min(policies.max_room_hours || 4, 18 - startHour) },
    (_, i) => startHour + i + 1,
  );

  const getRoomCardState = (room: Room): { state: SemanticState; hasConflict: boolean } => {
    if (room.status === 'unavailable' || !policyCheck.valid) {
      return { state: 'unavailable', hasConflict: false };
    }
    const roomDaySlots = slotMapByRoom.get(room.room_id);
    const hasConflict = selectedHours.some((h) => roomDaySlots?.has(h));
    if (hasConflict) {
      return { state: 'booked', hasConflict: true };
    }
    return { state: 'available', hasConflict: false };
  };

  const openBookingModal = (room: Room) => {
    setActiveRoom(room);
    setPurpose('');
    setBookingError(null);
    setCompletedBooking(null);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    setBookingError(null);
    setSubmitting(true);
    try {
      await bookMeetingRoom({
        user,
        room: activeRoom,
        date: selectedDate,
        startHour,
        endHour,
        purpose,
        policies,
      });
      setCompletedBooking({
        roomName: activeRoom.room_name,
        floor: activeRoom.floor,
        date: selectedDate,
        startHour,
        endHour,
      });
      onBookingSuccess(
        `${activeRoom.room_name} (${formatKoreanDate(selectedDate)} ${formatHour(startHour)}~${formatHour(endHour)}) 예약이 확정되었습니다.`,
      );
    } catch (err: unknown) {
      setBookingError(
        err instanceof Error ? err.message : '회의실 예약 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const floor7Count = rooms.filter((r) => r.floor === 7).length;
  const floor10Count = rooms.filter((r) => r.floor === 10).length;

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">회의실 현황 및 예약</h2>
            <p className="text-sm text-slate-600 mt-1">
              날짜와 시간을 먼저 선택하면 즉시 예약 가능한 회의실을 확인할 수 있습니다. (월~금 09:00~18:00 · 1시간 단위 · 최대 {policies.max_room_hours}시간)
            </p>
          </div>

          {/* Floor Filter Segmented Buttons */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { key: 'all', label: `전체 (${rooms.length})` },
                { key: 7, label: `7층 (${floor7Count})` },
                { key: 10, label: `10층 (${floor10Count})` },
              ] as const
            ).map((tab) => (
              <button
                key={String(tab.key)}
                type="button"
                onClick={() => setFloorFilter(tab.key)}
                className={`min-h-[38px] px-3.5 py-1.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  floorFilter === tab.key
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-200">
          <div>
            <label
              htmlFor="rooms-date"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              예약 날짜 (향후 {policies.booking_horizon_days}일 이내)
            </label>
            <input
              id="rooms-date"
              type="date"
              min={today}
              max={maxBookableDate}
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-[15px] font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="rooms-start"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              시작 시간
            </label>
            <select
              id="rooms-start"
              value={startHour}
              onChange={(e) => {
                const nextStart = Number(e.target.value);
                onStartHourChange(nextStart);
                if (endHour <= nextStart || endHour - nextStart > (policies.max_room_hours || 4)) {
                  onEndHourChange(Math.min(nextStart + 1, 18));
                }
              }}
              className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-[15px] font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {OPERATING_HOURS.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="rooms-end"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              종료 시간 (1~{policies.max_room_hours}시간 연속)
            </label>
            <select
              id="rooms-end"
              value={endHour}
              onChange={(e) => onEndHourChange(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-[15px] font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {endHourOptions.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)} ({h - startHour}시간)
                </option>
              ))}
            </select>
          </div>
        </div>

        {!policyCheck.valid && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
            <span>{policyCheck.reason}</span>
          </div>
        )}
      </section>

      {/* Room Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRooms.map((room) => {
          const { state, hasConflict } = getRoomCardState(room);
          const roomDaySlots = slotMapByRoom.get(room.room_id);
          const canReserve = state === 'available';

          return (
            <article
              key={room.room_id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{room.room_name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {room.floor}층
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Users className="w-3.5 h-3.5" />
                        최대 {room.capacity}명
                      </span>
                    </div>
                  </div>
                  <StatusIndicator
                    state={state}
                    customLabel={
                      room.status === 'unavailable'
                        ? '이용 불가'
                        : !policyCheck.valid
                          ? '예약 불가일'
                          : hasConflict
                            ? '예약 완료'
                            : '이용 가능'
                    }
                  />
                </div>

                <p className="text-xs text-slate-500 mb-4">{room.amenities}</p>

                {/* Hourly Availability Timeline (09:00 - 18:00) */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span>{selectedDate} 시간별 현황</span>
                    <span className="font-mono tabular-nums">09:00–18:00</span>
                  </div>
                  <div className="grid grid-cols-9 gap-1">
                    {OPERATING_HOURS.map((hour) => {
                      const slot = roomDaySlots?.get(hour);
                      const isSelected = selectedHours.includes(hour);
                      let barClass = 'bg-emerald-100 text-emerald-900 border-emerald-200';
                      if (room.status === 'unavailable') {
                        barClass = 'bg-red-50 text-red-700 border-red-200';
                      } else if (slot) {
                        barClass = 'bg-slate-200 text-slate-600 border-slate-300';
                      } else if (isSelected && policyCheck.valid) {
                        barClass = 'bg-blue-700 text-white border-blue-700';
                      }

                      return (
                        <button
                          key={hour}
                          type="button"
                          title={
                            slot
                              ? `${formatHour(hour)}~${formatHour(hour + 1)} 예약됨 (${slot.user_name})`
                              : `${formatHour(hour)}~${formatHour(hour + 1)} 이용 가능`
                          }
                          onClick={() => {
                            onStartHourChange(hour);
                            onEndHourChange(Math.min(hour + 1, 18));
                          }}
                          className={`py-1.5 rounded text-[11px] font-mono font-semibold border text-center transition-colors cursor-pointer ${barClass}`}
                        >
                          {hour}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                    <span>초록: 가능</span>
                    <span>파랑: 선택</span>
                    <span>회색: 예약됨</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!canReserve}
                onClick={() => openBookingModal(room)}
                className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  canReserve
                    ? 'bg-blue-700 hover:bg-blue-800 text-white cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <DoorOpen className="w-4 h-4" />
                {canReserve
                  ? `${formatHour(startHour)}~${formatHour(endHour)} 예약하기`
                  : hasConflict
                    ? '선택 시간 예약 완료'
                    : '현재 예약 불가'}
              </button>
            </article>
          );
        })}
      </section>

      {/* Screen ④: Room Reservation Modal */}
      {activeRoom && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-booking-modal-title"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 id="room-booking-modal-title" className="text-xl font-bold text-slate-900">
                  {completedBooking ? '회의실 예약이 확정되었습니다' : '회의실 예약 확인'}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {activeRoom.room_name} · {activeRoom.floor}층 (최대 {activeRoom.capacity}명)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRoom(null)}
                aria-label="닫기"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {completedBooking ? (
              <div className="pt-6 space-y-5">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
                  <div className="text-sm text-emerald-900 space-y-1">
                    <p className="font-bold">별도 승인 없이 즉시 예약이 확정되었습니다.</p>
                    <p>
                      {completedBooking.roomName} ({completedBooking.floor}층) ·{' '}
                      {formatKoreanDate(completedBooking.date)}{' '}
                      {formatHour(completedBooking.startHour)}~{formatHour(completedBooking.endHour)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveRoom(null)}
                    className="min-h-[44px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmBooking} className="pt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      예약 날짜
                    </label>
                    <input
                      type="date"
                      min={today}
                      max={maxBookableDate}
                      value={selectedDate}
                      onChange={(e) => onDateChange(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      시작 시간
                    </label>
                    <select
                      value={startHour}
                      onChange={(e) => {
                        const nextStart = Number(e.target.value);
                        onStartHourChange(nextStart);
                        if (endHour <= nextStart || endHour - nextStart > (policies.max_room_hours || 4)) {
                          onEndHourChange(Math.min(nextStart + 1, 18));
                        }
                      }}
                      className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                    >
                      {OPERATING_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {formatHour(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      종료 시간
                    </label>
                    <select
                      value={endHour}
                      onChange={(e) => onEndHourChange(Number(e.target.value))}
                      className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                    >
                      {endHourOptions.map((h) => (
                        <option key={h} value={h}>
                          {formatHour(h)} ({h - startHour}시간)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Availability & Policy Summary */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      선택 일정
                    </span>
                    <span className="font-semibold text-slate-900 font-mono tabular-nums">
                      {formatKoreanDate(selectedDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      이용 시간
                    </span>
                    <span className="font-semibold text-slate-900 font-mono tabular-nums">
                      {formatHour(startHour)} ~ {formatHour(endHour)} ({endHour - startHour}시간)
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-600">예약 가능 여부</span>
                    <StatusIndicator state={getRoomCardState(activeRoom).state} />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="booking-purpose"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    회의 제목 또는 목적 (선택)
                  </label>
                  <input
                    id="booking-purpose"
                    type="text"
                    maxLength={120}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="예: 주간 프로젝트 점검 회의"
                    className="w-full min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-lg text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {(!policyCheck.valid || bookingError) && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-sm text-red-800">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" />
                    <span>{bookingError ?? policyCheck.reason}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveRoom(null)}
                    className="min-h-[44px] px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || getRoomCardState(activeRoom).state !== 'available'}
                    className="min-h-[44px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {submitting ? '중복 확인 및 확정 중...' : '예약 확정하기'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
