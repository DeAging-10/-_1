import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', isQuotaError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    let displayMsg = error.message || '알 수 없는 오류가 발생했습니다.';
    let isQuotaError = false;

    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.toLowerCase().includes('quota')) {
          isQuotaError = true;
          displayMsg =
            'Cloud Firestore 일일 무료 할당량이 초과되었습니다. 다음 날 할당량이 초기화되거나 Firebase 콘솔에서 요금제를 업그레이드해 주세요.';
        } else if (parsed.error.toLowerCase().includes('permission')) {
          displayMsg = `접근 권한이 부족하거나 보안 규칙에 의해 차단되었습니다. (${parsed.operationType}: ${parsed.path ?? '알 수 없는 경로'})`;
        } else {
          displayMsg = parsed.error;
        }
      }
    } catch {
      if (displayMsg.toLowerCase().includes('quota')) {
        isQuotaError = true;
      }
    }

    return { hasError: true, message: displayMsg, isQuotaError };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-xl font-bold">
                {this.state.isQuotaError ? '데이터베이스 할당량 초과' : '화면 처리 중 오류가 발생했습니다'}
              </h1>
            </div>
            <p className="text-[15px] text-slate-600 leading-relaxed mb-6">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              페이지 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
