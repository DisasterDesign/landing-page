export default function QualityScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-500">לא דורג</span>;
  }
  const styles = [
    "bg-red-500/15 text-red-300 border-red-500/30",
    "bg-orange-500/15 text-orange-300 border-orange-500/30",
    "bg-amber-500/15 text-amber-300 border-amber-500/30",
    "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
    "bg-cyan/10 text-cyan border-cyan/30",
  ];
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${styles[score] ?? styles[4]}`}>
      איכות אתר {score}/5
    </span>
  );
}
