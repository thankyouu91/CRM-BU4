"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, ClipboardList, FolderKanban, Mail, Pencil, Phone, Plus, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/client";
import { PROJECT_STATUS } from "@/lib/constants";
import { formatVnd } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/misc";
import { IntakePanel } from "@/components/customers/intake-panel";
import {
  CONTACT_LEVELS,
  CONTACT_LEVEL_INFO,
  CUSTOMER_KINDS,
  CUSTOMER_KIND_INFO,
  CUSTOMER_SIZE_INFO,
  PROJECT_STAGES,
  contactsByLevel,
  customerMatches,
  type ContactLevel,
  type CustomerKind,
  type CustomerContactDto,
  type CustomerDto,
  type CustomerProjectDto,
} from "@/lib/customers";

type CustomerForm = Pick<CustomerDto, "name" | "taxCode" | "industry" | "address" | "phone" | "email" | "website" | "note"> & { kind: CustomerKind | null };
type ContactForm = Omit<CustomerContactDto, "id">;

const EMPTY_CUSTOMER: CustomerForm = { name: "", taxCode: "", industry: "", address: "", phone: "", email: "", website: "", note: "", kind: null };

// Mới / Lead / Đã làm read from their color; the size chip stays neutral.
const KIND_CHIP: Record<CustomerKind, string> = {
  NEW: "bg-muted text-foreground/80",
  LEAD: "bg-warning/15 text-warning",
  DONE: "bg-success/15 text-success",
};
const emptyContact = (level: ContactLevel): ContactForm => ({ level, name: "", title: "", department: "", phone: "", email: "", birthday: "", note: "" });

const failure = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** "2026-03-09" → "09/03/2026". */
const showDay = (day: string | null) => (day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.split("-").reverse().join("/") : day);

/** A website as a link: "abc.vn" opens https://abc.vn. */
const siteHref = (site: string) => (/^https?:\/\//i.test(site) ? site : `https://${site}`);

export function CustomersView({
  initial,
  canManage,
  focus = null,
  pendingIntake = 0,
}: {
  initial: CustomerDto[];
  canManage: boolean;
  focus?: string | null;
  /** Answers from the company form waiting for review. */
  pendingIntake?: number;
}) {
  const [customers, setCustomers] = useState(initial);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [pending, setPending] = useState(pendingIntake);
  const upsertCustomer = (c: CustomerDto) =>
    setCustomers((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c].sort((a, b) => a.name.localeCompare(b.name, "vi"))));
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CustomerKind | "ALL">("ALL");
  const [open, setOpen] = useState<Set<string>>(() => new Set(focus ? [focus] : initial.length === 1 ? [initial[0].id] : []));
  // Opened from a project's header: bring that company into view.
  useEffect(() => {
    if (focus) document.getElementById(`customer-card-${focus}`)?.scrollIntoView({ block: "start" });
  }, [focus]);
  const [editingCustomer, setEditingCustomer] = useState<{ id: string | null; form: CustomerForm } | null>(null);
  const [editingContact, setEditingContact] = useState<{ customerId: string; id: string | null; form: ContactForm } | null>(null);
  const [removing, setRemoving] = useState<{ kind: "customer"; customer: CustomerDto } | { kind: "contact"; customerId: string; contact: CustomerContactDto } | null>(null);

  const shown = useMemo(() => customers.filter((c) => (kind === "ALL" || c.kind === kind) && customerMatches(c, query)), [customers, query, kind]);
  const kindCount = (k: CustomerKind) => customers.filter((c) => c.kind === k).length;
  const people = customers.reduce((n, c) => n + c.contacts.length, 0);
  const projectCount = customers.reduce((n, c) => n + c.projects.length, 0);
  // While searching, every match is open so the person found is in view.
  const isOpen = (id: string) => (query.trim() ? true : open.has(id));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const replaceCustomer = (id: string, update: (c: CustomerDto) => CustomerDto) => setCustomers((list) => list.map((c) => (c.id === id ? update(c) : c)));

  const saveCustomer = async () => {
    if (!editingCustomer) return;
    const { id, form } = editingCustomer;
    try {
      if (id) {
        const res = await api<{ customer: CustomerDto }>(`/api/customers/${id}`, { method: "PATCH", body: form });
        replaceCustomer(id, () => res.customer);
        toast.success("Đã lưu thông tin doanh nghiệp");
      } else {
        const res = await api<{ customer: CustomerDto }>("/api/customers", { method: "POST", body: form });
        setCustomers((list) => [...list, res.customer].sort((a, b) => a.name.localeCompare(b.name, "vi")));
        setOpen((prev) => new Set(prev).add(res.customer.id));
        toast.success(`Đã thêm “${res.customer.name}”`);
      }
      setEditingCustomer(null);
    } catch (e) {
      toast.error(failure(e, "Không lưu được, thử lại sau"));
    }
  };

  const saveContact = async () => {
    if (!editingContact) return;
    const { customerId, id, form } = editingContact;
    try {
      if (id) {
        const res = await api<{ contact: CustomerContactDto }>(`/api/customer-contacts/${id}`, { method: "PATCH", body: form });
        replaceCustomer(customerId, (c) => ({ ...c, contacts: c.contacts.map((p) => (p.id === id ? res.contact : p)) }));
      } else {
        const res = await api<{ contact: CustomerContactDto }>(`/api/customers/${customerId}/contacts`, { method: "POST", body: form });
        replaceCustomer(customerId, (c) => ({ ...c, contacts: [...c.contacts, res.contact] }));
      }
      toast.success("Đã lưu người liên hệ");
      setEditingContact(null);
    } catch (e) {
      toast.error(failure(e, "Không lưu được, thử lại sau"));
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      if (removing.kind === "customer") {
        await api(`/api/customers/${removing.customer.id}`, { method: "DELETE" });
        setCustomers((list) => list.filter((c) => c.id !== removing.customer.id));
        toast.success(`Đã xoá “${removing.customer.name}”`);
      } else {
        await api(`/api/customer-contacts/${removing.contact.id}`, { method: "DELETE" });
        replaceCustomer(removing.customerId, (c) => ({ ...c, contacts: c.contacts.filter((p) => p.id !== removing.contact.id) }));
        toast.success(`Đã xoá “${removing.contact.name}”`);
      }
      setRemoving(null);
    } catch (e) {
      toast.error(failure(e, "Không xoá được, thử lại sau"));
    }
  };

  return (
    <div>
      <PageHeader
        title="Khách hàng"
        description={customers.length ? `${customers.length} doanh nghiệp · ${people} người liên hệ · ${projectCount} dự án` : "Doanh nghiệp khách hàng và người liên hệ theo từng vị trí."}
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={() => setIntakeOpen(true)}>
                <ClipboardList className="h-4 w-4" /> Form thông tin
                {pending > 0 && <span className="rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-4 text-white">{pending}</span>}
              </Button>
              <Button onClick={() => setEditingCustomer({ id: null, form: EMPTY_CUSTOMER })}>
                <Plus className="h-4 w-4" /> Thêm khách hàng
              </Button>
            </>
          )
        }
      />
      {canManage && <IntakePanel open={intakeOpen} onClose={() => setIntakeOpen(false)} customers={customers} onCustomer={upsertCustomer} onDecided={() => setPending((n) => Math.max(0, n - 1))} />}

      {customers.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm doanh nghiệp, người, số điện thoại, email" aria-label="Tìm khách hàng" className="pl-9" />
          </div>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "ALL" as const, label: `Tất cả ${customers.length}` },
              ...CUSTOMER_KINDS.map((k) => ({ value: k, label: `${CUSTOMER_KIND_INFO[k].label} ${kindCount(k)}` })),
            ]}
          />
        </div>
      )}

      {customers.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Building2}
            title="Chưa có khách hàng nào"
            description={canManage ? "Thêm doanh nghiệp đầu tiên, rồi điền người liên hệ theo từng vị trí." : "Người có quyền “Quản lý khách hàng” sẽ thêm doanh nghiệp vào đây."}
            action={
              canManage && (
                <Button onClick={() => setEditingCustomer({ id: null, form: EMPTY_CUSTOMER })}>
                  <Plus className="h-4 w-4" /> Thêm khách hàng
                </Button>
              )
            }
          />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={Search} title="Không tìm thấy" description={query.trim() ? `Không có doanh nghiệp hay người liên hệ nào khớp “${query.trim()}”.` : "Không có khách hàng nào thuộc loại này."} />
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              open={isOpen(customer.id)}
              onToggle={() => toggle(customer.id)}
              canManage={canManage}
              onEdit={() => setEditingCustomer({ id: customer.id, form: pickCustomer(customer) })}
              onDelete={() => setRemoving({ kind: "customer", customer })}
              onAddContact={(level) => setEditingContact({ customerId: customer.id, id: null, form: emptyContact(level) })}
              onEditContact={(contact) => setEditingContact({ customerId: customer.id, id: contact.id, form: pickContact(contact) })}
              onDeleteContact={(contact) => setRemoving({ kind: "contact", customerId: customer.id, contact })}
            />
          ))}
        </ul>
      )}

      {editingCustomer && (
        <CustomerModal
          title={editingCustomer.id ? "Sửa thông tin doanh nghiệp" : "Thêm khách hàng"}
          form={editingCustomer.form}
          onChange={(form) => setEditingCustomer({ ...editingCustomer, form })}
          onClose={() => setEditingCustomer(null)}
          onSave={saveCustomer}
        />
      )}
      {editingContact && (
        <ContactModal
          title={editingContact.id ? "Sửa người liên hệ" : `Thêm ${CONTACT_LEVEL_INFO[editingContact.form.level].label.toLowerCase()}`}
          company={customers.find((c) => c.id === editingContact.customerId)?.name ?? ""}
          form={editingContact.form}
          onChange={(form) => setEditingContact({ ...editingContact, form })}
          onClose={() => setEditingContact(null)}
          onSave={saveContact}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        danger
        confirmLabel="Xoá"
        title={removing?.kind === "customer" ? "Xoá khách hàng?" : "Xoá người liên hệ?"}
        message={
          removing?.kind === "customer"
            ? `“${removing.customer.name}” và ${removing.customer.contacts.length} người liên hệ của doanh nghiệp này sẽ bị xoá.`
            : removing
              ? `Xoá “${removing.contact.name}” khỏi danh sách liên hệ.`
              : ""
        }
      />
    </div>
  );
}

const pickCustomer = (c: CustomerDto): CustomerForm => ({
  name: c.name,
  taxCode: c.taxCode ?? "",
  industry: c.industry ?? "",
  address: c.address ?? "",
  phone: c.phone ?? "",
  email: c.email ?? "",
  website: c.website ?? "",
  note: c.note ?? "",
  kind: c.kindManual ? c.kind : null,
});

const pickContact = (c: CustomerContactDto): ContactForm => ({
  level: c.level,
  name: c.name,
  title: c.title ?? "",
  department: c.department ?? "",
  phone: c.phone ?? "",
  email: c.email ?? "",
  birthday: c.birthday ?? "",
  note: c.note ?? "",
});

function CustomerCard({
  customer,
  open,
  onToggle,
  canManage,
  onEdit,
  onDelete,
  onAddContact,
  onEditContact,
  onDeleteContact,
}: {
  customer: CustomerDto;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddContact: (level: ContactLevel) => void;
  onEditContact: (contact: CustomerContactDto) => void;
  onDeleteContact: (contact: CustomerContactDto) => void;
}) {
  const groups = contactsByLevel(customer.contacts);
  const sub = [customer.industry, customer.taxCode && `MST ${customer.taxCode}`].filter(Boolean).join(" · ");
  const panel = `customer-${customer.id}`;
  return (
    <li id={`customer-card-${customer.id}`} className="scroll-mt-20 overflow-hidden rounded-xl border bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panel} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground/80" aria-hidden>
          {customer.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{customer.name}</span>
          {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
        </span>
        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium", KIND_CHIP[customer.kind])} title={CUSTOMER_KIND_INFO[customer.kind].hint}>
          {CUSTOMER_KIND_INFO[customer.kind].label}
        </span>
        {customer.size && (
          <span className="hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] text-foreground/80 sm:inline" title={`Theo tổng giá trị hợp đồng: ${CUSTOMER_SIZE_INFO[customer.size].range}`}>
            Size {CUSTOMER_SIZE_INFO[customer.size].label}
          </span>
        )}
        <span className="hidden shrink-0 items-center gap-1.5 lg:flex">
          {groups.map((g) => (
            <span key={g.level} className={cn("rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums", g.contacts.length ? "text-foreground/80" : "text-muted-foreground/60")}>
              {CONTACT_LEVEL_INFO[g.level].label} {g.contacts.length}
            </span>
          ))}
        </span>
        <span className="hidden shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums text-foreground/80 md:flex">
          <FolderKanban className="h-3 w-3" aria-hidden /> {customer.projects.length} dự án
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground md:hidden">
          {customer.contacts.length} người · {customer.projects.length} dự án
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div id={panel} className="border-t">
          <CompanyDetails customer={customer} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
          <div className="divide-y">
            <ProjectsSection projects={customer.projects} />
            {groups.map((g) => (
              <LevelSection
                key={g.level}
                level={g.level}
                contacts={g.contacts}
                canManage={canManage}
                onAdd={() => onAddContact(g.level)}
                onEdit={onEditContact}
                onDelete={onDeleteContact}
              />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function CompanyDetails({ customer, canManage, onEdit, onDelete }: { customer: CustomerDto; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const size = customer.size && CUSTOMER_SIZE_INFO[customer.size];
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Loại khách hàng",
      value: (
        <>
          {CUSTOMER_KIND_INFO[customer.kind].label}
          <span className="text-xs text-muted-foreground">
            {customer.kindManual ? ` · chọn tay (tự tính: ${CUSTOMER_KIND_INFO[customer.kindAuto].label})` : " · tự tính theo dự án, hợp đồng"}
          </span>
        </>
      ),
    },
    {
      label: "Size khách hàng",
      value: size ? (
        <>
          {size.label} <span className="text-xs text-muted-foreground">· {customer.contractValue != null ? `tổng hợp đồng ${formatVnd(customer.contractValue)}` : `hợp đồng ${size.range}`}</span>
        </>
      ) : (
        <span className="text-muted-foreground">Chưa có hợp đồng</span>
      ),
    },
    { label: "Mã số thuế", value: customer.taxCode },
    { label: "Lĩnh vực", value: customer.industry },
    { label: "Điện thoại", value: customer.phone && <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className="hover:underline">{customer.phone}</a> },
    { label: "Email", value: customer.email && <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a> },
    { label: "Website", value: customer.website && <a href={siteHref(customer.website)} target="_blank" rel="noreferrer" className="hover:underline">{customer.website}</a> },
    { label: "Địa chỉ", value: customer.address },
  ];
  const filled = rows.filter((r) => r.value);
  return (
    <div className="bg-muted/30 px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Thông tin doanh nghiệp</p>
        {canManage && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Sửa
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Xoá ${customer.name}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      {filled.length ? (
        <dl className="mt-2 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {filled.map((r) => (
            <div key={r.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd className="break-words">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Chưa có thông tin.{canManage && " Bấm Sửa để điền mã số thuế, địa chỉ, liên hệ."}</p>
      )}
      {customer.note && <p className="mt-3 whitespace-pre-line text-sm text-foreground/80">{customer.note}</p>}
    </div>
  );
}

function ProjectsSection({ projects }: { projects: CustomerProjectDto[] }) {
  return (
    <section className="px-4 py-4 sm:px-5" aria-label="Dự án">
      <h3 className="mb-2 text-sm font-semibold">
        Dự án <span className="font-normal text-muted-foreground">({projects.length})</span>
      </h3>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có dự án nào gắn với khách hàng này. Chọn khách hàng trong phần sửa dự án.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {PROJECT_STAGES.map((stage) => {
            const list = projects.filter((p) => (stage.statuses as readonly string[]).includes(p.status));
            return (
              <div key={stage.key} className="min-w-0">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {stage.label} ({list.length})
                </p>
                {list.length ? (
                  <ul className="space-y-1.5">
                    {list.map((p) => (
                      <li key={p.id}>
                        <Link href={`/projects/${p.id}`} className="flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/60">
                          <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
                          <span className="truncate">{p.name}</span>
                          {p.status === "ON_HOLD" && <span className="shrink-0 text-xs text-muted-foreground">{PROJECT_STATUS.ON_HOLD.label}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground/70">Không có</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
function LevelSection({
  level,
  contacts,
  canManage,
  onAdd,
  onEdit,
  onDelete,
}: {
  level: ContactLevel;
  contacts: CustomerContactDto[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (contact: CustomerContactDto) => void;
  onDelete: (contact: CustomerContactDto) => void;
}) {
  const label = CONTACT_LEVEL_INFO[level].label;
  return (
    <section className="px-4 py-4 sm:px-5" aria-label={label}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {label} <span className="font-normal text-muted-foreground">({contacts.length})</span>
        </h3>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onAdd} aria-label={`Thêm ${label.toLowerCase()}`}>
            <Plus className="h-3.5 w-3.5" /> Thêm
          </Button>
        )}
      </div>
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có thông tin.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-3 py-2.5">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="grid min-w-0 flex-1 gap-x-6 gap-y-1 text-sm md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  {(c.title || c.department) && <p className="truncate text-xs text-muted-foreground">{[c.title, c.department].filter(Boolean).join(" · ")}</p>}
                </div>
                <div className="min-w-0 space-y-0.5">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 truncate hover:underline">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 truncate hover:underline">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> <span className="truncate">{c.email}</span>
                    </a>
                  )}
                </div>
                <div className="min-w-0 text-xs text-muted-foreground">
                  {c.birthday && <p>Sinh nhật {showDay(c.birthday)}</p>}
                  {c.note && <p className="line-clamp-2 whitespace-pre-line">{c.note}</p>}
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)} aria-label={`Sửa ${c.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(c)} aria-label={`Xoá ${c.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FormFooter({ onClose, saving, disabled, onSave }: { onClose: () => void; saving: boolean; disabled: boolean; onSave: () => void }) {
  return (
    <>
      <Button variant="outline" onClick={onClose} disabled={saving}>
        Huỷ
      </Button>
      <Button onClick={onSave} loading={saving} disabled={disabled}>
        Lưu
      </Button>
    </>
  );
}

function useSaving(onSave: () => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const run = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };
  return { saving, run };
}

function CustomerModal({ title, form, onChange, onClose, onSave }: { title: string; form: CustomerForm; onChange: (f: CustomerForm) => void; onClose: () => void; onSave: () => Promise<void> }) {
  const { saving, run } = useSaving(onSave);
  const set = (key: keyof CustomerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...form, [key]: e.target.value });
  return (
    <Modal open onClose={onClose} title={title} size="lg" footer={<FormFooter onClose={onClose} saving={saving} disabled={!form.name.trim()} onSave={run} />}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name.trim()) run();
        }}
      >
        <Field label="Tên doanh nghiệp" className="sm:col-span-2">
          <Input value={form.name} onChange={set("name")} placeholder="VD: Công ty TNHH ABC" autoFocus required maxLength={200} />
        </Field>
        <Field label="Mã số thuế">
          <Input value={form.taxCode ?? ""} onChange={set("taxCode")} maxLength={30} inputMode="numeric" />
        </Field>
        <Field label="Lĩnh vực">
          <Input value={form.industry ?? ""} onChange={set("industry")} maxLength={120} placeholder="VD: Sản xuất, Giáo dục" />
        </Field>
        <Field label="Điện thoại">
          <Input value={form.phone ?? ""} onChange={set("phone")} maxLength={40} type="tel" />
        </Field>
        <Field label="Email">
          <Input value={form.email ?? ""} onChange={set("email")} maxLength={200} type="email" />
        </Field>
        <Field label="Website">
          <Input value={form.website ?? ""} onChange={set("website")} maxLength={200} placeholder="VD: abc.vn" />
        </Field>
        <Field label="Địa chỉ">
          <Input value={form.address ?? ""} onChange={set("address")} maxLength={300} />
        </Field>
        <Field label="Loại khách hàng" hint="Để “Tự tính” thì CRM xếp theo dự án và hợp đồng của doanh nghiệp.">
          <Select value={form.kind ?? ""} onChange={(e) => onChange({ ...form, kind: (e.target.value || null) as CustomerKind | null })}>
            <option value="">Tự tính</option>
            {CUSTOMER_KINDS.map((k) => (
              <option key={k} value={k}>
                {CUSTOMER_KIND_INFO[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ghi chú" className="sm:col-span-2">
          <Textarea value={form.note ?? ""} onChange={set("note")} maxLength={2000} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ContactModal({
  title,
  company,
  form,
  onChange,
  onClose,
  onSave,
}: {
  title: string;
  company: string;
  form: ContactForm;
  onChange: (f: ContactForm) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const { saving, run } = useSaving(onSave);
  const set = (key: keyof ContactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ ...form, [key]: e.target.value });
  return (
    <Modal open onClose={onClose} title={title} description={company} size="lg" footer={<FormFooter onClose={onClose} saving={saving} disabled={!form.name.trim()} onSave={run} />}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name.trim()) run();
        }}
      >
        <Field label="Họ tên">
          <Input value={form.name} onChange={set("name")} autoFocus required maxLength={120} />
        </Field>
        <Field label="Vị trí">
          <Select value={form.level} onChange={set("level")}>
            {CONTACT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {CONTACT_LEVEL_INFO[l].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Chức danh">
          <Input value={form.title ?? ""} onChange={set("title")} maxLength={120} placeholder={CONTACT_LEVEL_INFO[form.level].titleHint} />
        </Field>
        <Field label="Phòng ban">
          <Input value={form.department ?? ""} onChange={set("department")} maxLength={120} />
        </Field>
        <Field label="Điện thoại">
          <Input value={form.phone ?? ""} onChange={set("phone")} maxLength={40} type="tel" />
        </Field>
        <Field label="Email">
          <Input value={form.email ?? ""} onChange={set("email")} maxLength={200} type="email" />
        </Field>
        <Field label="Ngày sinh">
          <Input value={form.birthday ?? ""} onChange={set("birthday")} type="date" />
        </Field>
        <Field label="Ghi chú" className="sm:col-span-2">
          <Textarea value={form.note ?? ""} onChange={set("note")} maxLength={2000} placeholder="Sở thích, lần gặp gần nhất, người giới thiệu…" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
