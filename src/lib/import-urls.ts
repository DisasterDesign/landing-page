/**
 * Parses pasted text where each line maps a client name to a website URL.
 * Supports several common separators: TAB, " | ", ", ", or 2+ spaces.
 * The URL is detected as the *last* token that looks like a URL/domain;
 * everything before it is treated as the client name.
 *
 * Examples accepted:
 *   "Acme Ltd<TAB>acme.com"
 *   "Foo Cafe | https://foo.example"
 *   "Bar Restaurant, www.bar.co.il"
 *   "Some Long Name   https://x.com"
 */
const URL_LIKE = /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i;

export interface ParsedRow {
  name: string;
  url: string;
}

export function parseUrlPaste(raw: string): ParsedRow[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map<ParsedRow | null>((line) => {
      const parts = line
        .split(/[\t|]|,\s*|\s{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length < 2) return null;

      const reverseIdx = [...parts].reverse().findIndex((p) => URL_LIKE.test(p));
      if (reverseIdx === -1) return null;
      const urlIdx = parts.length - 1 - reverseIdx;

      const name = parts.slice(0, urlIdx).join(" ").trim();
      let url = parts[urlIdx];
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      if (!name) return null;

      return { name, url };
    })
    .filter((row): row is ParsedRow => row !== null);
}
