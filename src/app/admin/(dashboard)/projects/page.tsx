"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  client: string | null;
  status: string;
  _count?: { tasks: number };
  taskCount?: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "פעיל", color: "bg-green-900/60 text-green-300" },
  ON_HOLD: { label: "בהמתנה", color: "bg-yellow-900/60 text-yellow-300" },
  COMPLETED: { label: "הושלם", color: "bg-blue-900/60 text-blue-300" },
  ARCHIVED: { label: "בארכיון", color: "bg-gray-700 text-gray-400" },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(Array.isArray(data) ? data : data.data || data.projects || []);
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 rounded-2xl border border-gray-700 h-40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">פרויקטים</h2>
        <Link
          href="/admin/projects/new"
          className="flex items-center gap-2 px-4 py-2 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          הוסף פרויקט
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg mb-4">אין פרויקטים עדיין</p>
          <Link
            href="/admin/projects/new"
            className="text-pink hover:underline text-sm"
          >
            צור פרויקט ראשון
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const statusInfo = statusConfig[project.status] || statusConfig.ACTIVE;
            const taskCount = project._count?.tasks ?? project.taskCount ?? 0;

            return (
              <Link
                key={project.id}
                href={`/admin/projects/${project.id}`}
                className="bg-gray-900 rounded-2xl border border-gray-700 hover:border-gray-600 p-6 transition-colors block space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white mb-1">{project.name}</h3>
                    {project.client && (
                      <p className="text-sm text-gray-400">{project.client}</p>
                    )}
                  </div>
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{taskCount} משימות</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
