"use client";

import { useId, useState } from "react";
import { CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CONTACT_LEVELS, CONTACT_LEVEL_INFO, type ContactLevel } from "@/lib/customers";
import { INTAKE_CONTACTS_MAX } from "@/lib/customer-intake";

type Contact = { level: ContactLevel; name: string; title: string; department: string; phone: string; email: string };
const emptyContact = (): Contact => ({ level: "DIRECTOR", name: "", title: "", department: "", phone: "", email: "" });
const EMPTY = { name: "", taxCode: "", industry: "", address: "", phone: "", email: "", website: "", note: "" };

export function IntakeForm({ token }: { token: string }) {
  const [form, setForm] = useState(EMPTY);
  const [contacts, setContacts] = useState<Contact[]>([emptyContact()]);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const setContact = (i: number, patch: Partial<Contact>) => setContacts((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const res = await fetch(`/api/form/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A person never leaves every box of a contact empty on purpose: those rows are dropped.
        body: JSON.stringify({ ...form, contacts: contacts.filter((c) => c.name.trim() || c.phone.trim() || c.email.trim()), website2: trap }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Chưa gửi được, vui lòng thử lại.");
        setFields(body.fields ?? {});
        return;
      }
      setSent(true);
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="mt-8 rounded-xl border border-white/10 bg-black/45 backdrop-blur-[6px] p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">Đã gửi thông tin</h2>
        <p className="mt-1 text-sm text-muted-foreground">Cảm ơn quý công ty. Chúng tôi sẽ kiểm tra và liên hệ lại khi cần.</p>
      </div>
    );

  const err = (k: string) => fields[k];
  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      <section className="grid gap-4 rounded-xl border border-white/10 bg-black/45 backdrop-blur-[6px] p-5 sm:grid-cols-2">
        <Field htmlFor={fid("name")} label="Tên doanh nghiệp *" className="sm:col-span-2" error={err("name")}>
          <Input id={fid("name")} value={form.name} onChange={set("name")} required maxLength={200} placeholder="VD: Công ty TNHH ABC" autoComplete="organization" />
        </Field>
        <Field htmlFor={fid("taxCode")} label="Mã số thuế" error={err("taxCode")}>
          <Input id={fid("taxCode")} value={form.taxCode} onChange={set("taxCode")} maxLength={30} inputMode="numeric" placeholder="10 số" />
        </Field>
        <Field htmlFor={fid("industry")} label="Lĩnh vực" error={err("industry")}>
          <Input id={fid("industry")} value={form.industry} onChange={set("industry")} maxLength={120} placeholder="VD: Sản xuất, Giáo dục" />
        </Field>
        <Field htmlFor={fid("phone")} label="Điện thoại công ty" error={err("phone")}>
          <Input id={fid("phone")} value={form.phone} onChange={set("phone")} maxLength={40} type="tel" />
        </Field>
        <Field htmlFor={fid("email")} label="Email công ty" error={err("email")}>
          <Input id={fid("email")} value={form.email} onChange={set("email")} maxLength={200} type="email" />
        </Field>
        <Field htmlFor={fid("website")} label="Website" error={err("website")}>
          <Input id={fid("website")} value={form.website} onChange={set("website")} maxLength={200} placeholder="VD: abc.vn" />
        </Field>
        <Field htmlFor={fid("address")} label="Địa chỉ" error={err("address")}>
          <Input id={fid("address")} value={form.address} onChange={set("address")} maxLength={300} autoComplete="street-address" />
        </Field>
        <Field htmlFor={fid("note")} label="Ghi chú" className="sm:col-span-2" error={err("note")}>
          <Textarea id={fid("note")} value={form.note} onChange={set("note")} maxLength={2000} placeholder="Nhu cầu, thông tin thêm…" />
        </Field>
        {/* Honeypot: hidden from people and screen readers. */}
        <input value={trap} onChange={(e) => setTrap(e.target.value)} name="website2" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      </section>

      <section className="rounded-xl border border-white/10 bg-black/45 backdrop-blur-[6px] p-5">
        <h2 className="text-sm font-semibold">Người liên hệ</h2>
        <ul className="mt-3 space-y-4">
          {contacts.map((c, i) => (
            <li key={i} className="grid gap-3 rounded-lg border border-white/10 p-3 sm:grid-cols-2">
              <Field htmlFor={fid(`c${i}-name`)} label="Họ tên *" error={err(`contacts.${i}.name`)}>
                <Input id={fid(`c${i}-name`)} value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} maxLength={120} required={i === 0} />
              </Field>
              <Field htmlFor={fid(`c${i}-level`)} label="Vị trí">
                <Select id={fid(`c${i}-level`)} value={c.level} onChange={(e) => setContact(i, { level: e.target.value as ContactLevel })}>
                  {CONTACT_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {CONTACT_LEVEL_INFO[l].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field htmlFor={fid(`c${i}-title`)} label="Chức danh">
                <Input id={fid(`c${i}-title`)} value={c.title} onChange={(e) => setContact(i, { title: e.target.value })} maxLength={120} placeholder={CONTACT_LEVEL_INFO[c.level].titleHint} />
              </Field>
              <Field htmlFor={fid(`c${i}-department`)} label="Phòng ban">
                <Input id={fid(`c${i}-department`)} value={c.department} onChange={(e) => setContact(i, { department: e.target.value })} maxLength={120} />
              </Field>
              <Field htmlFor={fid(`c${i}-phone`)} label="Điện thoại">
                <Input id={fid(`c${i}-phone`)} value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} maxLength={40} type="tel" />
              </Field>
              <Field htmlFor={fid(`c${i}-email`)} label="Email" error={err(`contacts.${i}.email`)}>
                <Input id={fid(`c${i}-email`)} value={c.email} onChange={(e) => setContact(i, { email: e.target.value })} maxLength={200} type="email" />
              </Field>
              {contacts.length > 1 && (
                <div className="sm:col-span-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setContacts((list) => list.filter((_, j) => j !== i))}>
                    <X className="h-3.5 w-3.5" /> Bỏ người này
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {contacts.length < INTAKE_CONTACTS_MAX && (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setContacts((list) => [...list, { ...emptyContact(), level: "STAFF" }])}>
            <Plus className="h-3.5 w-3.5" /> Thêm người liên hệ
          </Button>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !form.name.trim()} className="w-full sm:w-auto">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Gửi thông tin
      </Button>
    </form>
  );
}
