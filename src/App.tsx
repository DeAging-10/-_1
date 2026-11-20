import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  DoorOpen,
  Laptop,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { AdminFacilityView } from './components/AdminFacilityView';
import { AdminUsersView } from './components/AdminUsersView';
import { DashboardView } from './components/DashboardView';
import { EquipmentView } from './components/EquipmentView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginView } from './components/LoginView';
import { MyBookingsView } from './components/MyBookingsView';
import { NotificationsView } from './components/NotificationsView';
import { RoomsView } from './components/RoomsView';
import {
  ensureReturnDueReminders,
  resolveAndBootstrapUser,
} from './lib/facilityService';
import { auth, db, handleFirestoreError } from './lib/firebase';
import {
  DEFAULT_POLICIES,
  getDefaultStartHour,
  getNextBookableDateYMD,
} from './lib/policies';
import {
  OperationType,
  type ActivityLog,
  type AppNotification,
  type Equipment,
  type EquipmentLoan,
  type InvitedUser,
  type NavSection,
  type PolicySettings,
  type Room,
  type RoomReservation,
  type RoomSlot,
  type UserProfile,
} from './types/facility';

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: '통합 대시보드',
  rooms: '회의실 예약',
  equipment: '공용 비품 대여',
  'my-bookings': '내 예약·대여',
  notifications: '알림',
  'admin-facility': '시설 담당자 관리',
  'admin-users': '직원 계정 관리',
};

function AppShell() {
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [deniedState, setDeniedState] = useState<{
    status: 'inactive' | 'unregistered';
    email: string;
  } | null>(null);

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [adminMode, setAdminMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Shared Date/Time selection state across Dashboard & Rooms views
  const [selectedDate, setSelectedDate] = useState<string>(() => getNextBookableDateYMD());
  const [startHour, setStartHour] = useState<number>(() =>
    getDefaultStartHour(getNextBookableDateYMD()),
  );
  const [endHour, setEndHour] = useState<number>(() =>
    Math.min(getDefaultStartHour(getNextBookableDateYMD()) + 1, 18),
  );

  // Quick-action modal triggers from Dashboard
  const [quickModalRoom, setQuickModalRoom] = useState<Room | null>(null);
  const [quickModalEquipment, setQuickModalEquipment] = useState<Equipment | null>(null);

  // Real-time Firestore state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomSlots, setRoomSlots] = useState<RoomSlot[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [myReservations, setMyReservations] = useState<RoomReservation[]>([]);
  const [myLoans, setMyLoans] = useState<EquipmentLoan[]>([]);
  const [userNotifications, setUserNotifications] = useState<AppNotification[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<AppNotification[]>([]);
  const [policies, setPolicies] = useState<PolicySettings>(DEFAULT_POLICIES);

  // Admin-only collections
  const [allReservations, setAllReservations] = useState<RoomReservation[]>([]);
  const [allLoans, setAllLoans] = useState<EquipmentLoan[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // 1. Firebase Auth state listener & RBAC profile bootstrap
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUserProfile(null);
        setDeniedState(null);
        setAuthReady(true);
        return;
      }

      try {
        const result = await resolveAndBootstrapUser(fbUser);
        if (result.status === 'authorized') {
          setUserProfile(result.profile);
          setDeniedState(null);
        } else {
          setUserProfile(null);
          setDeniedState({ status: result.status, email: result.email });
        }
      } catch (err) {
        console.error('Auth profile resolution failed:', err);
        setUserProfile(null);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore listeners for authenticated & authorized user
  useEffect(() => {
    if (!userProfile) return;

    const uid = userProfile.user_id;
    const isAdmin = userProfile.role === 'admin';
    const unsubs: Array<() => void> = [];

    // Policy settings
    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'policies'),
        (snap) => {
          if (snap.exists()) {
            setPolicies(snap.data() as PolicySettings);
          }
        },
        (error) => handleFirestoreError(error, OperationType.GET, 'settings/policies'),
      ),
    );

    // All 11 Meeting Rooms
    unsubs.push(
      onSnapshot(
        query(collection(db, 'rooms'), where('status', 'in', ['available', 'unavailable'])),
        (snap) => {
          setRooms(snap.docs.map((d) => d.data() as Room));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'rooms'),
      ),
    );

    // Booked Room Slots (for real-time availability across all rooms)
    unsubs.push(
      onSnapshot(
        query(collection(db, 'room_slots'), where('status', '==', 'booked')),
        (snap) => {
          setRoomSlots(snap.docs.map((d) => d.data() as RoomSlot));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'room_slots'),
      ),
    );

    // All 13 Shared Equipment items
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'equipment'),
          where('status', 'in', ['available', 'rented', 'unavailable']),
        ),
        (snap) => {
          setEquipment(snap.docs.map((d) => d.data() as Equipment));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'equipment'),
      ),
    );

    // My Room Reservations
    unsubs.push(
      onSnapshot(
        query(collection(db, 'room_reservations'), where('user_id', '==', uid)),
        (snap) => {
          setMyReservations(snap.docs.map((d) => d.data() as RoomReservation));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'room_reservations'),
      ),
    );

    // My Equipment Loans
    unsubs.push(
      onSnapshot(
        query(collection(db, 'equipment_loans'), where('user_id', '==', uid)),
        (snap) => {
          const loans = snap.docs.map((d) => d.data() as EquipmentLoan);
          setMyLoans(loans);
          void ensureReturnDueReminders(userProfile, loans);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'equipment_loans'),
      ),
    );

    // My In-App Notifications
    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('user_id', '==', uid)),
        (snap) => {
          setUserNotifications(snap.docs.map((d) => d.data() as AppNotification));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'),
      ),
    );

    // Admin-only collections (strictly guarded in both client & Firestore security rules)
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('target_scope', '==', 'admin')),
          (snap) => {
            setAdminNotifications(snap.docs.map((d) => d.data() as AppNotification));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'notifications(admin)'),
        ),
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'room_reservations'),
          (snap) => {
            setAllReservations(snap.docs.map((d) => d.data() as RoomReservation));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'room_reservations(all)'),
        ),
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'equipment_loans'),
          (snap) => {
            setAllLoans(snap.docs.map((d) => d.data() as EquipmentLoan));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'equipment_loans(all)'),
        ),
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'users'),
        ),
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'invited_users'),
          (snap) => {
            setInvitedUsers(snap.docs.map((d) => d.data() as InvitedUser));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'invited_users'),
        ),
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'activity_logs'),
          (snap) => {
            setActivityLogs(snap.docs.map((d) => d.data() as ActivityLog));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'activity_logs'),
        ),
      );
    } else {
      setAdminNotifications([]);
      setAllReservations([]);
      setAllLoans([]);
      setAllUsers([]);
      setInvitedUsers([]);
      setActivityLogs([]);
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [userProfile]);

  // Enforce RBAC navigation safety if non-admin somehow reaches admin nav key
  useEffect(() => {
    if (
      userProfile &&
      userProfile.role !== 'admin' &&
      (activeNav === 'admin-facility' || activeNav === 'admin-users')
    ) {
      setActiveNav('dashboard');
    }
  }, [userProfile, activeNav]);

  const combinedNotifications = useMemo(() => {
    const map = new Map<string, AppNotification>();
    userNotifications.forEach((n) => map.set(n.notification_id, n));
    if (userProfile?.role === 'admin') {
      adminNotifications.forEach((n) => map.set(n.notification_id, n));
    }
    return Array.from(map.values());
  }, [userNotifications, adminNotifications, userProfile]);

  const unreadCount = useMemo(
    () => combinedNotifications.filter((n) => !n.is_read).length,
    [combinedNotifications],
  );

  const pendingLoanCount = useMemo(
    () => allLoans.filter((l) => l.approval_status === 'pending').length,
    [allLoans],
  );

  const handleLogout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setAdminMode(false);
    setActiveNav('dashboard');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Building2 className="w-8 h-8 text-blue-700 mx-auto" />
          <p className="text-sm font-medium text-slate-600">오피스 시설매니저를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <LoginView
        deniedState={deniedState}
        onClearDenied={() => setDeniedState(null)}
      />
    );
  }

  const isAdmin = userProfile.role === 'admin';

  const employeeNavItems: Array<{
    key: NavSection;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = [
    { key: 'dashboard', label: '통합 대시보드', icon: LayoutDashboard },
    { key: 'rooms', label: '회의실 예약', icon: DoorOpen },
    { key: 'equipment', label: '공용 비품 대여', icon: Laptop },
    { key: 'my-bookings', label: '내 예약·대여', icon: CalendarCheck },
    { key: 'notifications', label: '알림', icon: Bell, count: unreadCount },
  ];

  const adminNavItems: Array<{
    key: NavSection;
    label: string;
    icon: typeof ShieldCheck;
    count?: number;
  }> = [
    {
      key: 'admin-facility',
      label: '시설 담당자 관리',
      icon: ShieldCheck,
      count: pendingLoanCount,
    },
    { key: 'admin-users', label: '직원 계정 관리', icon: Users },
  ];

  const handleSelectNav = (key: NavSection) => {
    if (!isAdmin && (key === 'admin-facility' || key === 'admin-users')) {
      return;
    }
    setActiveNav(key);
    setMobileMenuOpen(false);
  };

  const handleEnterAdminMode = () => {
    if (!isAdmin) return;
    setAdminMode(true);
    setActiveNav('admin-facility');
    setMobileMenuOpen(false);
  };

  const handleExitAdminMode = () => {
    setAdminMode(false);
    setActiveNav('dashboard');
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col lg:flex-row">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-16 px-6 border-b border-slate-200 flex items-center gap-2.5">
          <Building2 className="w-6 h-6 text-blue-700 shrink-0" />
          <span className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">
            서울교육센터
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="주 메뉴">
          {!adminMode ? (
            employeeNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectNav(item.key)}
                  className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-[15px] font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-3 whitespace-nowrap">
                    <Icon className="w-5 h-5 shrink-0" />
                    {item.label}
                  </span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-xs font-mono font-bold text-blue-700 tabular-nums">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleExitAdminMode}
                className="w-full min-h-[42px] flex items-center gap-2.5 px-3.5 py-2 mb-3 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                직원 화면으로 돌아가기
              </button>
              <div className="px-3.5 pb-1.5 text-xs font-semibold text-slate-400">
                시설 담당자 관리 모드
              </div>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectNav(item.key)}
                    className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-[15px] font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="inline-flex items-center gap-3 whitespace-nowrap">
                      <Icon className="w-5 h-5 shrink-0" />
                      {item.label}
                    </span>
                    {item.count !== undefined && item.count > 0 && (
                      <span className="text-xs font-mono font-bold text-amber-700 tabular-nums">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2.5">
          <div className="px-2">
            <div className="text-sm font-bold text-slate-900 truncate">{userProfile.name}님</div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              {userProfile.login_id}
            </div>
          </div>
          {isAdmin && !adminMode && (
            <button
              type="button"
              onClick={handleEnterAdminMode}
              className="w-full min-h-[40px] flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                담당자 관리 모드
              </span>
              {pendingLoanCount > 0 && (
                <span className="font-mono font-bold text-amber-700 tabular-nums">
                  승인 {pendingLoanCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Desktop Breadcrumb + Mobile Compact Header <= 56px) */}
        <header className="h-14 lg:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="메뉴 열기"
              className="lg:hidden p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {SECTION_TITLES[activeNav]}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setAdminMode(false);
                handleSelectNav('notifications');
              }}
              aria-label="알림 보기"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg whitespace-nowrap cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">알림</span>
              {unreadCount > 0 && (
                <span className="font-mono text-xs font-bold text-blue-700 tabular-nums">
                  ({unreadCount})
                </span>
              )}
            </button>
            <span className="hidden sm:inline text-sm text-slate-600 font-medium whitespace-nowrap">
              {userProfile.name}님
              {adminMode ? ' · 담당자 관리 모드' : ''}
            </span>
          </div>
        </header>

        {/* Toast Feedback Banner */}
        {toastMessage && (
          <div className="px-4 sm:px-6 lg:px-8 pt-4">
            <div
              role="status"
              className="max-w-[1200px] mx-auto p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-sm text-emerald-900"
            >
              <div className="flex items-center gap-2.5 font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                aria-label="알림 닫기"
                className="p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1200px] mx-auto">
            {activeNav === 'dashboard' && (
              <DashboardView
                user={userProfile}
                rooms={rooms}
                roomSlots={roomSlots}
                equipment={equipment}
                myReservations={myReservations}
                myLoans={myLoans}
                notifications={combinedNotifications}
                policies={policies}
                selectedDate={selectedDate}
                startHour={startHour}
                endHour={endHour}
                onDateChange={setSelectedDate}
                onStartHourChange={setStartHour}
                onEndHourChange={setEndHour}
                onNavigate={handleSelectNav}
                onQuickBookRoom={(room) => {
                  setQuickModalRoom(room);
                  setActiveNav('rooms');
                }}
                onQuickLoanEquipment={(item) => {
                  setQuickModalEquipment(item);
                  setActiveNav('equipment');
                }}
              />
            )}

            {activeNav === 'rooms' && (
              <RoomsView
                user={userProfile}
                rooms={rooms}
                roomSlots={roomSlots}
                policies={policies}
                selectedDate={selectedDate}
                startHour={startHour}
                endHour={endHour}
                initialModalRoom={quickModalRoom}
                onClearInitialModalRoom={() => setQuickModalRoom(null)}
                onDateChange={setSelectedDate}
                onStartHourChange={setStartHour}
                onEndHourChange={setEndHour}
                onBookingSuccess={showToast}
              />
            )}

            {activeNav === 'equipment' && (
              <EquipmentView
                user={userProfile}
                equipment={equipment}
                myLoans={myLoans}
                policies={policies}
                initialModalItem={quickModalEquipment}
                onClearInitialModalItem={() => setQuickModalEquipment(null)}
                onLoanSuccess={showToast}
              />
            )}

            {activeNav === 'my-bookings' && (
              <MyBookingsView
                user={userProfile}
                myReservations={myReservations}
                myLoans={myLoans}
                policies={policies}
                onNavigate={handleSelectNav}
                onActionSuccess={showToast}
              />
            )}

            {activeNav === 'notifications' && (
              <NotificationsView notifications={combinedNotifications} />
            )}

            {activeNav === 'admin-facility' && isAdmin && (
              <AdminFacilityView
                admin={userProfile}
                rooms={rooms}
                equipment={equipment}
                allReservations={allReservations}
                allLoans={allLoans}
                activityLogs={activityLogs}
                policies={policies}
                onActionSuccess={showToast}
              />
            )}

            {activeNav === 'admin-users' && isAdmin && (
              <AdminUsersView
                admin={userProfile}
                users={allUsers}
                invitedUsers={invitedUsers}
                onActionSuccess={showToast}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-10">
            <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Building2 className="w-5 h-5 text-blue-700" />
                <span>서울교육센터</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="메뉴 닫기"
                className="p-2 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {!adminMode ? (
                employeeNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelectNav(item.key)}
                      className={`w-full min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[15px] font-semibold cursor-pointer ${
                        active ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </span>
                      {item.count !== undefined && item.count > 0 && (
                        <span className="text-xs font-mono font-bold text-blue-700">
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={handleExitAdminMode}
                    className="w-full min-h-[44px] flex items-center gap-2.5 px-3.5 py-2 mb-3 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    직원 화면으로 돌아가기
                  </button>
                  <div className="px-3.5 pb-1 text-xs font-semibold text-slate-400">
                    시설 담당자 관리 모드
                  </div>
                  {adminNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeNav === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSelectNav(item.key)}
                        className={`w-full min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[15px] font-semibold cursor-pointer ${
                          active ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                        }`}
                      >
                        <span className="inline-flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </span>
                        {item.count !== undefined && item.count > 0 && (
                          <span className="text-xs font-mono font-bold text-amber-700">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-2.5">
              <div className="text-sm font-bold text-slate-900">
                {userProfile.name}님
              </div>
              {isAdmin && !adminMode && (
                <button
                  type="button"
                  onClick={handleEnterAdminMode}
                  className="w-full min-h-[42px] flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    담당자 관리 모드
                  </span>
                  {pendingLoanCount > 0 && (
                    <span className="font-mono font-bold text-amber-700">
                      승인 {pendingLoanCount}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
