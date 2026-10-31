import { BackLink, Brand } from "../components/ui";
export default function NotFound() {
  return (
    <main className="not-found">
      <Brand />
      <span className="error-number">404</span>
      <h1>아직 그려지지 않은 페이지예요</h1>
      <p className="quiet">새로운 이야기는 첫 페이지에서 시작해 보세요.</p>
      <BackLink />
    </main>
  );
}
