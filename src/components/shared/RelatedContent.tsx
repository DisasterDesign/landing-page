import Link from "next/link";
import Card from "@/components/ui/Card";

interface RelatedItem {
  title: string;
  href: string;
  description?: string;
  category?: string;
}

interface RelatedContentProps {
  title?: string;
  items: RelatedItem[];
}

export default function RelatedContent({
  title = "תוכן קשור",
  items,
}: RelatedContentProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-16 pt-8 border-t border-gray-200">
      <h2 className="text-2xl font-bold text-black mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="block group">
            <Card className="h-full transition-all group-hover:border-gray-400">
              {item.category && (
                <span className="text-cyan-dark text-xs font-medium mb-2 block">
                  {item.category}
                </span>
              )}
              <h3 className="text-black font-bold group-hover:text-pink transition-colors">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-gray-700 text-sm mt-2 line-clamp-2">
                  {item.description}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
