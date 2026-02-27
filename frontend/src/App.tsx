const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export default function App() {
  return (
    <main style={{ fontFamily: "sans-serif", margin: "2rem auto", maxWidth: 640 }}>
      <h1>ShokuGenMAP</h1>
      <p>Docker で起動する開発環境の土台をセットアップしました。</p>
      <ul>
        <li>Frontend: React + Vite</li>
        <li>Backend: FastAPI</li>
        <li>Database: PostgreSQL</li>
      </ul>
      <p>
        API Base URL: <code>{API_BASE_URL}</code>
      </p>
      <p>
        バックエンド疎通確認: <a href={`${API_BASE_URL}/health`}>{API_BASE_URL}/health</a>
      </p>
    </main>
  );
}
