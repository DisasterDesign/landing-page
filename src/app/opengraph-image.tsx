import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const alt = "Fuzion Webz — סטודיו לעיצוב ובניית אתרים";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const iconPath = join(process.cwd(), "public", "icon-white.svg");
  const iconData = await readFile(iconPath);
  const iconDataUrl = `data:image/svg+xml;base64,${iconData.toString("base64")}`;

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
          fontFamily: "Arial, sans-serif",
          gap: "60px",
        }}
      >
        {/* Logo */}
        <img
          src={iconDataUrl}
          width={360}
          height={360}
          alt=""
          style={{ borderRadius: "32px" }}
        />

        {/* Text */}
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
            Digital Design Studio
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
