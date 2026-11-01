import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="오플 홈">
      <span className="brand-star">✦</span>
      <span>
        <strong>Ople</strong>
        <small>라이프 디자인 저널</small>
      </span>
    </Link>
  );
}
