# Ormat proposal — showcase assets

Drop the example work videos here, then list them in
`src/components/ormat/VideoCarousel.tsx` (the `SHOWCASE` array).

- Use MP4 (H.264) for broad support. Add a `.jpg` poster per clip.
- Keep clips short and compressed (a few MB) — they load on the page.
- CSP is `media-src 'self'`, so files **must** live under `/public`
  (this folder) and be referenced as `/ormat/showcase/<file>` — not an
  external CDN.

Example entry:

```ts
{ title: "סרטון תדמית — לקוח X", src: "/ormat/showcase/x.mp4", poster: "/ormat/showcase/x.jpg" }
```
