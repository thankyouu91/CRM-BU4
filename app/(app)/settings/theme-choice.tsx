"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/misc";
import { useBrowserValue } from "@/lib/client";

type Choice = "light" | "dark" | "system";

function apply(choice: Choice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    if (choice === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", choice);
  } catch {
    /* storage unavailable — the choice still applies for this page view */
  }
}

function savedChoice(): Choice {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

export function ThemeChoice() {
  const saved = useBrowserValue(savedChoice, "system");
  // What was picked here; until then the saved choice.
  const [picked, setPicked] = useState<Choice | null>(null);
  const choice = picked ?? saved;

  return (
    <Segmented
      layoutId="theme-choice"
      value={choice}
      onChange={(c) => {
        setPicked(c);
        apply(c);
      }}
      options={[
        { value: "light", label: <><Sun className="h-3.5 w-3.5" /> Sáng</> },
        { value: "dark", label: <><Moon className="h-3.5 w-3.5" /> Tối</> },
        { value: "system", label: <><Monitor className="h-3.5 w-3.5" /> Theo hệ thống</> },
      ]}
    />
  );
}
