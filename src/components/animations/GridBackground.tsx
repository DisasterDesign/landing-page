"use client";

import { useEffect, useState } from "react";

export default function GridBackground() {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const scrollContainer = document.getElementById("smooth-content");
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

      let newOpacity = 0;
      if (progress < 0.1) newOpacity = (progress / 0.1) * 0.12;
      else if (progress > 0.9) newOpacity = ((1 - progress) / 0.1) * 0.12;
      else newOpacity = 0.12;

      setOpacity(newOpacity);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[2]"
      style={{
        opacity,
        transition: "opacity 0.3s ease",
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    />
  );
}
