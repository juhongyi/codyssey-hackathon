import Link from "next/link";
export default function Login() {
  return (
    <main className="center-state">
      <h1>로그인은 준비 중이에요</h1>
      <p>지금은 로그인 없이 이야기를 시작할 수 있어요.</p>
      {/* Authentication is intentionally unimplemented. */}
      <button type="button" className="button" disabled>
        로그인 준비 중
      </button>
      <Link href="/" className="button primary">
        첫 화면으로
      </Link>
    </main>
  );
}
