import { useRef } from "react";
import { correctRecognitionHero } from "./recognitionCorrections.js";

export function useRecognitionCorrection({ result, setResult, persist, onHeroesChange }) {
  const versions = useRef(new Map());
  const save = (snapshot, index) => {
    const item = snapshot.details[index];
    const token = Symbol();
    versions.current.set(index, token);
    const setStatus = (saveState) => setResult((prev) => {
      if (prev?.requestId !== snapshot.requestId || versions.current.get(index) !== token) return prev;
      return { ...prev, details: prev.details.map((hero, slot) => slot === index ? { ...hero, saveState } : hero) };
    });
    setStatus("saving");
    Promise.resolve().then(() => persist(item, snapshot)).then(() => setStatus("saved"), () => setStatus("error"));
  };
  return {
    select(index, name) {
      const next = correctRecognitionHero(result, index, name);
      if (next === result) return;
      setResult(next);
      onHeroesChange?.(next.heroes);
      save(next, index);
    },
    retry(index) { if (result?.details?.[index]) save(result, index); },
  };
}
