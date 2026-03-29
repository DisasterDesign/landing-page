"use client";

import Script from "next/script";

export default function AccessibilityWidget() {
  return (
    <Script
      src="https://cdn.userway.org/widget.js"
      data-account="placeholder"
      strategy="lazyOnload"
    />
  );
}
