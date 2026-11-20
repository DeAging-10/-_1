import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  DoorOpen,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  User,
} from 'lucide-react';
import {
  FIREBASE_CONSOLE_AUTH_URL,
  auth,
  googleProvider,
  loginIdToAuthEmail,
} from '../lib/firebase';

interface LoginViewProps {
  deniedState?: { status: 'inactive' | 'unregistered'; email: string } | null;
  onClearDenied?: () => void;
}

export function LoginView({ deniedState, onClearDenied }: LoginViewProps) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsEmailProviderSetup, setNeedsEmailProviderSetup] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNeedsEmailProviderSetup(false);

    if (!loginId.trim() || !password) {
      setErrorMsg('담당자로부터 발급받은 아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const email = loginIdToAuthEmail(loginId);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/configuration-not-found'
      ) {
        setNeedsEmailProviderSetup(true);
        setErrorMsg(
          '아이디/비밀번호 로그인을 사용하려면 Firebase 콘솔에서 이메일/비밀번호 로그인 방식을 활성화해야 합니다.',
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setErrorMsg('아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setErrorMsg('로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setNeedsEmailProviderSetup(false);
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setErrorMsg('Google 로그인 중 오류가 발생했습니다. 팝업 차단을 해제하고 다시 시도해 주세요.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignOutDenied = async () => {
    await signOut(auth);
    onClearDenied?.();
  };

  if (deniedState) {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-3 text-red-700 mb-4">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <h1 className="text-xl font-bold">
              {deniedState.status === 'inactive'
                ? '비활성화된 직원 계정입니다'
                : '등록되지 않은 계정입니다'}
            </h1>
          </div>
          <p className="text-[15px] text-slate-600 leading-relaxed mb-4">
            {deniedState.status === 'inactive'
              ? `현재 계정(${deniedState.email})은 현재 비활성화 상태입니다.`
              : `로그인하신 계정(${deniedState.email})은 서울교육센터 오피스 시설매니저에 등록되어 있지 않습니다.`}
          </p>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            담당자로부터 발급받은 사내 직원 계정으로만 이용할 수 있습니다. 계정 발급 또는 활성화가 필요하시면 시설 담당자에게 문의해 주세요.
          </p>
          <button
            type="button"
            onClick={handleSignOutDenied}
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-700 hover:bg-blue-800 text-white text-[15px] font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            다른 계정으로 로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[960px]">
        {/* Centered Top Brand Title */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-700 text-white mb-4">
            <Building2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
            서울교육센터 오피스 시설매니저
          </h1>
          <p className="text-[15px] text-slate-600 mt-2">
            임직원 모두가 함께 이용하는 회의실 예약 및 공용 비품 대여 시스템
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Clean Employee Login Form (Primary Focal Anchor) */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-7 sm:p-9 flex flex-col justify-center">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">직원 로그인</h2>
              <p className="text-sm text-slate-600 mt-1">
                담당자로부터 발급받은 아이디와 비밀번호를 입력해 주세요.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" />
                  <p className="leading-relaxed">{errorMsg}</p>
                </div>
                {needsEmailProviderSetup && (
                  <div className="pl-6 pt-1 text-xs text-red-700 space-y-1">
                    <p>
                      1. 아래 링크에서 Firebase 콘솔 Authentication &gt; 로그인 방법으로 이동합니다.
                    </p>
                    <p>2. &quot;이메일/비밀번호&quot; 제공업체를 사용 설정하고 저장합니다.</p>
                    <a
                      href={FIREBASE_CONSOLE_AUTH_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold underline hover:text-red-900 mt-1"
                    >
                      Firebase 콘솔 인증 설정 열기
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="login-id"
                  className="block text-sm font-semibold text-slate-700 mb-1.5"
                >
                  아이디
                </label>
                <div className="relative">
                  <User
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-id"
                    type="text"
                    autoComplete="username"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="발급받은 아이디 입력 (예: kim.minsu)"
                    className="w-full min-h-[48px] pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-semibold text-slate-700 mb-1.5"
                >
                  비밀번호
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    className="w-full min-h-[48px] pl-10 pr-12 py-2.5 bg-white border border-slate-300 rounded-lg text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || googleLoading}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-[15px] font-semibold rounded-lg transition-colors cursor-pointer mt-2"
              >
                <KeyRound className="w-4 h-4" />
                {submitting ? '로그인 확인 중...' : '로그인'}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-slate-500">
                  또는 사전 등록된 Google 계정
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting || googleLoading}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[15px] font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              {googleLoading ? 'Google 인증 중...' : 'Google 계정으로 로그인'}
            </button>

            <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
              직접 회원가입은 제공하지 않습니다. 계정이 없거나 비밀번호를 잊으신 경우 시설 담당자에게 문의해 주세요.
            </p>
          </section>

          {/* Right: Concise Office Facility Guide */}
          <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-200">
                이용 가능 시설 안내
              </h2>

              <div className="space-y-5 mt-5">
                <div className="flex items-start gap-3">
                  <DoorOpen className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">
                      회의실 11개 즉시 예약
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      7층(회의실 1~7) · 10층(회의실 8~11)을 평일 09:00~18:00에 1시간 단위, 최대 4시간까지 바로 예약할 수 있습니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Laptop className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">
                      공용 비품 13대 대여 신청
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      7층 창고 보관 노트북 5대 · 태블릿 5대 · 카메라 3대를 최대 3일간 대여 신청할 수 있습니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarCheck className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">
                      실시간 내 예약·알림 확인
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      예약 확정·취소, 비품 승인 결과, 반납 예정일을 앱 내부 알림으로 편리하게 받아보세요.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              <div className="font-semibold text-slate-700">운영 기준</div>
              <div>월~금 09:00–18:00 (토·일·대한민국 공휴일 휴무)</div>
              <div>향후 30일 이내 예약 가능 · 중복 예약 자동 방지</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
