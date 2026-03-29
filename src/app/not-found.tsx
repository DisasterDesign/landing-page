import Link from "next/link";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-[10rem] md:text-[16rem] lg:text-[20rem] font-extrabold leading-none select-none">
          <span className="text-pink">O</span>
          <span className="text-cyan">O</span>
          <span className="text-pink">P</span>
          <span className="text-cyan">S</span>
        </h1>

        <p className="text-2xl md:text-3xl font-bold text-white mb-4">
          העמוד לא נמצא
        </p>
        <p className="text-gray-400 text-lg mb-10 max-w-md mx-auto">
          נראה שהגעתם לעמוד שלא קיים. אולי הקישור שגוי או שהעמוד הוסר.
        </p>

        <Link href="/">
          <Button size="lg">חזרה לדף הבית</Button>
        </Link>
      </div>
    </div>
  );
}
