import { useCallback } from "react";
import { translations } from "../lib/translations";
import { useLanguage } from "../app/layout";

export function useTranslations() {
  const { lang } = useLanguage();
  return useCallback(
    (key: keyof typeof translations["en"]) => translations[lang][key] || key,
    [lang]
  );
}
