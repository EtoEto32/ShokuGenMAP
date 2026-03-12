import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
const GENRES = ["ご飯物", "ラーメン", "うどん", "そば"];
const NONOICHI_CENTER = { lat: 36.5316, lng: 136.6232 }; // 石川県野々市市 扇が丘付近
const MAX_DISTANCE_FROM_NONOICHI_KM = 250;

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
  google_types?: string[];
  review_count?: number | null;
  price_level?: number | null;
  updated_at?: string;
};

type DiagnosisInput = {
  mood_genre: string;
  time_level: string;
  volume_level: string;
};

type DiagnosisResult = {
  recommended_shop?: {
    id?: number;
    place_id?: string;
    name?: string;
    address?: string | null;
    rating?: number | null;
    lat?: number;
    lng?: number;
    is_chain?: boolean;
    primary_genre?: string | null;
  };
  distance_km?: number;
  score?: number;
};

type BackendUser = {
  id: number;
  firebase_uid: string;
  name: string;
  like_categories: string[];
};

type RouteSummary = {
  distanceText: string;
  durationText: string;
  steps: string[];
};

type TravelModeKey = "WALKING" | "DRIVING" | "BICYCLING" | "TRANSIT";

const TRAVEL_MODE_OPTIONS: Array<{ key: TravelModeKey; label: string }> = [
  { key: "WALKING", label: "徒歩" },
  { key: "DRIVING", label: "車" },
  { key: "BICYCLING", label: "自転車" },
  { key: "TRANSIT", label: "公共交通" },
];
const TRAVEL_MODE_STORAGE_KEY = "shokugen:route:travelMode";

const DEFAULT_SHOP: Shop = {
  id: 0,
  place_id: "default-place",
  name: "特選ラーメン匠",
  address: "東京都新宿区",
  lat: 35.6895,
  lng: 139.6917,
  is_chain: false,
  rating: 4.8,
  primary_genre: "ラーメン",
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

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return earthRadiusKm * y;
}

function shouldUseNonoichiFallback(candidate: { lat: number; lng: number }): boolean {
  if (import.meta.env.VITE_FORCE_NONOICHI === "true") {
    return true;
  }
  const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
  if (!isLocalHost) {
    return false;
  }
  return distanceKm(candidate, NONOICHI_CENTER) > MAX_DISTANCE_FROM_NONOICHI_KM;
}

function normalizeCurrentPosition(candidate: { lat: number; lng: number }): { lat: number; lng: number } {
  if (shouldUseNonoichiFallback(candidate)) {
    console.warn("現在地が大きくずれていたため、野々市（扇が丘）座標を使用します。", candidate);
    return NONOICHI_CENTER;
  }
  return candidate;
}

function stripHtmlTags(value: string): string {
  const parser = document.createElement("div");
  parser.innerHTML = value;
  return (parser.textContent || parser.innerText || "").trim();
}

function travelModeLabel(mode: TravelModeKey): string {
  return TRAVEL_MODE_OPTIONS.find((v) => v.key === mode)?.label ?? "徒歩";
}

function toGoogleTravelMode(mode: TravelModeKey): "walking" | "driving" | "bicycling" | "transit" {
  if (mode === "DRIVING") return "driving";
  if (mode === "BICYCLING") return "bicycling";
  if (mode === "TRANSIT") return "transit";
  return "walking";
}

function isValidLatLng(value: { lat: number; lng: number } | null | undefined): value is { lat: number; lng: number } {
  if (!value) return false;
  return (
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lng >= -180 &&
    value.lng <= 180
  );
}

function isTravelModeKey(value: string): value is TravelModeKey {
  return TRAVEL_MODE_OPTIONS.some((option) => option.key === value);
}

async function upsertCurrentUser(user: User): Promise<BackendUser> {
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/users/me`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`ユーザー同期に失敗しました (HTTP ${res.status})`);
  }
  return res.json();
}

async function fetchCurrentUserProfile(user: User): Promise<BackendUser> {
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`ユーザー情報取得に失敗しました (HTTP ${res.status})`);
  }
  return res.json();
}

async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  if (!navigator.geolocation) {
    return NONOICHI_CENTER;
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detected = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(normalizeCurrentPosition(detected));
      },
      () => resolve(NONOICHI_CENTER),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });
}

function observeAuthState() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
    return () => unsubscribe();
  }, []);
  return currentUser;
}

function useGoogleMap(
  mapContainerRef: React.RefObject<HTMLDivElement | null>,
  onReady: (map: any) => void,
  onError: (message: string) => void,
) {
  const initializedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      onErrorRef.current("Google Maps APIキーが設定されていません。");
      return;
    }

    const boot = () => {
      if (initializedRef.current) {
        return;
      }
      const g = (window as any).google;
      if (!g?.maps || !mapContainerRef.current) {
        onErrorRef.current("Google Maps の初期化に失敗しました。");
        return;
      }
      initializedRef.current = true;
      onReadyRef.current(new g.maps.Map(mapContainerRef.current, { zoom: 15 }));
    };

    const existingScript = document.getElementById("google-maps-script") as HTMLScriptElement | null;
    if ((window as any).google?.maps) {
      boot();
      return;
    }
    if (existingScript) {
      existingScript.addEventListener("load", boot);
      return () => existingScript.removeEventListener("load", boot);
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = boot;
    script.onerror = () => onErrorRef.current("Google Maps の読み込みに失敗しました。");
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [mapContainerRef]);
}

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("メールアドレスの形式が正しくありません。");
      return;
    }
    if (!password || password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }
    setIsSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await upsertCurrentUser(cred.user);
      setName("");
      setEmail("");
      setPassword("");
      navigate("/signup/success");
    } catch (e: any) {
      setError(e.message ?? "会員登録に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-header">
        <button type="button" className="logo-chip" onClick={() => navigate("/")}>
          <span className="logo-mark">🍽️</span> FoodMap
        </button>
        <div className="auth-nav">
          <button type="button" onClick={() => navigate("/")}>ホーム</button>
          <button type="button" onClick={() => navigate("/login")}>ログイン</button>
        </div>
      </header>
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>アカウント作成</h1>
        <p>あなたにぴったりの一杯を見つけましょう</p>
        <label>
          ユーザー名
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="おいしい太郎" />
        </label>
        <label>
          メールアドレス
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@foodmap.jp" />
        </label>
        <label>
          パスワード
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8文字以上の英数字" />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="primary-btn" disabled={isSubmitting}>
          {isSubmitting ? "登録中..." : "登録する"}
        </button>
        <button type="button" className="ghost-btn" onClick={() => navigate("/login")}>ログインはこちら</button>
      </form>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await upsertCurrentUser(cred.user);
      navigate("/");
    } catch (e: any) {
      setError(e.message ?? "ログインに失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-header">
        <button type="button" className="logo-chip" onClick={() => navigate("/")}>
          <span className="logo-mark">🍽️</span> 食ジャンMAP
        </button>
      </header>
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>ログイン</h1>
        <p>診断・お気に入り機能を使うにはログインしてください。</p>
        <label>
          メールアドレス
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          パスワード
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="primary-btn" disabled={isSubmitting}>
          {isSubmitting ? "ログイン中..." : "ログイン"}
        </button>
        <button type="button" className="ghost-btn" onClick={() => navigate("/signup")}>会員登録はこちら</button>
      </form>
    </div>
  );
}

function SignupSuccessPage() {
  const navigate = useNavigate();
  return (
    <div className="auth-page">
      <div className="success-card">
        <div className="success-icon">✓</div>
        <h1>アカウント登録が完了しました！</h1>
        <p>ご登録ありがとうございます。おいしい体験を始めましょう。</p>
        <button type="button" className="primary-btn" onClick={() => navigate("/")}>ホームへ進む</button>
      </div>
    </div>
  );
}

function MapHomePage({ currentUser }: { currentUser: User | null }) {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const currentMarkerRef = useRef<any | null>(null);
  const shopMarkersRef = useRef<any[]>([]);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedGenre, setSelectedGenre] = useState("ラーメン");
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop>(DEFAULT_SHOP);
  const [excludeChain, setExcludeChain] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    if (!currentUser) {
      setProfileName("");
      return;
    }
    fetchCurrentUserProfile(currentUser)
      .then((profile) => {
        setProfileName(profile.name || "");
      })
      .catch(() => {
        setProfileName("");
      });
  }, [currentUser]);

  const handleMapReady = useCallback(async (map: any) => {
    mapRef.current = map;
    try {
      const current = await getCurrentLocation();
      setPosition(current);
      map.setCenter(current);
      currentMarkerRef.current = new (window as any).google.maps.Marker({
        position: current,
        map,
        title: "現在地",
      });

      fetch(`${API_BASE_URL}/location/coords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      }).catch(() => undefined);
    } catch (err: any) {
      setMapError(err?.message ?? "現在地を取得できませんでした。");
    }
  }, []);

  useGoogleMap(
    mapContainerRef,
    handleMapReady,
    setMapError,
  );

  useEffect(() => {
    if (!position) return;
    const params = new URLSearchParams({
      lat: String(position.lat),
      lng: String(position.lng),
      genre: selectedGenre,
      exclude_chain: String(excludeChain),
    });
    setShopsLoading(true);
    fetch(`${API_BASE_URL}/shops/nearby?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("店舗取得に失敗しました");
        return res.json();
      })
      .then((data) => {
        const fetchedShops = (data.shops as Shop[]) ?? [];
        setShops(fetchedShops);
        if (fetchedShops.length > 0) setSelectedShop(fetchedShops[0]);
      })
      .catch(() => {
        setShops([]);
      })
      .finally(() => setShopsLoading(false));
  }, [position, selectedGenre, excludeChain]);

  useEffect(() => {
    const g = (window as any).google;
    if (!g?.maps || !mapRef.current) return;
    for (const marker of shopMarkersRef.current) marker.setMap(null);
    shopMarkersRef.current = [];

    shops.forEach((shop) => {
      const marker = new g.maps.Marker({
        position: { lat: shop.lat, lng: shop.lng },
        map: mapRef.current,
        title: shop.name,
        icon: {
          url: emojiMarkerIconDataUrl(genreEmoji(shop.primary_genre || selectedGenre)),
          scaledSize: new g.maps.Size(36, 36),
          anchor: new g.maps.Point(18, 18),
        },
      });
      marker.addListener("click", () => setSelectedShop(shop));
      shopMarkersRef.current.push(marker);
    });
  }, [shops, selectedGenre]);

  return (
    <main className="map-layout">
      <div ref={mapContainerRef} className="map-canvas" />
      <div className="left-stack">
        <aside className="left-panel">
          <div className="brand-line"><span className="logo-mark">🍽️</span> 食ジャンMAP</div>
          <h2>こんにちは、{profileName || currentUser?.email?.split("@")[0] || "ユーザー"}さん！</h2>
          <p className="muted">今日の気分にぴったりの一皿を提案します。</p>
          <div className="genre-grid">
            {GENRES.map((genre) => (
              <button
                key={genre}
                type="button"
                className={`genre-chip ${selectedGenre === genre ? "active" : ""}`}
                onClick={() => setSelectedGenre(genre)}
              >
                {genre}
              </button>
            ))}
          </div>
          <label className="checkbox-line">
            <input type="checkbox" checked={excludeChain} onChange={(e) => setExcludeChain(e.target.checked)} />
            全国チェーンを除外
          </label>
          <button type="button" className="primary-btn wide" onClick={() => navigate("/diagnosis")}>
            今日の気分を診断する
          </button>
          <button type="button" className="primary-btn wide floating-nearby">
            現在地の周辺で探す
          </button>
        </aside>

        <section className="shop-card">
          <div className="shop-cover">🍜</div>
          <div className="shop-content">
            <p className="shop-meta">{selectedShop.primary_genre ?? selectedGenre} / 500m以内</p>
            <h3>{selectedShop.name}</h3>
            <p className="muted">{selectedShop.address ?? "住所情報なし"}</p>
            <p className="muted">評価: {selectedShop.rating ?? "-"} / 営業中: 22:00まで</p>
            <button
              type="button"
              className="primary-btn wide"
              onClick={() => navigate(`/route?shopId=${selectedShop.id}`, { state: { shop: selectedShop } })}
            >
              ルート案内
            </button>
            <div className="shop-actions">
              <button type="button">お気に入り</button>
              <button type="button" onClick={() => navigate(`/shops/${selectedShop.id}`, { state: { shop: selectedShop } })}>
                詳細を見る
              </button>
            </div>
            {mapError && <p className="error-text">{mapError}</p>}
            {shopsLoading && <p className="muted">店舗を読み込み中です...</p>}
          </div>
        </section>
      </div>

      <div className="top-icons">
        <button type="button" title="リロード" onClick={() => window.location.reload()}>↺</button>
        <button type="button" title="問い合わせ" onClick={() => navigate("/contact")}>✉️</button>
        <button type="button" className="mypage-pill" onClick={() => navigate("/mypage")}>マイページ</button>
      </div>
    </main>
  );
}

function DiagnosisPage({ currentUser }: { currentUser: User | null }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState("");
  const [timeLevel, setTimeLevel] = useState("30分以内");
  const [volume, setVolume] = useState("普通");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const runDiagnosis = async () => {
    setError(null);
    if (!currentUser) {
      setError("診断の実行にはログインが必要です。");
      return;
    }
    if (!mood || !timeLevel || !volume) {
      setError("すべての項目を選択してください。");
      return;
    }

    setRunning(true);
    try {
      const position = await getCurrentLocation();
      const token = await currentUser.getIdToken();
      const body: DiagnosisInput = {
        mood_genre: mood,
        time_level: timeLevel,
        volume_level: volume,
      };
      const res = await fetch(`${API_BASE_URL}/diagnosis/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...body, lat: position.lat, lng: position.lng }),
      });
      if (!res.ok) {
        throw new Error(`診断API呼び出しに失敗しました (HTTP ${res.status})`);
      }
      const result = (await res.json()) as DiagnosisResult;
      navigate("/diagnosis/result", { state: { result, input: body } });
    } catch (e: any) {
      setError(e.message ?? "診断の実行に失敗しました。");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="diagnosis-page">
      <button type="button" className="back-btn" onClick={() => navigate("/")}>← 戻る</button>
      <section className="wizard-card">
        <div className="wizard-step">STEP {step} / 3</div>
        {step === 1 && (
          <>
            <h1>今日の気分は？</h1>
            <div className="option-grid">
              {["ご飯物", "ラーメン", "パスタ", "うどん", "そば", "その他"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`wizard-option ${mood === item ? "selected" : ""}`}
                  onClick={() => setMood(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <button type="button" className="primary-btn wizard-next" onClick={() => setStep(2)} disabled={!mood}>
              次へ
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1>時間はどれくらいありますか？</h1>
            <p className="muted">今の状況に合わせてお店を提案します</p>
            <div className="option-grid three">
              {["すぐ食べたい", "30分以内", "ゆっくり"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`wizard-option ${timeLevel === item ? "selected" : ""}`}
                  onClick={() => setTimeLevel(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="wizard-actions">
              <button type="button" className="ghost-btn" onClick={() => setStep(1)}>戻る</button>
              <button type="button" className="primary-btn" onClick={() => setStep(3)}>次へ</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1>量はどのくらい？</h1>
            <div className="option-list">
              {["小腹が空いた", "普通", "お腹ペコペコ"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`wizard-row ${volume === item ? "selected" : ""}`}
                  onClick={() => setVolume(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="wizard-actions">
              <button type="button" className="ghost-btn" onClick={() => setStep(2)}>戻る</button>
              <button type="button" className="primary-btn" onClick={runDiagnosis} disabled={running}>
                {running ? "診断中..." : "結果を見る"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function DiagnosisResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as { result?: DiagnosisResult; shop?: Shop } | null)?.result;
  const stateShop = (location.state as { result?: DiagnosisResult; shop?: Shop } | null)?.shop;

  const shop = {
    id: result?.recommended_shop?.id ?? stateShop?.id ?? DEFAULT_SHOP.id,
    place_id: result?.recommended_shop?.place_id ?? stateShop?.place_id ?? DEFAULT_SHOP.place_id,
    name: result?.recommended_shop?.name ?? stateShop?.name ?? DEFAULT_SHOP.name,
    address: result?.recommended_shop?.address ?? stateShop?.address ?? DEFAULT_SHOP.address,
    rating: result?.recommended_shop?.rating ?? stateShop?.rating ?? DEFAULT_SHOP.rating,
    lat: result?.recommended_shop?.lat ?? stateShop?.lat ?? DEFAULT_SHOP.lat,
    lng: result?.recommended_shop?.lng ?? stateShop?.lng ?? DEFAULT_SHOP.lng,
    is_chain: result?.recommended_shop?.is_chain ?? stateShop?.is_chain ?? DEFAULT_SHOP.is_chain,
    primary_genre:
      result?.recommended_shop?.primary_genre ?? stateShop?.primary_genre ?? DEFAULT_SHOP.primary_genre,
  };

  return (
    <main className="result-page">
      <header className="result-header"><span className="logo-mark">🍽️</span> 食ジャンMAP</header>
      <section className="result-layout">
        <div className="result-copy">
          <p className="badge">診断完了 ✨</p>
          <h1>あなたにぴったりの一杯が見つかりました！</h1>
          <p>あなたの今の気分に基づいた最高の選択肢です。</p>
        </div>
        <article className="result-card">
          <div className="shop-cover">🍜</div>
          <div className="result-card-body">
            <h3>{shop.name}</h3>
            <p className="muted">評価 {shop.rating ?? "-"} / 徒歩約{Math.max(5, Math.round((result?.distance_km ?? 0.8) * 10))}分</p>
            <p className="muted">{shop.address}</p>
            <p className="muted">スコア: {result?.score?.toFixed(2) ?? "N/A"}</p>
            <button
              type="button"
              className="primary-btn wide"
              onClick={() => navigate("/route", { state: { shop } })}
            >
              ルート案内を開始
            </button>
            <div className="shop-actions">
              <button type="button">保存</button>
              <button type="button" onClick={() => navigate("/diagnosis")}>もう一度診断</button>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function ShopDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { shopId } = useParams();
  const [copied, setCopied] = useState(false);

  const stateShop = (location.state as { shop?: Shop } | null)?.shop;
  const normalizedShop = {
    ...DEFAULT_SHOP,
    ...(stateShop as Partial<Shop> | undefined),
  };
  const shop: Shop = {
    ...normalizedShop,
    id: Number(normalizedShop.id ?? shopId ?? DEFAULT_SHOP.id),
    lat: Number(normalizedShop.lat ?? DEFAULT_SHOP.lat),
    lng: Number(normalizedShop.lng ?? DEFAULT_SHOP.lng),
    place_id: String(normalizedShop.place_id ?? DEFAULT_SHOP.place_id),
    name: String(normalizedShop.name ?? DEFAULT_SHOP.name),
    address: normalizedShop.address ?? DEFAULT_SHOP.address,
    is_chain: Boolean(normalizedShop.is_chain ?? DEFAULT_SHOP.is_chain),
    rating: normalizedShop.rating ?? DEFAULT_SHOP.rating,
    primary_genre: normalizedShop.primary_genre ?? DEFAULT_SHOP.primary_genre,
    google_types: normalizedShop.google_types ?? [],
    review_count: normalizedShop.review_count ?? null,
    price_level: normalizedShop.price_level ?? null,
    updated_at: normalizedShop.updated_at,
  };
  const priceText =
    shop.price_level == null ? "不明" : "¥".repeat(Math.max(1, Math.min(4, Number(shop.price_level))));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${shop.name}\n${shop.address ?? ""}\nhttps://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.lat},${shop.lng}`)}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="shop-detail-page">
      <header className="result-header">
        <button type="button" className="ghost-btn" onClick={() => navigate(-1)}>← 戻る</button>
        <span><span className="logo-mark">🍽️</span> 店舗詳細</span>
      </header>
      <section className="shop-detail-container">
        <article className="shop-detail-card">
          <div className="shop-cover">🍜</div>
          <div className="result-card-body">
            <p className="shop-meta">
              {shop.primary_genre ?? "ジャンル未設定"} / 店舗ID: {shop.id}
            </p>
            <h2>{shop.name}</h2>
            <p className="muted">{shop.address ?? "住所情報なし"}</p>
            <div className="shop-detail-stats">
              <div><strong>評価</strong><span>{shop.rating ?? "-"}</span></div>
              <div><strong>レビュー数</strong><span>{shop.review_count ?? "-"}</span></div>
              <div><strong>価格帯</strong><span>{priceText}</span></div>
              <div><strong>チェーン判定</strong><span>{shop.is_chain ? "チェーン店" : "個店"}</span></div>
            </div>
            <p className="muted">
              座標: {shop.lat.toFixed(6)}, {shop.lng.toFixed(6)}
            </p>
            <p className="muted">place_id: {shop.place_id}</p>
            {!!shop.google_types?.length && (
              <div className="shop-type-chips">
                {shop.google_types.slice(0, 8).map((type) => (
                  <span key={type}>{type}</span>
                ))}
              </div>
            )}
            <div className="shop-detail-actions">
              <button
                type="button"
                className="primary-btn wide"
                onClick={() => navigate(`/route?shopId=${shop.id}`, { state: { shop } })}
              >
                ルート案内
              </button>
              <a
                className="ghost-btn route-open-link"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${shop.lat},${shop.lng}`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Googleマップで見る
              </a>
              <button type="button" className="ghost-btn" onClick={handleCopy}>
                {copied ? "コピーしました" : "店舗情報をコピー"}
              </button>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function RoutePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [arrived, setArrived] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const directionsRendererRef = useRef<any | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [travelMode, setTravelMode] = useState<TravelModeKey>(() => {
    const saved = localStorage.getItem(TRAVEL_MODE_STORAGE_KEY);
    if (saved && isTravelModeKey(saved)) {
      return saved;
    }
    return "WALKING";
  });

  const stateShop = (location.state as { shop?: Shop } | null)?.shop;
  const normalizedShop = {
    ...DEFAULT_SHOP,
    ...(stateShop as Partial<Shop> | undefined),
  };
  const shop: Shop = {
    ...normalizedShop,
    id: Number(normalizedShop.id ?? searchParams.get("shopId") ?? DEFAULT_SHOP.id),
    lat: Number(normalizedShop.lat ?? DEFAULT_SHOP.lat),
    lng: Number(normalizedShop.lng ?? DEFAULT_SHOP.lng),
    place_id: String(normalizedShop.place_id ?? DEFAULT_SHOP.place_id),
    name: String(normalizedShop.name ?? DEFAULT_SHOP.name),
    address: normalizedShop.address ?? DEFAULT_SHOP.address,
    is_chain: Boolean(normalizedShop.is_chain ?? DEFAULT_SHOP.is_chain),
    rating: normalizedShop.rating ?? DEFAULT_SHOP.rating,
    primary_genre: normalizedShop.primary_genre ?? DEFAULT_SHOP.primary_genre,
  };
  const ARRIVAL_THRESHOLD_KM = 0.08;

  const handleRouteMapReady = useCallback(async (map: any) => {
    mapRef.current = map;
    try {
      const current = await getCurrentLocation();
      setCurrentPosition(current);
      map.setCenter(current);
    } catch {
      map.setCenter({ lat: shop.lat, lng: shop.lng });
    }
  }, [shop.lat, shop.lng]);

  useGoogleMap(
    mapContainerRef,
    handleRouteMapReady,
    () => undefined,
  );

  useEffect(() => {
    const g = (window as any).google;
    if (!g?.maps || !mapRef.current || !currentPosition) {
      return;
    }

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new g.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#2d72ff",
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });
    }

    const directionsService = new g.maps.DirectionsService();
    setRouteLoading(true);
    setRouteError(null);
    setRouteNotice(null);
    setRouteSummary(null);

    const destinationCandidates: Array<{ kind: "place_id" | "latlng" | "query"; value: any }> = [];
    if (shop.place_id) {
      destinationCandidates.push({ kind: "place_id", value: { placeId: shop.place_id } });
    }
    if (isValidLatLng({ lat: Number(shop.lat), lng: Number(shop.lng) })) {
      destinationCandidates.push({ kind: "latlng", value: { lat: Number(shop.lat), lng: Number(shop.lng) } });
    }
    if (shop.address || shop.name) {
      destinationCandidates.push({ kind: "query", value: [shop.name, shop.address].filter(Boolean).join(" ") });
    }
    if (destinationCandidates.length === 0) {
      setRouteLoading(false);
      setRouteError("目的地情報が不正です（座標/住所が不足しています）。");
      return;
    }

    const requestRoute = (
      mode: TravelModeKey,
      destination: { kind: "place_id" | "latlng" | "query"; value: any },
    ): Promise<{ result: any; status: string; mode: TravelModeKey; destinationKind: "place_id" | "latlng" | "query" }> => {
      return new Promise((resolve) => {
        const request: Record<string, any> = {
          origin: currentPosition,
          destination: destination.value,
          travelMode: g.maps.TravelMode[mode],
          region: "JP",
        };
        if (mode === "TRANSIT") {
          request.transitOptions = {
            departureTime: new Date(),
          };
        }
        directionsService.route(request, (result: any, status: string) => {
          resolve({ result, status, mode, destinationKind: destination.kind });
        });
      });
    };

    const applyRouteResult = (result: any) => {
      directionsRendererRef.current?.setDirections(result);
      const leg = result.routes[0].legs[0];
      const steps = (leg.steps || [])
        .map((step: any) => stripHtmlTags(step.instructions || ""))
        .filter((s: string) => s.length > 0);
      setRouteSummary({
        distanceText: leg.distance?.text ?? "-",
        durationText: leg.duration?.text ?? "-",
        steps,
      });
    };

    const run = async () => {
      let primary = await requestRoute(travelMode, destinationCandidates[0]);
      for (let i = 1; primary.status !== "OK" && i < destinationCandidates.length; i += 1) {
        primary = await requestRoute(travelMode, destinationCandidates[i]);
      }
      if (primary.status === "OK" && primary.result?.routes?.[0]?.legs?.[0]) {
        setRouteLoading(false);
        applyRouteResult(primary.result);
        return;
      }

      const fallbackOrder: TravelModeKey[] = (["DRIVING", "WALKING", "BICYCLING", "TRANSIT"] as const).filter(
        (mode): mode is TravelModeKey => mode !== travelMode,
      );
      const attempts = [primary];

      if (primary.status === "ZERO_RESULTS") {
        for (const mode of fallbackOrder) {
          let result = await requestRoute(mode, destinationCandidates[0]);
          for (let i = 1; result.status !== "OK" && i < destinationCandidates.length; i += 1) {
            result = await requestRoute(mode, destinationCandidates[i]);
          }
          attempts.push(result);
          if (result.status === "OK" && result.result?.routes?.[0]?.legs?.[0]) {
            setRouteLoading(false);
            applyRouteResult(result.result);
            setRouteNotice(
              `${travelModeLabel(travelMode)}では経路が見つからなかったため、${travelModeLabel(mode)}ルートを表示しています。`,
            );
            return;
          }
        }
      }

      setRouteLoading(false);
      const attemptSummary = attempts
        .map((a) => `${travelModeLabel(a.mode)}(${a.destinationKind}):${a.status}`)
        .join(" / ");
      setRouteError(`ルートの取得に失敗しました。試行結果 → ${attemptSummary}`);
    };

    void run();
  }, [currentPosition, shop.lat, shop.lng, travelMode]);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const latest = normalizeCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCurrentPosition(latest);

        if (!arrived) {
          const remainKm = distanceKm(latest, { lat: shop.lat, lng: shop.lng });
          if (remainKm <= ARRIVAL_THRESHOLD_KM) {
            setArrived(true);
          }
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [arrived, shop.lat, shop.lng]);

  useEffect(() => {
    localStorage.setItem(TRAVEL_MODE_STORAGE_KEY, travelMode);
  }, [travelMode]);

  return (
    <main className="map-layout">
      <div ref={mapContainerRef} className="map-canvas" />
      <aside className="left-panel route-panel">
        <div className="brand-line"><span className="logo-mark">🍽️</span> 食ジャンMAP</div>
        <h2>{shop.name}</h2>
        <p className="route-badge">{arrived ? "ここに行った！" : "ルート案内中"}</p>
        <div className="route-mode-grid">
          {TRAVEL_MODE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`route-mode-btn ${travelMode === option.key ? "active" : ""}`}
              onClick={() => setTravelMode(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="muted">現在地から目的地まで{travelModeLabel(travelMode)}ルートを表示中です。</p>
        {routeLoading && <p className="muted">最適なルートを計算中...</p>}
        {routeNotice && <p className="muted">{routeNotice}</p>}
        {routeError && <p className="error-text">{routeError}</p>}
        {routeSummary && (
          <p className="muted">
            距離: {routeSummary.distanceText} / 所要時間: {routeSummary.durationText}
          </p>
        )}
        <div className="route-steps">
          {(routeSummary?.steps?.length ? routeSummary.steps.slice(0, 6) : ["ルート情報を取得中..."]).map(
            (step, idx) => (
              <p key={`${idx}-${step}`}>{idx + 1}. {step}</p>
            ),
          )}
        </div>
        {!arrived ? (
          <button type="button" className="success-btn wide" onClick={() => setArrived(true)}>
            到着してチェックイン
          </button>
        ) : (
          <p className="arrival-note">到着済みです。お疲れさまでした！</p>
        )}
        <div className="wizard-actions">
          <a
            className="ghost-btn route-open-link"
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
              `${shop.lat},${shop.lng}`,
            )}${currentPosition ? `&origin=${encodeURIComponent(`${currentPosition.lat},${currentPosition.lng}`)}` : ""}&travelmode=${toGoogleTravelMode(travelMode)}`}
            target="_blank"
            rel="noreferrer"
          >
            マップで開く
          </a>
          <button type="button" className="ghost-btn" onClick={() => navigate("/")}>案内を終了</button>
        </div>
      </aside>
    </main>
  );
}

function ContactPage() {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("山田太郎");
  const [email, setEmail] = useState("example@email.com");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSent(false);
    if (!subject || !message.trim()) {
      setError("お問い合わせ項目と内容を入力してください。");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/contact/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `送信に失敗しました (HTTP ${res.status})`);
      }
      setSent(true);
      setMessage("");
      setSubject("");
    } catch (e: any) {
      setError(e?.message ?? "送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="contact-page">
      <button type="button" className="back-btn" onClick={() => navigate(-1)}>← 戻る</button>
      <section className="contact-card">
        <h1>アプリ開発者へのお問い合わせ</h1>
        <p>アプリの使い方や不具合、改善案など、開発チームへお気軽にご連絡ください。</p>
        <form onSubmit={onSubmit}>
          <div className="contact-grid">
            <label>お名前<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>メールアドレス<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          </div>
          <label>お問い合わせ項目
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="" disabled>選択してください</option>
              <option>バグ報告</option>
              <option>機能改善</option>
              <option>その他</option>
            </select>
          </label>
          <label>お問い合わせ内容<textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="詳細な内容をご記入ください..." rows={6} /></label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="primary-btn wide" disabled={sending}>{sending ? "送信中..." : "送信する"}</button>
          {sent && <p className="success-note">送信ありがとうございました。担当者が確認します。</p>}
        </form>
      </section>
    </main>
  );
}

function MyPage({ currentUser }: { currentUser: User | null }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchCurrentUserProfile(currentUser)
      .then((data) => setProfile(data))
      .catch((e: any) => setError(e?.message ?? "プロフィール取得に失敗しました。"))
      .finally(() => setLoading(false));
  }, [currentUser]);

  return (
    <main className="mypage">
      <header className="mypage-header">
        <button type="button" className="logo-chip" onClick={() => navigate("/")}>
          <span className="logo-mark">🍽️</span> 食ジャンマップ
        </button>
        <button type="button" className="ghost-btn" onClick={() => signOut(auth)}>ログアウト</button>
      </header>
      <section className="mypage-card">
        <h1>{profile?.name ?? "ゲストユーザー"}</h1>
        <p>@{currentUser?.email?.split("@")[0] ?? "guest"}・食通レベル: 12</p>
        {!currentUser && <p className="error-text">ログインするとプロフィール情報を取得できます。</p>}
        {loading && <p className="muted">プロフィールを読み込み中...</p>}
        {error && <p className="error-text">{error}</p>}
        <div className="tag-row">
          {(profile?.like_categories?.length ? profile.like_categories : ["ラーメン", "うどん", "そば", "ご飯物"]).map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
        </div>
      </section>
      <section className="mypage-grid">
        <article><h3>お気に入り一覧</h3><p>保存した店舗を確認する</p></article>
        <article><h3>マイレポート一覧</h3><p>過去の診断・訪問履歴</p></article>
      </section>
    </main>
  );
}

export default function App() {
  const currentUser = observeAuthState();

  return (
    <Routes>
      <Route path="/" element={<MapHomePage currentUser={currentUser} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/signup/success" element={<SignupSuccessPage />} />
      <Route path="/diagnosis" element={<DiagnosisPage currentUser={currentUser} />} />
      <Route path="/diagnosis/result" element={<DiagnosisResultPage />} />
      <Route path="/shops/:shopId" element={<ShopDetailPage />} />
      <Route path="/route" element={<RoutePage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/mypage" element={<MyPage currentUser={currentUser} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
