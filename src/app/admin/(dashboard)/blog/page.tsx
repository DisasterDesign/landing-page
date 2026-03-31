"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string };
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch("/api/blog?all=true&limit=50");
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || []);
        }
      } catch (err) {
        console.error("Failed to fetch posts:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">בלוג</h2>
        <Link
          href="/admin/blog/new"
          className="bg-pink hover:bg-pink-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          + מאמר חדש
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">אין מאמרים עדיין</p>
          <p className="text-sm">צור את המאמר הראשון שלך</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-right px-4 py-3 font-medium">כותרת</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">קטגוריה</th>
                <th className="text-right px-4 py-3 font-medium">סטטוס</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">מחבר</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  onClick={() => router.push(`/admin/blog/${post.id}/edit`)}
                  className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium">{post.title}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {post.category || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {post.published ? (
                      <span className="bg-green-900/50 text-green-400 text-xs px-2.5 py-1 rounded-full font-medium">
                        פורסם
                      </span>
                    ) : (
                      <span className="bg-yellow-900/50 text-yellow-400 text-xs px-2.5 py-1 rounded-full font-medium">
                        טיוטה
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {post.author.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {new Date(post.updatedAt).toLocaleDateString("he-IL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
