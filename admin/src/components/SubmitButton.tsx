"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  label,
  className = "btn-primary",
  pendingLabel,
}: {
  label: string;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel ?? "…" : label}
    </button>
  );
}
