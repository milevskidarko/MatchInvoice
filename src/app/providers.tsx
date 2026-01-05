"use client";
import { LanguageProvider } from "./LanguageContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
