"use client";

import { useEffect } from "react";

/**
 * Overrides <html lang/dir> for the handful of customer-facing pages that render
 * in English (foreign-client agreements and their payment result pages).
 *
 * Only the root layout may emit <html> in the App Router, and this is a
 * Hebrew-first site, so it is hard-coded to lang="he" dir="rtl". A foreign
 * client's English contract was therefore served inside a document declaring
 * Hebrew: Chrome offered to "translate this page from Hebrew", screen readers
 * announced English text with a Hebrew voice, and spellcheck used Hebrew rules.
 *
 * Restores the previous values on unmount so client-side navigation back into
 * the Hebrew site is unaffected.
 */
export default function DocumentLocale({
  lang,
  dir,
}: {
  lang: string;
  dir: "ltr" | "rtl";
}) {
  useEffect(() => {
    const el = document.documentElement;
    const prevLang = el.lang;
    const prevDir = el.dir;
    el.lang = lang;
    el.dir = dir;
    return () => {
      el.lang = prevLang;
      el.dir = prevDir;
    };
  }, [lang, dir]);

  return null;
}
