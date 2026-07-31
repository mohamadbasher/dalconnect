export function EmptyState({
  icon = "🗂️",
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-14 text-center">
      <div className="text-4xl opacity-60">{icon}</div>
      <div className="text-sm font-semibold text-[#57493e]">{title}</div>
      {subtitle && <div className="text-xs text-[#8a7a6d]">{subtitle}</div>}
    </div>
  );
}
