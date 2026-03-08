import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDiagnosis } from "./DiagnosisContext";

type DiagnosisRunInput = {
  mood_genre: string;
  time_level: string;
  volume_level: string;
};

type DiagnosisRunResponse = {
  received: boolean;
  input?: {
    mood_genre?: string;
    time_level?: string;
    volume_level?: string;
    lat?: number;
    lng?: number;
  };
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

type Props = {
  fetchDiagnosis: (input: DiagnosisRunInput) => Promise<DiagnosisRunResponse>;
};

const STEP_ORDER = ["start", "q1", "q2", "q3", "done"] as const;

const panelVariants = {
  initial: (direction: number) => ({
    x: direction >= 0 ? 28 : -28,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.22, ease: "easeOut" as const },
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -28 : 28,
    opacity: 0,
    transition: { duration: 0.18, ease: "easeIn" as const },
  }),
};

function MotionButton({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -1 }}
      style={{
        padding: "0.5rem 0.75rem",
        borderRadius: "8px",
        border: active ? "2px solid #333" : "1px solid #ccc",
        background: active ? "#f2f2f2" : "white",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </motion.button>
  );
}

export function FiveSecondDiagnosis({ fetchDiagnosis }: Props) {
  const { step, mood, time, volume, start, reset, setMood, setTime, setVolume, next, back } =
    useDiagnosis();
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResultText, setRunResultText] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<DiagnosisRunResponse["recommended_shop"] | null>(null);
  const [recommendedDistance, setRecommendedDistance] = useState<number | null>(null);
  const [recommendedScore, setRecommendedScore] = useState<number | null>(null);
  const currentStepIndex = STEP_ORDER.indexOf(step);
  const [prevStepIndex, setPrevStepIndex] = useState(currentStepIndex);
  const direction = useMemo(() => {
    const d = currentStepIndex - prevStepIndex;
    return d === 0 ? 1 : d;
  }, [currentStepIndex, prevStepIndex]);

  const runDiagnosis = async () => {
    setRunError(null);
    setRunResultText(null);
    setRecommended(null);
    setRecommendedDistance(null);
    setRecommendedScore(null);
    setIsRunning(true);
    try {
      const payload: DiagnosisRunInput = {
        mood_genre: mood,
        time_level: time,
        volume_level: volume,
      };
      const response = await fetchDiagnosis(payload);
      if (response.recommended_shop) {
        setRecommended(response.recommended_shop);
        setRecommendedDistance(response.distance_km ?? null);
        setRecommendedScore(response.score ?? null);
        setRunResultText("TOP1推薦を取得しました。");
      } else {
        setRunResultText(
          `送信成功: mood=${response.input?.mood_genre}, time=${response.input?.time_level}, volume=${response.input?.volume_level}`,
        );
      }
    } catch (e: any) {
      setRunError(e?.message ?? "診断実行に失敗しました");
    } finally {
      setIsRunning(false);
    }
  };

  const goNext = () => {
    setPrevStepIndex(currentStepIndex);
    next();
  };

  const goBack = () => {
    setPrevStepIndex(currentStepIndex);
    back();
  };

  const goStart = () => {
    setPrevStepIndex(currentStepIndex);
    reset();
  };

  return (
    <div style={{ marginTop: "0.75rem", border: "1px solid #ddd", padding: "0.75rem", overflow: "hidden" }}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={panelVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {step === "start" && (
            <div>
              <motion.button whileTap={{ scale: 0.94 }} onClick={() => {
                setPrevStepIndex(currentStepIndex);
                start();
              }}>
                診断開始
              </motion.button>
            </div>
          )}

          {step === "q1" && (
            <div>
              <h3>Q1: 今の気分？</h3>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {["ご飯物", "ラーメン", "うどん", "そば"].map((v) => (
                  <MotionButton
                    key={v}
                    label={v}
                    active={mood === v}
                    onClick={() => setMood(v as typeof mood)}
                  />
                ))}
              </div>
              <div
                style={{
                  marginTop: "0.75rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <motion.button whileTap={{ scale: 0.94 }} onClick={goStart}>
                  キャンセル
                </motion.button>
                <MotionButton label="次へ" active={false} onClick={goNext} disabled={!mood} />
              </div>
            </div>
          )}

          {step === "q2" && (
            <div>
              <h3>Q2: 時間ある？</h3>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {["すぐ", "少し", "余裕"].map((v) => (
                  <MotionButton
                    key={v}
                    label={v}
                    active={time === v}
                    onClick={() => setTime(v as typeof time)}
                  />
                ))}
              </div>
              <div
                style={{
                  marginTop: "0.75rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <motion.button whileTap={{ scale: 0.94 }} onClick={goBack}>
                  戻る
                </motion.button>
                <MotionButton
                  label="次へ"
                  active={false}
                  onClick={goNext}
                  disabled={!time}
                />
              </div>
            </div>
          )}

          {step === "q3" && (
            <div>
              <h3>Q3: 量は？</h3>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {["少なめ", "普通", "多め"].map((v) => (
                  <MotionButton
                    key={v}
                    label={v}
                    active={volume === v}
                    onClick={() => setVolume(v as typeof volume)}
                  />
                ))}
              </div>
              <div
                style={{
                  marginTop: "0.75rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <motion.button whileTap={{ scale: 0.94 }} onClick={goBack}>
                  戻る
                </motion.button>
                <MotionButton
                  label="診断結果へ"
                  active={false}
                  onClick={goNext}
                  disabled={!volume}
                />
              </div>
            </div>
          )}

          {step === "done" && (
            <div>
              <h3>診断結果（暫定）</h3>
              <p>
                気分: <strong>{mood}</strong>
              </p>
              <p>
                時間: <strong>{time}</strong>
              </p>
              <p>
                量: <strong>{volume}</strong>
              </p>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                この内容でバックエンド診断APIを実行できます。
              </p>
              {isRunning && (
                <motion.p
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  style={{ color: "#333" }}
                >
                  診断実行中...
                </motion.p>
              )}
              {runError && <p style={{ color: "red" }}>エラー: {runError}</p>}
              {runResultText && <p style={{ color: "green" }}>{runResultText}</p>}
              {recommended && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: "0.75rem", padding: "0.75rem", border: "1px solid #ccc" }}
                >
                  <strong>TOP1おすすめ店舗</strong>
                  <p>
                    店名: <strong>{recommended.name ?? "不明"}</strong>
                  </p>
                  <p>住所: {recommended.address ?? "不明"}</p>
                  <p>評価: {recommended.rating ?? "不明"}</p>
                  <p>距離: {recommendedDistance ?? "-"} km</p>
                  <p>スコア: {recommendedScore ?? "-"}</p>
                  {recommended.lat != null && recommended.lng != null && (
                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${recommended.lat},${recommended.lng}`,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        地図で見る
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                          `${recommended.lat},${recommended.lng}`,
                        )}&travelmode=walking`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ルート
                      </a>
                    </div>
                  )}
                </motion.div>
              )}
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <motion.button whileTap={{ scale: 0.94 }} onClick={goBack}>
                  戻る
                </motion.button>
                <MotionButton
                  label={isRunning ? "実行中..." : "診断を実行"}
                  active={false}
                  onClick={runDiagnosis}
                  disabled={isRunning}
                />
                <motion.button whileTap={{ scale: 0.94 }} onClick={goStart}>
                  もう一回
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
