/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "mk" | "en";
interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
}
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("mk");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const savedLang = localStorage.getItem("invoiceguard-lang") as Lang | null;
    if (savedLang && (savedLang === "mk" || savedLang === "en")) setLangState(savedLang);
    setMounted(true);
  }, []);
  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("invoiceguard-lang", newLang);
  };
  if (!mounted) return null;
  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}
