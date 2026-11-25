"use client";

import { useId, useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { fold } from "@/lib/customers";
import { cn } from "@/lib/utils";

export interface CustomerOption {
  id: string;
  name: string;
}

/** Customers whose name holds every word typed, accents ignored; exact and prefix matches first. */
export function matchCustomers(customers: CustomerOption[], text: string, limit = 8): CustomerOption[] {
  const q = fold(text.trim());
  if (!q) return customers.slice(0, limit);
  const words = q.split(/\s+/);
  return customers
    .map((c) => ({ c, name: fold(c.name) }))
    .filter(({ name }) => words.every((w) => name.includes(w)))
    .sort((a, b) => Number(b.name === q) - Number(a.name === q) || Number(b.name.startsWith(q)) - Number(a.name.startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ c }) => c);
}

/**
 * The listed customer with exactly this name, case ignored, if any. Accents count: "Lam" and
 * "Lâm" are different companies (the server compares the same way).
 */
export const exactCustomer = (customers: CustomerOption[], text: string) => {
  const same = (s: string) => s.normalize("NFC").trim().toLocaleLowerCase("vi");
  const q = same(text);
  return q ? customers.find((c) => same(c.name) === q) : undefined;
};

/**
 * Tên doanh nghiệp of a project: type to see matching companies from the customer list and
 * pick one; a name that is not in the list is added to it when the project is saved.
 */
export function CustomerInput({
  customers,
  customerId,
  text,
  onChange,
}: {
  customers: CustomerOption[] | null;
  customerId: string | null;
  text: string;
  onChange: (value: { customerId: string | null; text: string }) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits = useMemo(() => (customers ? matchCustomers(customers, text) : []), [customers, text]);
  const show = open && hits.length > 0;

  const type = (next: string) => {
    // Typing the exact name of a listed company is the same as picking it.
    onChange({ customerId: customers ? (exactCustomer(customers, next)?.id ?? null) : null, text: next });
    setOpen(true);
    setActive(0);
  };
  const pick = (c: CustomerOption) => {
    onChange({ customerId: c.id, text: c.name });
    setOpen(false);
  };

  const isNew = !customerId && text.trim().length > 0;
  return (
    <div className="relative">
      <div className="relative">
        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          role="combobox"
          aria-label="Khách hàng"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={show ? `${listId}-${active}` : undefined}
          value={text}
          maxLength={200}
          placeholder={customers === null ? "Đang tải danh sách…" : "Gõ tên doanh nghiệp (để trống nếu không gắn)"}
          onChange={(e) => type(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              if (hits.length) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
            } else if (e.key === "Enter" && show) {
              e.preventDefault();
              pick(hits[active]);
            } else if (e.key === "Escape" && show) {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>
      {show && (
        <ul id={listId} role="listbox" aria-label="Doanh nghiệp trong danh sách" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-card p-1 shadow-lg">
          {hits.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={c.id === customerId}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer truncate rounded-md px-2.5 py-1.5 text-sm", i === active && "bg-muted", c.id === customerId && "font-medium")}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
      {isNew && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Plus className="h-3 w-3 shrink-0" aria-hidden /> Doanh nghiệp mới: khi lưu dự án, “{text.trim()}” được thêm vào danh sách Khách hàng.
        </p>
      )}
    </div>
  );
}
