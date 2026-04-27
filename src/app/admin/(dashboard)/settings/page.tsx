"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PushNotificationToggle from "@/components/admin/PushNotificationToggle";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "מנהל", color: "bg-pink/20 text-pink" },
  MEMBER: { label: "חבר צוות", color: "bg-cyan/20 text-cyan" },
};

export default function SettingsPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeam() {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          setTeam(Array.isArray(data) ? data : data.users || []);
        }
      } catch (err) {
        console.error("Failed to fetch team:", err);
        // Fallback to hardcoded data
        setTeam([
          { id: "1", name: "אלעד ניסים", email: "elad@fuzionwebz.com", role: "ADMIN" },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchTeam();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 rounded-2xl border border-gray-700 h-20 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">הגדרות</h2>

      {/* Team Members */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4">
        <h3 className="text-lg font-bold">חברי צוות</h3>

        {team.length === 0 ? (
          <p className="text-sm text-gray-500">אין חברי צוות</p>
        ) : (
          <div className="space-y-3">
            {team.map((member) => {
              const roleInfo = roleLabels[member.role] || roleLabels.MEMBER;
              const initials = member.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between bg-gray-800 rounded-xl p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-pink/20 text-pink flex items-center justify-center text-sm font-bold">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {member.name}
                      </p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] px-3 py-1 rounded-full font-medium ${roleInfo.color}`}
                  >
                    {roleInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integrations */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-3">
        <h3 className="text-lg font-bold">אינטגרציות</h3>
        <p className="text-sm text-gray-400 leading-relaxed">
          חבר מקורות לידים חיצוניים שיזרמו אוטומטית למערכת.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href="/admin/integrations/facebook"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-sm"
          >
            <span>📘</span>
            Facebook Lead Ads
          </a>
          <a
            href="/admin/seo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-sm"
          >
            <span>🔍</span>
            Google (SEO + Analytics)
          </a>
        </div>
      </div>

      {/* Push notifications */}
      <PushNotificationToggle />

      {/* PWA install banner reset */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-3">
        <h3 className="text-lg font-bold">אפליקציה במסך הבית</h3>
        <p className="text-sm text-gray-400 leading-relaxed">
          אם סגרת את באנר ההתקנה ואתה רוצה לראות אותו שוב — לחץ כאן ורענן את העמוד.
        </p>
        <button
          onClick={() => {
            try {
              localStorage.removeItem("fw-install-dismissed-at");
              localStorage.removeItem("fw-install-dismissed");
              toast.success("רענן את העמוד כדי לראות את הבאנר שוב.");
            } catch {
              toast.error("שגיאה");
            }
          }}
          className="bg-pink hover:bg-pink-light text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          אפס באנר התקנה
        </button>
      </div>
    </div>
  );
}
