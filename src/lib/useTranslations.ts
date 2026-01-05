import { useCallback } from "react";
import { translations } from "../lib/translations";
import { useLanguage } from "../contexts/LanguageContext";

export function useTranslations() {
  const { lang } = useLanguage();
  return useCallback(
    (key: keyof typeof translations["en"]) => translations[lang][key] || key,
    [lang]
  );
}
