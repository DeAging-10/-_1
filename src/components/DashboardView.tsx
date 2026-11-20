import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarCheck,
  ChevronDown,
  Clock,
  DoorOpen,
  HelpCircle,
  Laptop,
  Package,
} from 'lucide-react';
import {
  OPERATING_HOURS,
  addCalendarDays,
  formatHour,
  formatKoreanDate,
  getEquipmentTypeLabel,
  getTodayYMD,
  validateRoomBookingPolicy,
} from '../lib/policies';
import type {
  AppNotification,
  Equipment,
  EquipmentLoan,
  NavSection,
  PolicySettings,
  Room,
  RoomReservation,
  RoomSlot,
  UserProfile,
} from '../types/facility';
import { StatusIndicator } from './StatusIndicator';

interface DashboardViewProps {
  user: UserProfile;
  rooms: Room[];
  roomSlots: RoomSlot[];
  equipment: Equipment[];
  myReservations: RoomReservation[];
  myLoans: EquipmentLoan[];
  notifications: AppNotification[];
  policies: PolicySettings;
  selectedDate: string;
  startHour: number;
  endHour: number;
  onDateChange: (date: string) => void;
  onStartHourChange: (hour: number) => void;
  onEndHourChange: (hour: number) => void;
  onNavigate: (section: NavSection) => void;
  onQuickBookRoom: (room: Room) => void;
  onQuickLoanEquipment: (item: Equipment) => void;
}

export function DashboardView({
  user,
  rooms,
  roomSlots,
  equipment,
  myReservations,
  myLoans,
  notifications,
  policies,
  selectedDate,
  startHour,
  endHour,
  onDateChange,
  onStartHourChange,
  onEndHourChange,
  onNavigate,
  onQuickBookRoom,
  onQuickLoanEquipment,
}: DashboardViewProps) {
  const [faqCategory, setFaqCategory] = useState<'all' | 'room' | 'equipment'>('all');
  const [openFaqId, setOpenFaqId] = useState<string | null>('room-hours');

  const today = getTodayYMD();
  const maxBookableDate = addCalendarDays(today, policies.booking_horizon_days || 30);

  const timeValidation = validateRoomBookingPolicy(selectedDate, startHour, endHour, policies);

  const selectedHours: number[] = [];
  for (let h = startHour; h < endHour; h += 1) {
    selectedHours.push(h);
  }

  const bookedByRoom = new Map<string, Set<number>>();
  roomSlots
    .filter((s) => s.date === selectedDate)
    .forEach((s) => {
      if (!bookedByRoom.has(s.room_id)) bookedByRoom.set(s.room_id, new Set());
      bookedByRoom.get(s.room_id)!.add(s.hour);
    });

  const availableRoomsNow = rooms.filter((room) => {
    if (!timeValidation.valid || room.status !== 'available') return false;
    const booked = bookedByRoom.get(room.room_id);
    return !selectedHours.some((h) => booked?.has(h));
  });

  const availableEquipment = equipment.filter((e) => e.status === 'available');
  const upcomingMyReservations = myReservations
    .filter((r) => r.status === 'confirmed' && r.date >= today)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const activeMyLoans = myLoans.filter((l) =>
    ['pending', 'approved'].includes(l.approval_status),
  );
  const unreadNotifCount = notifications.filter((n) => !n.is_read).length;

  const endHourOptions = Array.from(
    { length: Math.min(policies.max_room_hours || 4, 18 - startHour) },
    (_, i) => startHour + i + 1,
  );

  return (
    <div className="space-y-6">
      {/* Welcome & Date/Time Quick Selector Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {formatKoreanDate(today)} · {user.name}님
            </p>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              반갑습니다. 서울교육센터 입니다.
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('rooms')}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <DoorOpen className="w-4 h-4" />
              회의실 예약하기
            </button>
            <button
              type="button"
              onClick={() => onNavigate('equipment')}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Laptop className="w-4 h-4" />
              비품 대여 신청
            </button>
          </div>
        </div>

        {/* Date & Time Picker Strip */}
        <div className="pt-5 border-t border-slate-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
            <Calendar className="w-4 h-4 text-blue-700" />
            <span>회의실 이용 날짜·시간 선택 (즉시 예약 가능 여부 확인)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label
                htmlFor="dash-date"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                예약 날짜
              </label>
              <input
                id="dash-date"
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
                htmlFor="dash-start"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                시작 시간
              </label>
              <select
                id="dash-start"
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
                htmlFor="dash-end"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                종료 시간 (최대 {policies.max_room_hours}시간)
              </label>
              <select
                id="dash-end"
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

            <button
              type="button"
              onClick={() => onNavigate('rooms')}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>가능한 회의실 보기</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {!timeValidation.valid && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
              <span>{timeValidation.reason}</span>
            </div>
          )}
        </div>
      </section>

      {/* 4 KPI Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('rooms')}
          className="text-left bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium mb-3">
            <span>전체 회의실</span>
            <DoorOpen className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">
            {rooms.length}
            <span className="text-base font-medium text-slate-500 ml-1">개</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">7층 7개 · 10층 4개 운영</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('rooms')}
          className="text-left bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium mb-3">
            <span>선택 시간 예약 가능 회의실</span>
            <CalendarCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums">
            {availableRoomsNow.length}
            <span className="text-base font-medium text-slate-500 ml-1">/ {rooms.length}개</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
            {selectedDate} {formatHour(startHour)}–{formatHour(endHour)}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('equipment')}
          className="text-left bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium mb-3">
            <span>전체 공용 비품</span>
            <Package className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">
            {equipment.length}
            <span className="text-base font-medium text-slate-500 ml-1">대</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">노트북 5 · 태블릿 5 · 카메라 3</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('equipment')}
          className="text-left bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium mb-3">
            <span>대여 가능 비품</span>
            <Laptop className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="text-3xl font-bold text-emerald-700 tabular-nums">
            {availableEquipment.length}
            <span className="text-base font-medium text-slate-500 ml-1">/ {equipment.length}대</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">보관 위치: 7층 창고 · 최대 {policies.max_loan_days}일</p>
        </button>
      </section>

      {/* Main Split: Available Rooms + Quick Equipment & My Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Immediately Bookable Rooms */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                바로 예약 가능한 회의실
              </h3>
              <p className="text-sm text-slate-500 mt-0.5 font-mono tabular-nums">
                {formatKoreanDate(selectedDate)} · {formatHour(startHour)}~{formatHour(endHour)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('rooms')}
              className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              전체 11개 보기
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {!timeValidation.valid ? (
            <div className="py-10 text-center text-slate-500 text-[15px]">
              예약 가능한 평일·운영시간(09:00~18:00)을 선택하시면 이용 가능한 회의실이 표시됩니다.
            </div>
          ) : availableRoomsNow.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-[15px]">
              선택하신 시간대에 비어 있는 회의실이 없습니다. 다른 시간대를 선택해 주세요.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-2">
              {availableRoomsNow.slice(0, 6).map((room) => (
                <div
                  key={room.room_id}
                  className="py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[16px] font-bold text-slate-900">
                        {room.room_name}
                      </span>
                      <span className="text-sm text-slate-500">
                        {room.floor}층 · 최대 {room.capacity}명
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {room.amenities}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusIndicator state="available" />
                    <button
                      type="button"
                      onClick={() => onQuickBookRoom(room)}
                      className="min-h-[40px] px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      즉시 예약
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right 5 cols: My Summary + Available Equipment */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">내 이용 현황</h3>
              <button
                type="button"
                onClick={() => onNavigate('my-bookings')}
                className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                상세 내역
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 py-4 border-b border-slate-100">
              <button
                type="button"
                onClick={() => onNavigate('my-bookings')}
                className="text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="text-xs text-slate-500 font-medium">예정 회의실</div>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {upcomingMyReservations.length}건
                </div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('my-bookings')}
                className="text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="text-xs text-slate-500 font-medium">진행 중 비품</div>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {activeMyLoans.length}건
                </div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('notifications')}
                className="text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="text-xs text-slate-500 font-medium">읽지 않은 알림</div>
                <div className="text-xl font-bold text-blue-700 mt-1 tabular-nums">
                  {unreadNotifCount}건
                </div>
              </button>
            </div>

            <div className="pt-4 space-y-3">
              {upcomingMyReservations.length === 0 && activeMyLoans.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">
                  현재 예정된 회의실 예약이나 진행 중인 비품 대여가 없습니다.
                </p>
              ) : (
                <>
                  {upcomingMyReservations.slice(0, 2).map((res) => (
                    <div
                      key={res.reservation_id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {res.room_name} ({res.floor}층)
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          {res.date} {formatHour(res.start_hour)}~{formatHour(res.end_hour)}
                        </div>
                      </div>
                      <StatusIndicator state="booked" />
                    </div>
                  ))}
                  {activeMyLoans.slice(0, 2).map((loan) => (
                    <div
                      key={loan.loan_id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {loan.management_number}
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          반납 예정: {loan.due_at}
                        </div>
                      </div>
                      <StatusIndicator
                        state={loan.approval_status === 'pending' ? 'pending' : 'rented'}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">대여 가능 비품</h3>
              <button
                type="button"
                onClick={() => onNavigate('equipment')}
                className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                전체 13대 보기
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 mt-2">
              {availableEquipment.slice(0, 4).map((item) => (
                <div
                  key={item.equipment_id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-[15px] font-bold text-slate-900 font-mono">
                      {item.management_number}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {getEquipmentTypeLabel(item.type)} · {item.storage_location}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuickLoanEquipment(item)}
                    className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    대여 신청
                  </button>
                </div>
              ))}
              {availableEquipment.length === 0 && (
                <p className="py-4 text-sm text-slate-500">
                  현재 대여 가능한 공용 비품이 없습니다.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Quick Bottom Links for Notifications */}
      {unreadNotifCount > 0 && (
        <section className="bg-white border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-800">
            <Bell className="w-5 h-5 text-blue-700 shrink-0" />
            <span>
              확인하지 않은 알림이 <strong className="font-bold text-blue-700 tabular-nums">{unreadNotifCount}건</strong> 있습니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('notifications')}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
          >
            알림 확인하기 →
          </button>
        </section>
      )}

      {/* FAQ Section: 자주 묻는 질문 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">자주 묻는 질문</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                회의실 예약 가능 시간과 공용 비품 대여·반납 규정을 빠르게 확인해 보세요.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { key: 'all', label: '전체' },
                { key: 'room', label: '회의실 예약' },
                { key: 'equipment', label: '비품 대여·반납' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFaqCategory(tab.key)}
                className={`min-h-[36px] px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  faqCategory === tab.key
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100 mt-1">
          {[
            {
              id: 'room-hours',
              category: 'room' as const,
              categoryLabel: '회의실 예약',
              question: '회의실 예약 가능 요일과 시간은 어떻게 되나요?',
              answer: `회의실(7층 7개 · 10층 4개)은 월요일~금요일 09:00~18:00에 1시간 단위로 예약할 수 있습니다. 1회 최대 ${policies.max_room_hours}시간까지 연속 예약이 가능하며, 신청일 기준 향후 ${policies.booking_horizon_days}일 이내 평일만 선택할 수 있습니다. 토요일·일요일 및 대한민국 공휴일은 예약이 불가하며, 신청 시 담당자 승인 없이 즉시 확정됩니다.`,
            },
            {
              id: 'room-cancel',
              category: 'room' as const,
              categoryLabel: '회의실 예약',
              question: '예약한 회의실은 언제까지 취소할 수 있나요?',
              answer:
                policies.cancel_deadline_minutes > 0
                  ? `본인이 예약한 회의실은 '내 예약·대여' 메뉴에서 예약 시작 ${policies.cancel_deadline_minutes}분 전까지 직접 취소할 수 있습니다. 취소 즉시 해당 시간대는 다른 직원이 예약할 수 있도록 열립니다.`
                  : "본인이 예약한 회의실은 '내 예약·대여' 메뉴에서 예약 시작 직전까지 직접 취소할 수 있습니다. 취소 즉시 해당 시간대는 다른 직원이 예약할 수 있도록 열립니다.",
            },
            {
              id: 'equipment-loan',
              category: 'equipment' as const,
              categoryLabel: '비품 대여·반납',
              question: '공용 비품은 어디서 수령하며 최대 며칠까지 빌릴 수 있나요?',
              answer: `공용 비품(노트북 5대 · 태블릿 5대 · 카메라 3대)은 모두 7층 창고에 보관되어 있습니다. 앱에서 대여 신청 후 시설 담당자 승인이 완료되면 수령해 사용할 수 있으며, 현재 ${
                policies.loan_day_calc_mode === 'business'
                  ? '영업일(주말·공휴일 제외)'
                  : '달력일'
              } 기준 최대 ${policies.max_loan_days}일까지 대여 가능합니다.`,
            },
            {
              id: 'equipment-return',
              category: 'equipment' as const,
              categoryLabel: '비품 대여·반납',
              question: '비품 반납 절차와 반납 기한 알림은 어떻게 운영되나요?',
              answer:
                '대여하신 비품은 반납 예정일 업무 종료 전까지 7층 창고로 반납해 주세요. 시설 담당자가 반납 확인을 마치면 앱 내 반납 완료 알림이 발송되고 이력이 갱신됩니다. 반납 예정일 전날·당일 및 기한 경과 시 자동으로 앱 내부 알림을 보내드립니다.',
            },
            {
              id: 'duplicate-prevention',
              category: 'room' as const,
              categoryLabel: '회의실 예약',
              question: '동일 시간대 회의실 중복 예약이나 비품 중복 대여가 발생할 수 있나요?',
              answer:
                '아니요. 회의실은 데이터베이스 수준에서 시간대별 잠금을 적용해 두 직원이 동시에 신청해도 단 1건만 확정됩니다. 공용 비품 역시 현재 대여 중인 항목은 중복 대여 승인이 차단됩니다.',
            },
            {
              id: 'account-help',
              category: 'equipment' as const,
              categoryLabel: '비품 대여·반납',
              question: '신규 직원 계정 발급이나 비품 사용 문의는 어떻게 하나요?',
              answer:
                '사내 보안 정책상 직원이 직접 회원가입할 수 없으며, 시설 담당자가 발급한 계정으로만 로그인할 수 있습니다. 신규 계정 발급, 비밀번호 재설정 또는 비품 이상 발생 시 시설 담당자에게 문의해 주세요.',
            },
          ]
            .filter((item) => faqCategory === 'all' || item.category === faqCategory)
            .map((item) => {
              const isOpen = openFaqId === item.id;
              return (
                <div key={item.id} className="py-1">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                    className="w-full min-h-[48px] py-3 flex items-center justify-between gap-4 text-left hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                      <span className="text-xs font-semibold text-blue-700 shrink-0">
                        {item.categoryLabel}
                      </span>
                      <span className="text-[15px] font-semibold text-slate-900">
                        {item.question}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-150 ${
                        isOpen ? 'rotate-180 text-blue-700' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="pb-4 pr-6 text-sm text-slate-600 leading-relaxed">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
