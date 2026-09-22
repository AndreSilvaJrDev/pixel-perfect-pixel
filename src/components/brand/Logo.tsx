import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link
      to={to}
      className={cn("inline-flex items-center gap-2 font-display", className)}
      aria-label="Professor Play — início"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
        <Play className="size-4 fill-current" aria-hidden="true" />
      </span>
      <span className="text-lg font-extrabold leading-none tracking-tight">
        Professor<span className="text-primary"> Play</span>
      </span>
    </Link>
  );
}
