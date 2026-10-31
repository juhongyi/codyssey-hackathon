"use client";
import { ArrowRight, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BackLink, Brand } from "../../components/ui";

export default function Login() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <main className="login-page">
      <div className="login-top">
        <Brand />
        <BackLink />
      </div>
      <section className="paper login-card">
        <span className="pill sage">
          <LockKeyhole size={16} /> 나만의 이야기를 이어가요
        </span>
        <h1>다시 만나 반가워요.</h1>
        <p className="quiet">나만의 다음 장을 펼쳐볼까요?</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="hello@example.com"
            required
          />
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호를 입력해 주세요"
            required
            minLength={8}
          />
          <button className="button primary" type="submit">
            로그인 <ArrowRight size={18} />
          </button>
        </form>
        {submitted && (
          <div className="login-feedback" role="status">
            <p>로그인 연동은 준비 중이에요.</p>
            <Link className="button" href="/board">
              라이프 보드 둘러보기 <ArrowRight size={17} />
            </Link>
          </div>
        )}
        <Link className="text-link" href="/interview">
          로그인 없이 내 이야기 시작하기 →
        </Link>
      </section>
      <p className="login-foot quiet">
        조금 다른 미래를 상상하는 일, 여기서부터.
      </p>
    </main>
  );
}
