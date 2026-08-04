"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { S } from "@/lib/strings";

const NAV = [
  { href: "/", label: S.navOverview, icon: "🏠" },
  { href: "/users", label: S.navUsers, icon: "👥" },
  { href: "/professionals", label: S.navProfessionals, icon: "🛠️" },
  { href: "/bookings", label: S.navBookings, icon: "📋" },
  { href: "/categories", label: S.navCategories, icon: "🗂️" },
  { href: "/cities", label: S.navCities, icon: "📍" },
  { href: "/reviews", label: S.navReviews, icon: "⭐" },
  { href: "/reports", label: S.navReports, icon: "🚩" },
  { href: "/banners", label: S.navBanners, icon: "🖼️" },
  { href: "/notifications", label: S.navNotifications, icon: "🔔" },
  { href: "/legal", label: S.navLegal, icon: "📄" },
  { href: "/audit", label: S.navAudit, icon: "🧾" },
  { href: "/settings", label: S.navSettings, icon: "⚙️" },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map((n) => {
        const active =
          n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-brand-600 font-semibold text-white shadow-sm"
                : "text-[#57493e] hover:bg-brand-50"
            }`}
          >
            <span className="text-base leading-none">{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
