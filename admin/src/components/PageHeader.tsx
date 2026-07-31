export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[#8a7a6d]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
