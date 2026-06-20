"use client";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import Image from "next/image";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();

      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, email, password }),
        redirect: "manual",
      });

      // 302 = success (NextAuth sets session cookie and redirects)
      // 200 with error in URL = wrong credentials
      // opaqueredirect type = browser blocked reading but redirect happened (success)
      if (res.type === "opaqueredirect" || res.status === 302 || res.status === 200) {
        // Check if session was actually created by hitting the session endpoint
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();

        if (session?.user?.email) {
          toast.success("מתחבר...");
          // Sellers get their own scoped area; everyone else the admin shell.
          const role = (session.user as { role?: string }).role;
          window.location.href = role === "SELLER" ? "/seller" : "/admin";
          return;
        }
      }

      toast.error("אימייל או סיסמה שגויים");
    } catch {
      toast.error("שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <Image src="/logo-white.svg" alt="Fuzion Webz" width={180} height={50} priority />
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700">
          <h1 className="text-2xl font-bold text-center mb-8">התחברות לניהול</h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm text-gray-400 mb-2">אימייל או שם משתמש</label>
              <input id="email" type="text" autoCapitalize="none" autoCorrect="off" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-transparent border-b-2 border-gray-600 focus:border-pink px-0 py-3 text-white placeholder-gray-500 outline-none transition-colors" placeholder="admin@fuzionwebz.com" dir="ltr" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-gray-400 mb-2">סיסמה</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-transparent border-b-2 border-gray-600 focus:border-pink px-0 py-3 text-white placeholder-gray-500 outline-none transition-colors" placeholder="••••••••" dir="ltr" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4">
              {loading ? "מתחבר..." : "התחבר"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
