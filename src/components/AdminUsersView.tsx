import React, { useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  KeyRound,
  Mail,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import { FIREBASE_CONSOLE_AUTH_URL } from '../lib/firebase';
import {
  deleteInvitedUser,
  issueGoogleInvitedAccount,
  issuePasswordEmployeeAccount,
  triggerPasswordResetEmail,
  updateEmployeeAccount,
} from '../lib/facilityService';
import type { InvitedUser, UserProfile, UserRole } from '../types/facility';
import { StatusIndicator } from './StatusIndicator';

interface AdminUsersViewProps {
  admin: UserProfile;
  users: UserProfile[];
  invitedUsers: InvitedUser[];
  onActionSuccess: (message: string) => void;
}

export function AdminUsersView({
  admin,
  users,
  invitedUsers,
  onActionSuccess,
}: AdminUsersViewProps) {
  const [issueMode, setIssueMode] = useState<'password' | 'google'>('password');
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsEmailProviderSetup, setNeedsEmailProviderSetup] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const handleIssueAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNeedsEmailProviderSetup(false);
    setSubmitting(true);

    try {
      if (issueMode === 'password') {
        await issuePasswordEmployeeAccount(admin, {
          name,
          loginId,
          initialPassword,
          department,
          role,
        });
        onActionSuccess(
          `${name} (${loginId}) 직원 계정이 발급되었습니다. 초기 비밀번호는 별도 안전 경로로 전달해 주세요.`,
        );
      } else {
        await issueGoogleInvitedAccount(admin, {
          name,
          loginId,
          email,
          department,
          role,
        });
        onActionSuccess(
          `${name} (${email}) Google 사내 계정이 사전 발급되었습니다. 해당 직원이 Google 로그인하면 즉시 활성화됩니다.`,
        );
      }

      setName('');
      setLoginId('');
      setEmail('');
      setInitialPassword('');
      setDepartment('');
      setRole('employee');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/configuration-not-found'
      ) {
        setNeedsEmailProviderSetup(true);
        setErrorMsg(
          '아이디/비밀번호 계정 발급을 사용하려면 Firebase 콘솔에서 "이메일/비밀번호" 로그인 방식을 먼저 활성화해야 합니다. (또는 아래 "Google 사내 이메일 사전 등록" 탭으로 즉시 발급할 수 있습니다.)',
        );
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('이미 발급된 아이디입니다. 다른 로그인 아이디를 입력해 주세요.');
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : '직원 계정 발급 중 오류가 발생했습니다.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (target: UserProfile) => {
    setErrorMsg(null);
    setBusyUid(target.user_id);
    try {
      const nextStatus = target.status === 'active' ? 'inactive' : 'active';
      await updateEmployeeAccount(admin, target, { status: nextStatus });
      onActionSuccess(
        `${target.name} 계정을 ${nextStatus === 'active' ? '활성화' : '비활성화'}했습니다.`,
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '계정 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleRole = async (target: UserProfile) => {
    setErrorMsg(null);
    setBusyUid(target.user_id);
    try {
      const nextRole: UserRole = target.role === 'admin' ? 'employee' : 'admin';
      await updateEmployeeAccount(admin, target, { role: nextRole });
      onActionSuccess(
        `${target.name}님의 권한을 ${nextRole === 'admin' ? '시설 담당자' : '일반 직원'}으로 변경했습니다.`,
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '권한 변경 중 오류가 발생했습니다.');
    } finally {
      setBusyUid(null);
    }
  };

  const handlePasswordReset = async (target: UserProfile) => {
    setErrorMsg(null);
    if (target.email.endsWith('.internal')) {
      setErrorMsg(
        `사내 전용 아이디(${target.login_id})는 실제 이메일 주소가 아니므로 재설정 메일을 보낼 수 없습니다. 실제 이메일 아이디로 발급하거나 Firebase 콘솔에서 비밀번호를 재설정해 주세요.`,
      );
      return;
    }
    setBusyUid(target.user_id);
    try {
      await triggerPasswordResetEmail(target.email);
      onActionSuccess(`${target.email}로 안전한 비밀번호 재설정 안내 메일을 발송했습니다.`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : '비밀번호 재설정 메일 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setBusyUid(null);
    }
  };

  const pendingInvites = invitedUsers.filter((i) => i.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Issue New Employee Account Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">직원 계정 발급 및 관리</h2>
            <p className="text-sm text-slate-600 mt-1">
              직원이 직접 회원가입할 수 없으며, 시설 담당자가 발급한 계정만 접속할 수 있습니다. 비밀번호 원문은 데이터베이스에 저장하지 않습니다.
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => {
                setIssueMode('password');
                setErrorMsg(null);
                setNeedsEmailProviderSetup(false);
              }}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                issueMode === 'password'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              아이디 · 초기 비밀번호 발급
            </button>
            <button
              type="button"
              onClick={() => {
                setIssueMode('google');
                setErrorMsg(null);
                setNeedsEmailProviderSetup(false);
              }}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                issueMode === 'google'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-4 h-4" />
              Google 사내 이메일 발급
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" />
              <p>{errorMsg}</p>
            </div>
            {needsEmailProviderSetup && (
              <div className="pl-6 text-xs text-red-700 space-y-1">
                <a
                  href={FIREBASE_CONSOLE_AUTH_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold underline hover:text-red-900"
                >
                  Firebase 콘솔에서 이메일/비밀번호 제공업체 활성화하기
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleIssueAccount} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              직원 이름 *
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김민수"
              className="w-full min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              로그인 아이디 *
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="예: kim.minsu"
              className="w-full min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>

          {issueMode === 'password' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                초기 비밀번호 (6자 이상, DB 미저장) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="초기 비밀번호 설정"
                className="w-full min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                사내 Google 이메일 *
              </label>
              <input
                type="email"
                required
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="예: minsu.kim@company.com"
                className="w-full min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              부서 (선택)
            </label>
            <input
              type="text"
              maxLength={60}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="예: 기획운영팀"
              className="w-full min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              권한 구분 *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="employee">일반 직원</option>
              <option value="admin">시설 담당자</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              {submitting ? '계정 발급 중...' : '직원 계정 신규 발급'}
            </button>
          </div>
        </form>
      </section>

      {/* Pending Google Invitations */}
      {pendingInvites.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4">
            첫 로그인 대기 중인 Google 사전 발급 계정 ({pendingInvites.length}명)
          </h3>
          <div className="divide-y divide-slate-100">
            {pendingInvites.map((inv) => (
              <div
                key={inv.invite_id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="text-sm">
                  <span className="font-bold text-slate-900">{inv.name}</span>
                  <span className="text-slate-500 ml-2 font-mono">{inv.login_id}</span>
                  <span className="text-slate-500 ml-2 font-mono text-xs">({inv.email})</span>
                  <span className="text-xs font-semibold text-blue-700 ml-2">
                    {inv.role === 'admin' ? '시설 담당자' : '일반 직원'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIndicator state="pending" customLabel="첫 로그인 대기" />
                  <button
                    type="button"
                    onClick={() => void deleteInvitedUser(admin, inv.invite_id)}
                    className="p-2 text-slate-400 hover:text-red-700 rounded-lg cursor-pointer"
                    title="발급 철회"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Registered Employees List */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">
            발급된 직원 계정 목록 ({users.length}명)
          </h3>
          <span className="text-xs text-slate-500">
            활성 {users.filter((u) => u.status === 'active').length}명 · 비활성{' '}
            {users.filter((u) => u.status === 'inactive').length}명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-2.5 pr-4 font-semibold">이름 / 부서</th>
                <th className="py-2.5 pr-4 font-semibold">아이디</th>
                <th className="py-2.5 pr-4 font-semibold">권한</th>
                <th className="py-2.5 pr-4 font-semibold">상태</th>
                <th className="py-2.5 font-semibold text-right">계정 관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.user_id === admin.user_id;
                return (
                  <tr key={u.user_id}>
                    <td className="py-3.5 pr-4">
                      <div className="font-bold text-slate-900">
                        {u.name}
                        {isSelf && (
                          <span className="ml-1.5 text-xs font-semibold text-blue-700">(본인)</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{u.department || '일반부서'}</div>
                    </td>
                    <td className="py-3.5 pr-4 font-mono text-slate-700">
                      <div>{u.login_id}</div>
                      {!u.email.endsWith('.internal') && (
                        <div className="text-xs text-slate-400">{u.email}</div>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        {u.role === 'admin' ? (
                          <>
                            <ShieldCheck className="w-4 h-4 text-blue-700" />
                            시설 담당자
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 text-slate-500" />
                            일반 직원
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <StatusIndicator
                        state={u.status === 'active' ? 'available' : 'unavailable'}
                        customLabel={u.status === 'active' ? '활성' : '비활성'}
                      />
                    </td>
                    <td className="py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              disabled={busyUid === u.user_id}
                              onClick={() => handleToggleRole(u)}
                              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 hover:bg-slate-50 rounded-md text-slate-700 cursor-pointer"
                            >
                              {u.role === 'admin' ? '일반 직원으로' : '담당자 지정'}
                            </button>
                            <button
                              type="button"
                              disabled={busyUid === u.user_id}
                              onClick={() => handleToggleActive(u)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border rounded-md cursor-pointer ${
                                u.status === 'active'
                                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                                  : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                              }`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                              {u.status === 'active' ? '비활성화' : '활성화'}
                            </button>
                          </>
                        )}
                        {!u.email.endsWith('.internal') && (
                          <button
                            type="button"
                            disabled={busyUid === u.user_id}
                            onClick={() => handlePasswordReset(u)}
                            className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 hover:bg-slate-50 rounded-md text-slate-600 cursor-pointer"
                            title="비밀번호 재설정 메일 발송"
                          >
                            비밀번호 재설정
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
