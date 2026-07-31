"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Search box that syncs to the `q` URL param (debounced) —
 * the server component re-filters on navigation.
 */
export function SearchInput({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set("q", next.trim());
      else params.delete("q");
      router.replace(`?${params.toString()}`);
    }, 350);
  }

  return (
    <div className="relative w-full max-w-xs">
      <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[#8a7a6d]">
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input ps-9"
      />
    </div>
  );
}
