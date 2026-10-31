import Link from "next/link";
export default function NotFound() {
  return (
    <main className="center-state">
      <span className="big-mark">404</span>
      <h1>아직 쓰이지 않은 페이지예요</h1>
      <p>첫 장으로 돌아가 다시 시작해 볼까요?</p>
      <Link href="/" className="button primary">
        첫 화면으로
      </Link>
    </main>
  );
}
