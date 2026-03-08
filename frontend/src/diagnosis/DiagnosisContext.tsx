import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DiagnosisStep = "start" | "q1" | "q2" | "q3" | "done";
export type Q1Mood = "ご飯物" | "ラーメン" | "うどん" | "そば" | "";
export type Q2Time = "すぐ" | "少し" | "余裕" | "";
export type Q3Volume = "少なめ" | "普通" | "多め" | "";

type DiagnosisState = {
  step: DiagnosisStep;
  mood: Q1Mood;
  time: Q2Time;
  volume: Q3Volume;
  start: () => void;
  reset: () => void;
  setMood: (v: Q1Mood) => void;
  setTime: (v: Q2Time) => void;
  setVolume: (v: Q3Volume) => void;
  next: () => void;
  back: () => void;
};

const DiagnosisContext = createContext<DiagnosisState | null>(null);

export function DiagnosisProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<DiagnosisStep>("start");
  const [mood, setMood] = useState<Q1Mood>("");
  const [time, setTime] = useState<Q2Time>("");
  const [volume, setVolume] = useState<Q3Volume>("");

  const start = () => setStep("q1");
  const reset = () => {
    setMood("");
    setTime("");
    setVolume("");
    setStep("start");
  };

  const next = () => {
    if (step === "q1") setStep("q2");
    else if (step === "q2") setStep("q3");
    else if (step === "q3") setStep("done");
  };

  const back = () => {
    if (step === "q2") setStep("q1");
    else if (step === "q3") setStep("q2");
    else if (step === "done") setStep("q3");
  };

  const value = useMemo(
    () => ({
      step,
      mood,
      time,
      volume,
      start,
      reset,
      setMood,
      setTime,
      setVolume,
      next,
      back,
    }),
    [step, mood, time, volume],
  );

  return <DiagnosisContext.Provider value={value}>{children}</DiagnosisContext.Provider>;
}

export function useDiagnosis() {
  const ctx = useContext(DiagnosisContext);
  if (!ctx) {
    throw new Error("useDiagnosis must be used inside DiagnosisProvider");
  }
  return ctx;
}
