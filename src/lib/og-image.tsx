import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";
export const OG_IMAGE_ALT = "Fuzion Webz — Digital Design Studio";

let cachedIconDataUrl: string | null = null;
function getIconDataUrl(): string {
  if (cachedIconDataUrl !== null) return cachedIconDataUrl;
  try {
    const svg = readFileSync(join(process.cwd(), "public", "icon-white.svg"));
    cachedIconDataUrl = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  } catch {
    cachedIconDataUrl = "";
  }
  return cachedIconDataUrl;
}

let cachedBrandFont: ArrayBuffer | null = null;
function getBrandFont(): ArrayBuffer | null {
  if (cachedBrandFont !== null) return cachedBrandFont;
  try {
    const buf = readFileSync(join(process.cwd(), "public", "fonts", "fuzionfirst", "FuzionFirst-Bold.otf"));
    cachedBrandFont = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch {
    cachedBrandFont = null;
  }
  return cachedBrandFont;
}

let cachedHebrewFont: ArrayBuffer | null = null;
function getHebrewFont(): ArrayBuffer | null {
  if (cachedHebrewFont !== null) return cachedHebrewFont;
  try {
    const buf = readFileSync(join(process.cwd(), "public", "fonts", "meruba", "Meruba-Bold.otf"));
    cachedHebrewFont = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch {
    cachedHebrewFont = null;
  }
  return cachedHebrewFont;
}

/**
 * Renders the shared FUZION WEBZ Open Graph card.
 * Pass an English subtitle (e.g. "ABOUT") to label the page; Hebrew is not
 * shaped correctly by Satori without a custom RTL font, so we keep it Latin.
 */
export function renderOgImage(subtitle?: string): ImageResponse {
  const iconDataUrl = getIconDataUrl();
  const brandFont = getBrandFont();
  const tagline = subtitle ? `Digital Design Studio · ${subtitle}` : "Digital Design Studio";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          color: "#ffffff",
          fontFamily: brandFont ? "FuzionFirst, Arial, sans-serif" : "Arial, sans-serif",
          gap: "60px",
        }}
      >
        {iconDataUrl ? (
          <img
            src={iconDataUrl}
            width={360}
            height={360}
            alt=""
            style={{ borderRadius: "32px" }}
          />
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              fontSize: "84px",
              fontWeight: 800,
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            FUZION
          </div>
          <div
            style={{
              fontSize: "84px",
              fontWeight: 800,
              letterSpacing: "-3px",
              lineHeight: 1,
              color: "#888888",
            }}
          >
            WEBZ
          </div>
          <div
            style={{
              width: "100px",
              height: "4px",
              background: "linear-gradient(90deg, #E503A2 0%, #01FFFF 100%)",
              marginTop: "24px",
              marginBottom: "20px",
            }}
          />
          <div
            style={{
              fontSize: "22px",
              letterSpacing: "8px",
              color: "#cccccc",
              textTransform: "uppercase",
            }}
          >
            {tagline}
          </div>
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
      ...(brandFont
        ? {
            fonts: [
              {
                name: "FuzionFirst",
                data: brandFont,
                weight: 700,
                style: "normal",
              },
            ],
          }
        : {}),
    }
  );
}

function fitFontSize(title: string): number {
  const len = title.length;
  if (len <= 28) return 80;
  if (len <= 48) return 64;
  if (len <= 72) return 52;
  if (len <= 100) return 42;
  return 36;
}

/**
 * Renders a contract-flavoured OG card for agreement signing links.
 * Distinct from the marketing splash so a WhatsApp preview reads as
 * "a document to sign", not "a link to the website". Hebrew is shaped
 * with Meruba-Bold and MUST have `direction: "rtl"` on each text node
 * — Satori applies no implicit BiDi pass, so without it Hebrew chars
 * render in storage order and the preview reads mirrored.
 */
export function renderAgreementOgImage(
  recipientName: string,
  signed: boolean
): ImageResponse {
  const iconDataUrl = getIconDataUrl();
  const brandFont = getBrandFont();
  const hebrewFont = getHebrewFont();

  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: "normal";
  }[] = [];
  if (brandFont) {
    fonts.push({ name: "FuzionFirst", data: brandFont, weight: 700, style: "normal" });
  }
  if (hebrewFont) {
    fonts.push({ name: "Meruba", data: hebrewFont, weight: 700, style: "normal" });
  }

  const heFamily = hebrewFont
    ? "Meruba, FuzionFirst, Arial, sans-serif"
    : "FuzionFirst, Arial, sans-serif";
  const brandFamily = brandFont
    ? "FuzionFirst, Arial, sans-serif"
    : "Arial, sans-serif";

  const title = signed ? "הסכם חתום ✓" : "הסכם שירות לחתימה";
  // Keep the recipient line from overflowing the card.
  const who = recipientName.length > 42
    ? `${recipientName.slice(0, 41)}…`
    : recipientName;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "40px",
          backgroundColor: "#000000",
        }}
      >
        {/* Document-style framed card */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 64px",
            border: "2px solid #2a2a2a",
            borderRadius: "24px",
            backgroundColor: "#0a0a0a",
            color: "#ffffff",
          }}
        >
          {/* Top row — brand */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "18px",
              fontFamily: brandFamily,
            }}
          >
            {iconDataUrl ? (
              <img
                src={iconDataUrl}
                width={64}
                height={64}
                alt=""
                style={{ borderRadius: "12px" }}
              />
            ) : null}
            <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-1px" }}>FUZION</span>
              <span style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-1px", color: "#888888" }}>WEBZ</span>
            </div>
          </div>

          {/* Title block — right-aligned for Hebrew */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              width: "100%",
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontSize: "26px",
                letterSpacing: "2px",
                color: "#999999",
                fontFamily: heFamily,
                direction: "rtl",
                marginBottom: "14px",
              }}
            >
              מסמך רשמי · לחתימה דיגיטלית
            </div>
            <div
              style={{
                fontSize: "78px",
                lineHeight: 1.1,
                fontWeight: 700,
                fontFamily: heFamily,
                direction: "rtl",
                color: "#ffffff",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: "34px",
                fontFamily: heFamily,
                direction: "rtl",
                color: "#cccccc",
                marginTop: "18px",
              }}
            >
              {`עבור: ${who}`}
            </div>
          </div>

          {/* Bottom row — gradient bar + signature label */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                letterSpacing: "6px",
                color: "#cccccc",
                textTransform: "uppercase",
                fontFamily: brandFamily,
              }}
            >
              Service Agreement
            </div>
            <div
              style={{
                width: "180px",
                height: "6px",
                background: "linear-gradient(90deg, #E503A2 0%, #01FFFF 100%)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
      ...(fonts.length ? { fonts } : {}),
    }
  );
}

/**
 * Renders a per-post OG card with Hebrew title + Fuzion branding.
 * The Hebrew title uses Meruba-Bold; each Hebrew text node sets
 * `direction: "rtl"` because Satori applies no implicit BiDi pass —
 * without it Hebrew renders in storage order and reads mirrored.
 */
export function renderBlogPostOgImage(title: string, category?: string | null): ImageResponse {
  const iconDataUrl = getIconDataUrl();
  const brandFont = getBrandFont();
  const hebrewFont = getHebrewFont();

  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: "normal";
  }[] = [];
  if (brandFont) {
    fonts.push({ name: "FuzionFirst", data: brandFont, weight: 700, style: "normal" });
  }
  if (hebrewFont) {
    fonts.push({ name: "Meruba", data: hebrewFont, weight: 700, style: "normal" });
  }

  const titleFontFamily = hebrewFont
    ? "Meruba, FuzionFirst, Arial, sans-serif"
    : "FuzionFirst, Arial, sans-serif";
  const brandFontFamily = brandFont
    ? "FuzionFirst, Arial, sans-serif"
    : "Arial, sans-serif";

  const titleSize = fitFontSize(title);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#000000",
          color: "#ffffff",
        }}
      >
        {/* Top row — brand */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "20px",
            fontFamily: brandFontFamily,
          }}
        >
          {iconDataUrl ? (
            <img
              src={iconDataUrl}
              width={72}
              height={72}
              alt=""
              style={{ borderRadius: "12px" }}
            />
          ) : null}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: "12px" }}>
            <span style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px" }}>FUZION</span>
            <span style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", color: "#888888" }}>WEBZ</span>
          </div>
        </div>

        {/* Title block — right-aligned for Hebrew */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            width: "100%",
            textAlign: "right",
          }}
        >
          <div
            style={{
              fontSize: `${titleSize}px`,
              lineHeight: 1.15,
              fontWeight: 700,
              fontFamily: titleFontFamily,
              direction: "rtl",
              color: "#ffffff",
              maxWidth: "100%",
            }}
          >
            {title}
          </div>
        </div>

        {/* Bottom row — gradient bar + category / blog label */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "12px",
              fontSize: "22px",
              color: "#cccccc",
              fontFamily: brandFontFamily,
            }}
          >
            <span style={{ letterSpacing: "8px", textTransform: "uppercase" }}>Blog</span>
            {category ? (
              <>
                <span>·</span>
                <span style={{ direction: "rtl", fontFamily: titleFontFamily }}>
                  {category}
                </span>
              </>
            ) : null}
          </div>
          <div
            style={{
              width: "160px",
              height: "6px",
              background: "linear-gradient(90deg, #E503A2 0%, #01FFFF 100%)",
            }}
          />
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
      ...(fonts.length ? { fonts } : {}),
    }
  );
}
