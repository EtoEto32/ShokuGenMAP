import { useEffect, useRef, useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { Link } from "react-router-dom";
import { DiagnosisProvider } from "./diagnosis/DiagnosisContext";
import { FiveSecondDiagnosis } from "./diagnosis/FiveSecondDiagnosis";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const GENRE_OPTIONS = ["", "ご飯物", "ラーメン", "うどん", "そば"];

type Shop = {
  id: number;
  place_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  is_chain: boolean;
  rating: number | null;
  primary_genre?: string | null;
};

const GENRE_EMOJI: Record<string, string> = {
  ご飯物: "🍚",
  ラーメン: "🍜",
  うどん: "🍲",
  そば: "🥢",
};

function genreEmoji(genre?: string | null): string {
  if (!genre) return "🍽️";
  return GENRE_EMOJI[genre] ?? "🍽️";
}

function emojiMarkerIconDataUrl(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <circle cx="22" cy="22" r="20" fill="white" stroke="#333" stroke-width="2" />
  <text x="22" y="28" font-size="20" text-anchor="middle">${emoji}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildGoogleMapsRouteUrl(
  destination: { lat: number; lng: number },
  origin?: { lat: number; lng: number } | null,
): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "walking",
  });
  if (origin) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const currentMarkerRef = useRef<any | null>(null);
  const shopMarkersRef = useRef<any[]>([]);

  const [mapError, setMapError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [excludeChain, setExcludeChain] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState<string | null>(null);

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

          // バックエンドへ現在地を送信（POST /location/coords）
          fetch(`${API_BASE_URL}/location/coords`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(center),
          }).catch((err) => {
            console.error("座標送信に失敗しました", err);
          });

          const g = (window as any).google;
          if (!g?.maps || !mapContainerRef.current) {
            setMapError("Google Maps の初期化に失敗しました。");
            return;
          }

          mapRef.current = new g.maps.Map(mapContainerRef.current, {
            center,
            zoom: 15,
          });

          // 現在地ピン
          currentMarkerRef.current = new g.maps.Marker({
            position: center,
            map: mapRef.current,
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

  useEffect(() => {
    if (!currentPosition) {
      return;
    }

    const params = new URLSearchParams({
      lat: String(currentPosition.lat),
      lng: String(currentPosition.lng),
      exclude_chain: String(excludeChain),
    });
    if (selectedGenre) {
      params.set("genre", selectedGenre);
    }

    setShopsLoading(true);
    setShopsError(null);
    setSelectedShop(null);

    fetch(`${API_BASE_URL}/shops/nearby?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setShops((data.shops as Shop[]) ?? []);
      })
      .catch((err) => {
        console.error(err);
        setShopsError("店舗取得に失敗しました。API設定・キーを確認してください。");
      })
      .finally(() => {
        setShopsLoading(false);
      });
  }, [currentPosition, selectedGenre, excludeChain]);

  useEffect(() => {
    const g = (window as any).google;
    if (!g?.maps || !mapRef.current) {
      return;
    }

    if (currentPosition && currentMarkerRef.current) {
      currentMarkerRef.current.setPosition(currentPosition);
      mapRef.current.setCenter(currentPosition);
    }

    for (const marker of shopMarkersRef.current) {
      marker.setMap(null);
    }
    shopMarkersRef.current = [];

    for (const shop of shops) {
      const emoji = genreEmoji(shop.primary_genre || selectedGenre || undefined);
      const marker = new g.maps.Marker({
        position: { lat: shop.lat, lng: shop.lng },
        map: mapRef.current,
        title: shop.name,
        icon: {
          url: emojiMarkerIconDataUrl(emoji),
          scaledSize: new g.maps.Size(36, 36),
          anchor: new g.maps.Point(18, 18),
        },
      });
      marker.addListener("click", () => {
        setSelectedShop(shop);
      });
      shopMarkersRef.current.push(marker);
    }
  }, [shops, currentPosition, selectedGenre]);

  const handleStartRouteToSelectedShop = () => {
    if (!selectedShop) return;
    const routeUrl = buildGoogleMapsRouteUrl(
      { lat: selectedShop.lat, lng: selectedShop.lng },
      currentPosition,
    );
    window.open(routeUrl, "_blank", "noopener,noreferrer");
  };

  const handleSignUp = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail.includes("@")) {
      setAuthError("メールアドレスの形式が正しくありません。");
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      setEmail("");
      setPassword("");
    } catch (e: any) {
      setAuthError(e.message ?? "サインアップに失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail.includes("@")) {
      setAuthError("メールアドレスの形式が正しくありません。");
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
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

  const handleRunDiagnosis = async (input: {
    mood_genre: string;
    time_level: string;
    volume_level: string;
  }) => {
    if (!currentPosition) {
      throw new Error("現在地を取得してから診断を実行してください");
    }
    if (!currentUser) {
      throw new Error("ログインしてから診断を実行してください");
    }

    const idToken = await currentUser.getIdToken();

    const res = await fetch(`${API_BASE_URL}/diagnosis/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        ...input,
        lat: currentPosition.lat,
        lng: currentPosition.lng,
      }),
    });

    if (!res.ok) {
      throw new Error(`診断API呼び出しに失敗しました (HTTP ${res.status})`);
    }

    return res.json();
  };

  return (
    <DiagnosisProvider>
      <main style={{ fontFamily: "sans-serif", margin: "2rem auto", maxWidth: 640 }}>
      <h1>ShokuGenMAP</h1>
      <p style={{ marginTop: "0.25rem" }}>
        <Link to="/contact">お問い合わせ</Link>
        {" / "}
        <Link to="/profile">プロフィール</Link>
      </p>

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
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <label>
            ジャンル
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              style={{ marginLeft: "0.5rem" }}
            >
              {GENRE_OPTIONS.map((g) => (
                <option key={g || "all"} value={g}>
                  {g || "指定なし"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={excludeChain}
              onChange={(e) => setExcludeChain(e.target.checked)}
            />
            チェーン店を除外
          </label>
        </div>
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
        <p style={{ marginTop: "0.5rem" }}>
          店舗件数: {shops.length} {shopsLoading ? "(読み込み中...)" : ""}
        </p>
        {shopsError && (
          <p style={{ color: "red", marginTop: "0.5rem" }}>
            エラー: {shopsError}
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
        {selectedShop && (
          <div
            style={{
              marginTop: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "0.75rem",
              background: "#fff",
            }}
          >
            <strong>{selectedShop.name}</strong>
            <p style={{ margin: "0.4rem 0 0" }}>
              住所: {selectedShop.address || "不明"}
            </p>
            <p style={{ margin: "0.4rem 0 0" }}>
              評価: {selectedShop.rating ?? "不明"}
            </p>
            <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem" }}>
              <button onClick={handleStartRouteToSelectedShop}>ここに行く</button>
              <button onClick={() => setSelectedShop(null)}>閉じる</button>
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>5秒飯診断</h2>
        <FiveSecondDiagnosis fetchDiagnosis={handleRunDiagnosis} />
      </section>

      </main>
    </DiagnosisProvider>
  );
}
