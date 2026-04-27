"use client";

import { Toaster } from "react-hot-toast";

export default function AdminToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: "#1f2937",
          color: "#f9fafb",
          border: "1px solid #374151",
        },
        success: {
          iconTheme: { primary: "#34d399", secondary: "#1f2937" },
        },
        error: {
          iconTheme: { primary: "#f87171", secondary: "#1f2937" },
          duration: 6000,
        },
      }}
    />
  );
}
