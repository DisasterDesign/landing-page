import SeoSubNav from "@/components/admin/SeoSubNav";

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SeoSubNav />
      {children}
    </div>
  );
}
