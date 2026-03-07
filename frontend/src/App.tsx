import { useEffect, useRef, useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapError("Google Maps APIキーが設定されていません（VITE_GOOGLE_MAPS_API_KEY）。");
      return;
    }

    const initMap = () => {
      if (!navigator.geolocation) {
        setMapError("このブラウザは位置情報取得に対応していません。");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const center = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setCurrentPosition(center);

          const g = (window as any).google;
          if (!g?.maps || !mapContainerRef.current) {
            setMapError("Google Maps の初期化に失敗しました。");
            return;
          }

          const map = new g.maps.Map(mapContainerRef.current, {
            center,
            zoom: 15,
          });

          // 現在地ピン
          new g.maps.Marker({
            position: center,
            map,
            title: "現在地",
          });
        },
        (err) => {
          console.error(err);
          setMapError("現在地を取得できませんでした。位置情報の許可を確認してください。");
        },
      );
    };

    const existingScript = document.getElementById("google-maps-script") as HTMLScriptElement | null;
    if ((window as any).google?.maps) {
      initMap();
      return;
    }

    if (existingScript) {
      existingScript.addEventListener("load", initMap);
      return () => existingScript.removeEventListener("load", initMap);
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = initMap;
    script.onerror = () => {
      setMapError("Google Maps の読み込みに失敗しました。");
    };
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, []);

  const handleSignUp = async () => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setEmail("");
      setPassword("");
    } catch (e: any) {
      setAuthError(e.message ?? "サインアップに失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setPassword("");
    } catch (e: any) {
      setAuthError(e.message ?? "ログインに失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (e: any) {
      setAuthError(e.message ?? "ログアウトに失敗しました");
    }
  };

  return (
    <main style={{ fontFamily: "sans-serif", margin: "2rem auto", maxWidth: 640 }}>
      <h1>ShokuGenMAP</h1>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>認証（Firebase Auth）</h2>

        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: "0.4rem", marginTop: "0.25rem" }}
            />
          </label>

          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "0.4rem", marginTop: "0.25rem" }}
            />
          </label>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button onClick={handleSignUp} disabled={isSubmitting}>
              会員登録
            </button>
            <button onClick={handleSignIn} disabled={isSubmitting}>
              ログイン
            </button>
            {currentUser && (
              <button onClick={handleSignOut} disabled={isSubmitting}>
                ログアウト
              </button>
            )}
          </div>

          {authError && (
            <p style={{ color: "red", marginTop: "0.5rem" }}>
              エラー: {authError}
            </p>
          )}

          <div style={{ marginTop: "1rem", padding: "0.75rem", border: "1px solid #ddd" }}>
            <strong>現在のログイン状態:</strong>
            {currentUser ? (
              <div>
                <div>UID: {currentUser.uid}</div>
                <div>Email: {currentUser.email}</div>
              </div>
            ) : (
              <div>未ログイン</div>
            )}
          </div>
        </div>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Google Maps（現在地）</h2>
        {mapError && (
          <p style={{ color: "red", marginTop: "0.5rem" }}>
            エラー: {mapError}
          </p>
        )}
        {currentPosition && (
          <p style={{ marginTop: "0.5rem" }}>
            現在地: lat {currentPosition.lat.toFixed(5)}, lng {currentPosition.lng.toFixed(5)}
          </p>
        )}
        <div
          ref={mapContainerRef}
          style={{
            marginTop: "0.75rem",
            width: "100%",
            height: "320px",
            border: "1px solid #ddd",
            borderRadius: "8px",
          }}
        />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>バックエンド疎通</h2>
        <p>
          API Base URL: <code>{API_BASE_URL}</code>
        </p>
        <p>
          バックエンド疎通確認: <a href={`${API_BASE_URL}/health`}>{API_BASE_URL}/health</a>
        </p>
      </section>
    </main>
  );
}
