import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Lang = "en" | "he";

interface LangContextValue {
  lang: Lang;
  isEnglish: boolean;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue | undefined>(undefined);

export const LangProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("lang") as Lang) === "en" ? "en" : "he";
    } catch {
      return "he";
    }
  });

  useEffect(() => {
    try { localStorage.setItem("lang", lang); } catch {}
  }, [lang]);

  const value = useMemo<LangContextValue>(() => ({
    lang,
    isEnglish: lang === "en",
    setLang,
    toggle: () => setLang((prev) => (prev === "en" ? "he" : "en")),
  }), [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

export const useLang = (): LangContextValue => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within a LangProvider");
  return ctx;
};
