import { ArrowLeft, ArrowRight, Grid2X2, Mic, Sparkles } from "lucide-react";
import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="오디세이 홈">
      <span>★</span> ODYSSEY
    </Link>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <div>
        <Brand />
        <p className="brand-sub">라이프 디자인 저널</p>
      </div>
      <nav>
        <Link className="login-link" href="/login">
          로그인
        </Link>
        <Link className="button board-link" href="/board">
          <Grid2X2 size={17} /> 내 보드로
        </Link>
      </nav>
    </header>
  );
}
export function StartLink({
  children = "내 이야기 시작하기",
}: {
  children?: React.ReactNode;
}) {
  return (
    <Link className="button primary start-link" href="/interview">
      <Mic size={21} />
      {children}
      <ArrowRight className="start-arrow" size={20} />
    </Link>
  );
}
export function BackLink({
  href = "/",
  children = "처음으로",
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link className="button" href={href}>
      <ArrowLeft size={17} />
      {children}
    </Link>
  );
}
export function LoadingState() {
  return (
    <div className="empty-state" role="status">
      <Sparkles className="spin" />
      <h2>삶의 조각을 모으고 있어요</h2>
      <p>잠시만 기다려 주세요.</p>
    </div>
  );
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h2>불러오지 못했어요</h2>
      <p>잠시 후 다시 시도해 주세요.</p>
      <button className="button primary" onClick={retry} type="button">
        다시 시도
      </button>
    </div>
  );
}
