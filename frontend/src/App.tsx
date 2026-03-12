import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
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

type DiagnosisInput = {
  mood_genre: string;
  time_level: string;
  volume_level: string;
};

type DiagnosisResult = {
  recommended_shop?: {
    place_id?: string;
    name?: string;
    address?: string | null;
    rating?: number | null;
    lat?: number;
    lng?: number;
  };
  distance_km?: number;
  score?: number;
};

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

async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  if (!navigator.geolocation) {
    throw new Error("このブラウザは位置情報取得に対応していません。");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => reject(new Error("現在地を取得できませんでした。")),
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
      await createUserWithEmailAndPassword(auth, email.trim(), password);
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
      await signInWithEmailAndPassword(auth, email.trim(), password);
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
      <aside className="left-panel">
        <div className="brand-line"><span className="logo-mark">🍽️</span> 食ジャンMAP</div>
        <h2>こんにちは、{currentUser?.email?.split("@")[0] ?? "ユーザー"}さん！</h2>
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
        <input className="search-box" placeholder="場所や料理名で検索" />
        <button type="button" className="primary-btn wide floating-nearby">
          現在地の周辺で探す
        </button>
      </aside>

      <div className="top-icons">
        {currentUser && <button type="button" title="履歴">↺</button>}
        {currentUser && <button type="button" title="通知">🔔</button>}
        <button type="button" title="検索">🔍</button>
        <button type="button" title="問い合わせ" onClick={() => navigate("/contact")}>✉️</button>
        <button type="button" title="マイページ" onClick={() => navigate("/mypage")}>👤</button>
        {currentUser ? (
          <button type="button" className="mypage-pill" onClick={() => navigate("/mypage")}>マイページ</button>
        ) : (
          <button type="button" className="mypage-pill" onClick={() => navigate("/login")}>ログイン</button>
        )}
      </div>

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
            <button type="button" onClick={() => navigate("/diagnosis/result", { state: { shop: selectedShop } })}>
              詳細を見る
            </button>
          </div>
          {mapError && <p className="error-text">{mapError}</p>}
          {shopsLoading && <p className="muted">店舗を読み込み中です...</p>}
        </div>
      </section>
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
    name: result?.recommended_shop?.name ?? stateShop?.name ?? DEFAULT_SHOP.name,
    address: result?.recommended_shop?.address ?? stateShop?.address ?? DEFAULT_SHOP.address,
    rating: result?.recommended_shop?.rating ?? stateShop?.rating ?? DEFAULT_SHOP.rating,
    lat: result?.recommended_shop?.lat ?? stateShop?.lat ?? DEFAULT_SHOP.lat,
    lng: result?.recommended_shop?.lng ?? stateShop?.lng ?? DEFAULT_SHOP.lng,
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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const routeLineRef = useRef<any | null>(null);

  const stateShop = (location.state as { shop?: Shop } | null)?.shop;
  const shop: Shop = stateShop ?? {
    ...DEFAULT_SHOP,
    id: Number(searchParams.get("shopId") || DEFAULT_SHOP.id),
  };

  const handleRouteMapReady = useCallback(async (map: any) => {
    mapRef.current = map;
    try {
      const current = await getCurrentLocation();
      map.setCenter(current);
      new (window as any).google.maps.Marker({ position: current, map, title: "現在地" });
      new (window as any).google.maps.Marker({
        position: { lat: shop.lat, lng: shop.lng },
        map,
        title: shop.name,
        icon: {
          url: emojiMarkerIconDataUrl("🍜"),
          scaledSize: new (window as any).google.maps.Size(36, 36),
        },
      });
      routeLineRef.current = new (window as any).google.maps.Polyline({
        path: [current, { lat: shop.lat, lng: shop.lng }],
        geodesic: true,
        strokeColor: "#2d72ff",
        strokeOpacity: 1.0,
        strokeWeight: 4,
      });
      routeLineRef.current.setMap(map);
    } catch {
      map.setCenter({ lat: shop.lat, lng: shop.lng });
    }
  }, [shop.lat, shop.lng, shop.name]);

  useGoogleMap(
    mapContainerRef,
    handleRouteMapReady,
    () => undefined,
  );

  return (
    <main className="map-layout">
      <div ref={mapContainerRef} className="map-canvas" />
      <aside className="left-panel route-panel">
        <div className="brand-line"><span className="logo-mark">🍽️</span> 食ジャンMAP</div>
        <h2>{shop.name}</h2>
        <p className="route-badge">{arrived ? "ここに行った！" : "ルート案内中"}</p>
        <p className="muted">現在地から目的地まで徒歩ルートを表示中です。</p>
        <div className="route-steps">
          <p>1. 現在地を出発</p>
          <p>2. 300m先を右折</p>
          <p>3. 信号を渡る</p>
        </div>
        {!arrived ? (
          <button type="button" className="success-btn wide" onClick={() => setArrived(true)}>
            到着してチェックイン
          </button>
        ) : (
          <p className="arrival-note">到着済みです。お疲れさまでした！</p>
        )}
        <div className="wizard-actions">
          <button type="button" className="ghost-btn" onClick={() => navigate("/")}>マップで開く</button>
          <button type="button" className="ghost-btn" onClick={() => navigate("/")}>案内を終了</button>
        </div>
      </aside>
    </main>
  );
}

function ContactPage() {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <main className="contact-page">
      <button type="button" className="back-btn" onClick={() => navigate(-1)}>← 戻る</button>
      <section className="contact-card">
        <h1>アプリ開発者へのお問い合わせ</h1>
        <p>アプリの使い方や不具合、改善案など、開発チームへお気軽にご連絡ください。</p>
        <form onSubmit={onSubmit}>
          <div className="contact-grid">
            <label>お名前<input defaultValue="山田太郎" /></label>
            <label>メールアドレス<input type="email" defaultValue="example@email.com" /></label>
          </div>
          <label>お問い合わせ項目
            <select defaultValue="">
              <option value="" disabled>選択してください</option>
              <option>バグ報告</option>
              <option>機能改善</option>
              <option>その他</option>
            </select>
          </label>
          <label>お問い合わせ内容<textarea placeholder="詳細な内容をご記入ください..." rows={6} /></label>
          <button type="submit" className="primary-btn wide">送信する</button>
          {sent && <p className="success-note">送信ありがとうございました。担当者が確認します。</p>}
        </form>
      </section>
    </main>
  );
}

function MyPage() {
  const navigate = useNavigate();

  return (
    <main className="mypage">
      <header className="mypage-header">
        <button type="button" className="logo-chip" onClick={() => navigate("/")}>
          <span className="logo-mark">🍽️</span> 食ジャンマップ
        </button>
        <button type="button" className="ghost-btn" onClick={() => signOut(auth)}>ログアウト</button>
      </header>
      <section className="mypage-card">
        <h1>山田 太郎</h1>
        <p>@misaki_gourmet・食通レベル: 12</p>
        <div className="tag-row">
          <span>ラーメン</span>
          <span>うどん</span>
          <span>そば</span>
          <span>ご飯物</span>
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
      <Route path="/route" element={<RoutePage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/mypage" element={<MyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
