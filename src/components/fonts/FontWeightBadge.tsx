"use client";

interface FontWeightBadgeProps {
  weight: number;
}

const weightColors: Record<number, string> = {
  100: "bg-gray-700 text-gray-300",
  200: "bg-gray-600 text-gray-200",
  300: "bg-gray-500 text-gray-100",
  400: "bg-cyan/20 text-cyan",
  500: "bg-cyan/30 text-cyan",
  600: "bg-pink/20 text-pink",
  700: "bg-pink/30 text-pink",
  800: "bg-pink/40 text-pink",
  900: "bg-pink/50 text-white",
};

function getWeightColor(weight: number): string {
  if (weightColors[weight]) return weightColors[weight];
  // Fallback: lighter weights get lighter colors
  if (weight <= 300) return "bg-gray-600 text-gray-200";
  if (weight <= 500) return "bg-cyan/20 text-cyan";
  return "bg-pink/30 text-pink";
}

export default function FontWeightBadge({ weight }: FontWeightBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${getWeightColor(weight)}`}
    >
      {weight}
    </span>
  );
}
