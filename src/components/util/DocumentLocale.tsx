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
  title,
}: {
  lang: string;
  dir: "ltr" | "rtl";
  /**
   * Optional title override. Needed on the not-found boundary: a page reached
   * through notFound() does not get its segment's generateMetadata in a
   * production build, so the tab falls back to the Hebrew site default.
   */
  title?: string;
}) {
  useEffect(() => {
    const el = document.documentElement;
    const prevLang = el.lang;
    const prevDir = el.dir;
    const prevTitle = document.title;
    el.lang = lang;
    el.dir = dir;
    if (title) document.title = title;
    return () => {
      el.lang = prevLang;
      el.dir = prevDir;
      if (title) document.title = prevTitle;
    };
  }, [lang, dir, title]);

  return null;
}
