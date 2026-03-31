import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Fuzion Webz — סטודיו לעיצוב ובניית אתרים";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: "bold",
              letterSpacing: "-2px",
            }}
          >
            FUZION WEBZ
          </div>
        </div>
        <div
          style={{
            fontSize: "28px",
            color: "#E503A2",
            direction: "rtl",
          }}
        >
          סטודיו לעיצוב ובניית אתרים מתקדמים
        </div>
        <div
          style={{
            fontSize: "20px",
            color: "#01FFFF",
            marginTop: "12px",
            direction: "rtl",
          }}
        >
          עיצוב • פיתוח • חדשנות
        </div>
      </div>
    ),
    { ...size }
  );
}
