"use client";

import { useEffect, useRef } from "react";

interface Props {
  content: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
  customerName: string;
  signedAt: string | null;
}

export default function PrintAgreementClient({ content, status, customerName, signedAt }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const triggerPrint = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("auto") === "1") triggerPrint();
    }, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      {/* Toolbar (hidden when printing) */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
        <div>
          <div className="text-sm font-bold text-gray-900">
            הסכם של {customerName}
          </div>
          <div className="text-xs text-gray-500">
            {status === "SIGNED" && signedAt
              ? `נחתם ${new Date(signedAt).toLocaleDateString("he-IL")}`
              : status === "SIGNED"
              ? "נחתם"
              : "טיוטה (לא חתום)"}
          </div>
        </div>
        <button
          onClick={triggerPrint}
          className="inline-flex items-center gap-2 bg-black text-white text-sm font-bold px-5 py-2 rounded-full hover:bg-gray-800"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3M16 12V3H8v9M4 16h16M9 16v-2a3 3 0 016 0v2" />
          </svg>
          הורד / הדפס
        </button>
      </div>

      <div className="p-4 print:p-0">
        <iframe
          ref={iframeRef}
          srcDoc={content}
          sandbox="allow-same-origin allow-modals"
          title="הסכם להדפסה"
          className="w-full bg-white shadow-lg print:shadow-none"
          style={{ height: "calc(100vh - 80px)", border: "0" }}
        />
      </div>

      <style>{`
        @media print {
          @page { margin: 12mm; }
          html, body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
