import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CalendarX,
  CheckCheck,
  CheckCircle2,
  Clock,
  PackageCheck,
  XCircle,
} from 'lucide-react';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../lib/facilityService';
import type { AppNotification, NotificationType } from '../types/facility';

interface NotificationsViewProps {
  notifications: AppNotification[];
}

function getNotifIcon(type: NotificationType) {
  switch (type) {
    case 'room_booked':
      return <CalendarCheck className="w-5 h-5 text-emerald-700 shrink-0" />;
    case 'room_cancelled':
      return <CalendarX className="w-5 h-5 text-slate-600 shrink-0" />;
    case 'loan_requested':
      return <Clock className="w-5 h-5 text-amber-700 shrink-0" />;
    case 'loan_approved':
      return <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />;
    case 'loan_rejected':
      return <XCircle className="w-5 h-5 text-red-700 shrink-0" />;
    case 'return_due':
      return <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />;
    case 'loan_returned':
      return <PackageCheck className="w-5 h-5 text-blue-700 shrink-0" />;
  }
}

function formatTimestamp(n: AppNotification): string {
  const ts = n.created_at;
  if (!ts || typeof ts.toDate !== 'function') return '방금 전';
  const dt = ts.toDate();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

export function NotificationsView({ notifications }: NotificationsViewProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...notifications].sort((a, b) => {
      const ta = a.created_at?.toMillis?.() ?? Date.now();
      const tb = b.created_at?.toMillis?.() ?? Date.now();
      return tb - ta;
    });
    return filter === 'unread' ? copy.filter((n) => !n.is_read) : copy;
  }, [notifications, filter]);

  const unreadIds = useMemo(
    () => notifications.filter((n) => !n.is_read).map((n) => n.notification_id),
    [notifications],
  );

  const handleMarkAll = async () => {
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead(unreadIds);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">알림 센터</h2>
          <p className="text-sm text-slate-600 mt-1">
            회의실 예약·취소, 비품 대여 신청·승인·거절, 반납 예정 및 완료 알림이 실시간으로 기록됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`min-h-[36px] px-3 py-1 text-sm font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`min-h-[36px] px-3 py-1 text-sm font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                filter === 'unread'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              읽지 않음 ({unreadIds.length})
            </button>
          </div>

          <button
            type="button"
            disabled={unreadIds.length === 0 || markingAll}
            onClick={handleMarkAll}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg whitespace-nowrap cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            모두 읽음
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {sorted.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-[15px]">
              {filter === 'unread' ? '읽지 않은 알림이 없습니다.' : '표시할 알림이 없습니다.'}
            </p>
          </div>
        ) : (
          sorted.map((item) => (
            <div
              key={item.notification_id}
              className={`p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors ${
                item.is_read ? 'bg-white' : 'bg-blue-50/40'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="mt-0.5">{getNotifIcon(item.type)}</div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-slate-900">{item.title}</h3>
                    <span className="text-xs font-semibold text-slate-500">
                      {item.is_read ? '읽음' : '읽지 않음'}
                    </span>
                    {item.target_scope === 'admin' && (
                      <span className="text-xs font-semibold text-blue-700">· 담당자 알림</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{item.message}</p>
                  <p className="text-xs text-slate-400 font-mono tabular-nums">
                    {formatTimestamp(item)}
                  </p>
                </div>
              </div>

              {!item.is_read && (
                <button
                  type="button"
                  onClick={() => void markNotificationAsRead(item.notification_id)}
                  className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  읽음 표시
                </button>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
