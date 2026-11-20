import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Laptop,
  MapPin,
  Tablet,
  X,
} from 'lucide-react';
import { requestEquipmentLoan } from '../lib/facilityService';
import {
  getEquipmentTypeLabel,
  getMaxLoanDueDate,
  getTodayYMD,
  validateEquipmentLoanPolicy,
} from '../lib/policies';
import type {
  Equipment,
  EquipmentLoan,
  EquipmentType,
  PolicySettings,
  UserProfile,
} from '../types/facility';
import { StatusIndicator, type SemanticState } from './StatusIndicator';

interface EquipmentViewProps {
  user: UserProfile;
  equipment: Equipment[];
  myLoans: EquipmentLoan[];
  policies: PolicySettings;
  initialModalItem: Equipment | null;
  onClearInitialModalItem: () => void;
  onLoanSuccess: (message: string) => void;
}

function EquipmentIcon({ type }: { type: EquipmentType }) {
  switch (type) {
    case 'laptop':
      return <Laptop className="w-5 h-5 text-blue-700" />;
    case 'tablet':
      return <Tablet className="w-5 h-5 text-blue-700" />;
    case 'camera':
      return <Camera className="w-5 h-5 text-blue-700" />;
  }
}

export function EquipmentView({
  user,
  equipment,
  myLoans,
  policies,
  initialModalItem,
  onClearInitialModalItem,
  onLoanSuccess,
}: EquipmentViewProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | EquipmentType>('all');
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(initialModalItem);

  const today = getTodayYMD();
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [dueDate, setDueDate] = useState(() => getMaxLoanDueDate(today, policies));
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedLoanNumber, setSubmittedLoanNumber] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialModalItem) {
      openLoanModal(initialModalItem);
      onClearInitialModalItem();
    }
  }, [initialModalItem, onClearInitialModalItem]);

  const openLoanModal = (item: Equipment) => {
    const t = getTodayYMD();
    setSelectedItem(item);
    setStartDate(t);
    setStartTime('09:00');
    setDueDate(getMaxLoanDueDate(t, policies));
    setPurpose('');
    setSubmitError(null);
    setSubmittedLoanNumber(null);
  };

  const myPendingEquipmentIds = useMemo(() => {
    return new Set(
      myLoans
        .filter((l) => l.approval_status === 'pending')
        .map((l) => l.equipment_id),
    );
  }, [myLoans]);

  const filteredItems = useMemo(() => {
    return equipment
      .filter((item) => (typeFilter === 'all' ? true : item.type === typeFilter))
      .sort((a, b) => a.equipment_id.localeCompare(b.equipment_id));
  }, [equipment, typeFilter]);

  const maxDueDate = getMaxLoanDueDate(startDate, policies);
  const loanValidation = validateEquipmentLoanPolicy(startDate, dueDate, policies);

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await requestEquipmentLoan({
        user,
        equipment: selectedItem,
        startDate,
        startTime,
        dueDate,
        purpose,
        policies,
      });
      setSubmittedLoanNumber(selectedItem.management_number);
      onLoanSuccess(
        `${selectedItem.management_number} 대여 신청이 접수되었습니다. 시설 담당자 승인 후 수령해 주세요.`,
      );
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : '비품 대여 신청 중 오류가 발생했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const counts = {
    all: equipment.length,
    laptop: equipment.filter((e) => e.type === 'laptop').length,
    tablet: equipment.filter((e) => e.type === 'tablet').length,
    camera: equipment.filter((e) => e.type === 'camera').length,
  };

  const dayModeText =
    policies.loan_day_calc_mode === 'business'
      ? `영업일 기준 최대 ${policies.max_loan_days}일`
      : `달력일 기준 최대 ${policies.max_loan_days}일`;

  return (
    <div className="space-y-6">
      {/* Header & Category Filter */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">공용 비품 현황 및 대여 신청</h2>
            <p className="text-sm text-slate-600 mt-1">
              모든 공용 비품은 <strong>7층 창고</strong>에 보관됩니다. 대여 신청 후 시설 담당자 승인이 완료되면 사용하실 수 있습니다. ({dayModeText})
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { key: 'all', label: `전체 (${counts.all})` },
                { key: 'laptop', label: `노트북 (${counts.laptop})` },
                { key: 'tablet', label: `태블릿 (${counts.tablet})` },
                { key: 'camera', label: `카메라 (${counts.camera})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={`min-h-[38px] px-3.5 py-1.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  typeFilter === tab.key
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Equipment Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isMyPending = myPendingEquipmentIds.has(item.equipment_id);
          let semanticState: SemanticState = item.status;
          let customLabel: string | undefined;

          if (item.status === 'available' && isMyPending) {
            semanticState = 'pending';
            customLabel = '승인 대기 (본인 신청)';
          }

          const canApply = item.status === 'available' && !isMyPending;

          return (
            <article
              key={item.equipment_id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <EquipmentIcon type={item.type} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 font-mono">
                        {item.management_number}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {getEquipmentTypeLabel(item.type)}
                      </p>
                    </div>
                  </div>
                  <StatusIndicator state={semanticState} customLabel={customLabel} />
                </div>

                <div className="space-y-2 text-sm text-slate-600 pb-4 border-b border-slate-100 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      보관 장소
                    </span>
                    <span className="font-semibold text-slate-800">{item.storage_location}</span>
                  </div>

                  {item.status === 'rented' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">현재 대여자</span>
                        <span className="font-semibold text-slate-800">
                          {item.current_borrower_name || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">반납 예정일</span>
                        <span className="font-semibold text-slate-900 font-mono tabular-nums">
                          {item.current_due_at || '-'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={!canApply}
                onClick={() => openLoanModal(item)}
                className={`w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  canApply
                    ? 'bg-blue-700 hover:bg-blue-800 text-white cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {canApply
                  ? '대여 신청하기'
                  : isMyPending
                    ? '승인 대기 중'
                    : item.status === 'rented'
                      ? '현재 대여 중'
                      : '이용 불가'}
              </button>
            </article>
          );
        })}
      </section>

      {/* Screen ⑥: Equipment Loan Application Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loan-modal-title"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 id="loan-modal-title" className="text-xl font-bold text-slate-900">
                  {submittedLoanNumber ? '대여 신청이 접수되었습니다' : '공용 비품 대여 신청'}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5 font-mono">
                  {selectedItem.management_number} · {getEquipmentTypeLabel(selectedItem.type)} ·{' '}
                  {selectedItem.storage_location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                aria-label="닫기"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submittedLoanNumber ? (
              <div className="pt-6 space-y-5">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-950 space-y-1">
                    <p className="font-bold">시설 담당자 승인 대기 상태입니다.</p>
                    <p>
                      {submittedLoanNumber} ({startDate} ~ {dueDate}) 신청이 담당자에게 전달되었습니다. 승인 결과는 앱 내부 알림으로 안내됩니다.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="min-h-[44px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitLoan} className="pt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="loan-start-date"
                      className="block text-xs font-semibold text-slate-600 mb-1.5"
                    >
                      대여 시작일
                    </label>
                    <input
                      id="loan-start-date"
                      type="date"
                      min={today}
                      value={startDate}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setStartDate(nextStart);
                        const nextMax = getMaxLoanDueDate(nextStart, policies);
                        if (dueDate < nextStart || dueDate > nextMax) {
                          setDueDate(nextMax);
                        }
                      }}
                      className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="loan-start-time"
                      className="block text-xs font-semibold text-slate-600 mb-1.5"
                    >
                      수령 예정 시간
                    </label>
                    <select
                      id="loan-start-time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                    >
                      {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="loan-due-date"
                    className="block text-xs font-semibold text-slate-600 mb-1.5"
                  >
                    반납 예정일 ({dayModeText}, 최대 {maxDueDate})
                  </label>
                  <input
                    id="loan-due-date"
                    type="date"
                    min={startDate}
                    max={maxDueDate}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="loan-purpose"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    사용 목적 (선택)
                  </label>
                  <input
                    id="loan-purpose"
                    type="text"
                    maxLength={160}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="예: 외부 고객사 미팅 발표용"
                    className="w-full min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-lg text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
                  대여 신청 시 <strong>승인 대기</strong> 상태로 등록되며, 시설 담당자가 승인한 후 7층 창고에서 비품을 수령할 수 있습니다.
                </div>

                {(!loanValidation.valid || submitError) && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-sm text-red-800">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" />
                    <span>{submitError ?? loanValidation.reason}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="min-h-[44px] px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !loanValidation.valid}
                    className="min-h-[44px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {submitting ? '신청 접수 중...' : '대여 신청하기'}
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
