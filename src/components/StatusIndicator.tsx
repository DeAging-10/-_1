import { Ban, CheckCircle2, Clock, Lock } from 'lucide-react';

export type SemanticState =
  | 'available'
  | 'booked'
  | 'rented'
  | 'pending'
  | 'unavailable'
  | 'rejected'
  | 'returned'
  | 'cancelled';

const CONFIG: Record<
  SemanticState,
  {
    label: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
    icon: typeof CheckCircle2;
  }
> = {
  available: {
    label: '이용 가능',
    textClass: 'text-emerald-800',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    icon: CheckCircle2,
  },
  booked: {
    label: '예약 완료',
    textClass: 'text-slate-700',
    bgClass: 'bg-slate-100',
    borderClass: 'border-slate-200',
    icon: Lock,
  },
  rented: {
    label: '대여 중',
    textClass: 'text-slate-700',
    bgClass: 'bg-slate-100',
    borderClass: 'border-slate-200',
    icon: Lock,
  },
  pending: {
    label: '승인 대기',
    textClass: 'text-amber-800',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    icon: Clock,
  },
  unavailable: {
    label: '이용 불가',
    textClass: 'text-red-700',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    icon: Ban,
  },
  rejected: {
    label: '거절됨',
    textClass: 'text-red-700',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    icon: Ban,
  },
  returned: {
    label: '반납 완료',
    textClass: 'text-emerald-800',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    icon: CheckCircle2,
  },
  cancelled: {
    label: '취소됨',
    textClass: 'text-slate-600',
    bgClass: 'bg-slate-100',
    borderClass: 'border-slate-200',
    icon: Ban,
  },
};

export function StatusIndicator({
  state,
  customLabel,
}: {
  state: SemanticState;
  customLabel?: string;
}) {
  const cfg = CONFIG[state];
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border whitespace-nowrap shrink-0 ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{customLabel ?? cfg.label}</span>
    </span>
  );
}
