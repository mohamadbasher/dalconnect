export function formatPrice(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `₪${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ar", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ar", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
