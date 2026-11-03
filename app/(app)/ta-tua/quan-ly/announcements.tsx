"use client";

import { useMemo, useState } from "react";
import { Eye, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client";
import { renderAnnouncement } from "@/public/ta-tua/game/js/shared/announce.js";
import { ADMIN, errorText, Failure, useLoad, when } from "./shared";

// Announcements for players: pinned at the top of the in-game newspaper (Báo Trân Châu) and shown once
// as a pop-up when a player opens the game. Formatting rules live in public/ta-tua/game/js/shared/announce.js.

interface Announcement {
  id: number;
  title: string;
  body: string;
  popup: boolean;
  createdBy: string | null;
  createdAt: number;
  startsAt: number;
  endsAt: number;
  removedAt: number | null;
}
interface AnnouncementData {
  announcements: Announcement[];
  rules: { maxTitle: number; maxBody: number; minDays: number; maxDays: number; defaultDays: number };
}

const FORMAT_HINT = "## tiêu đề mục · - gạch đầu dòng · **chữ đậm** · | bảng | như | thế này | · --- để ngăn mục · dòng trống để tách đoạn";

export function AnnouncementsTab() {
  const { data, error, loading, reload } = useLoad<AnnouncementData>(`${ADMIN}/announcements`);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [days, setDays] = useState("7");
  const [popup, setPopup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState<Announcement | null>(null);
  const [viewing, setViewing] = useState<Announcement | null>(null);
  const rules = data?.rules;
  // renderAnnouncement escapes every character before adding its few tags, so the preview is safe to inject.
  const preview = useMemo(() => renderAnnouncement(body), [body]);
  const now = Date.now();
  const live = (a: Announcement) => !a.removedAt && a.startsAt <= now && a.endsAt > now;

  const post = async () => {
    setBusy(true);
    try {
      await api(`${ADMIN}/announcements`, { method: "POST", body: { title: title.trim(), body, days: Number(days), popup } });
      toast.success("Đã đăng thông báo, người chơi thấy ngay");
      setTitle("");
      setBody("");
      reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      await api(`${ADMIN}/announcements/${removing.id}/delete`, { method: "POST", body: { announcementTitle: removing.title } });
      toast.success("Đã gỡ thông báo");
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-muted-foreground" /> Đăng thông báo</span>}
          description="Thông báo ghim ở đầu Báo Trân Châu trong game. Nếu bật lên, mỗi người chơi thấy nó hiện ra một lần khi mở game."
        />
        <CardBody className="space-y-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <Field label="Tiêu đề" hint={rules ? `tối đa ${rules.maxTitle} ký tự` : undefined}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={rules?.maxTitle ?? 120} placeholder="Pet Town cập nhật lớn" />
            </Field>
            <Field label="Hiện trong" hint={rules ? `${rules.minDays}–${rules.maxDays} ngày` : undefined}>
              <Input type="number" min={rules?.minDays ?? 1} max={rules?.maxDays ?? 30} step={1} value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
          </div>
          <Field label="Nội dung" hint={FORMAT_HINT}>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} maxLength={rules?.maxBody ?? 8000} className="font-mono text-xs" placeholder={"Chào các sen!\n\n## Tính năng mới\n- Đấu giá trang phục ở Chợ Phiên\n- **Bán nhanh** cho Siêu thị"} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={popup} onChange={(e) => setPopup(e.target.checked)} />
              Bật lên một lần cho mỗi người chơi
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">{body.length.toLocaleString("vi-VN")} / {(rules?.maxBody ?? 8000).toLocaleString("vi-VN")} ký tự</span>
          </div>
          {body.trim() && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Xem trước (đúng định dạng trong game)</p>
              <p className="mb-2 font-semibold">📣 {title || "(chưa có tiêu đề)"}</p>
              <div className="announcement-preview space-y-2 text-sm [&_h4]:mt-3 [&_h4]:font-semibold [&_hr]:my-2 [&_table]:w-full [&_td]:border-b [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setConfirming(true)} disabled={busy || !title.trim() || !body.trim()}><Send className="h-4 w-4" /> Đăng thông báo</Button>
          </div>
        </CardBody>
      </Card>

      {error ? (
        <Failure error={error} onRetry={reload} />
      ) : (
        <Card>
          <CardHeader title="Thông báo đã đăng" description="Gỡ thì người chơi không thấy nữa; lịch sử vẫn giữ ở đây và trong Nhật ký." />
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : data?.announcements.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Tiêu đề</th>
                    <th className="px-3 py-2.5 font-medium">Hiện tới</th>
                    <th className="px-3 py-2.5 font-medium">Đăng bởi</th>
                    <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.announcements.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{a.title}</span>
                        {a.popup && <span className="block text-xs text-muted-foreground">Bật lên một lần</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{when(a.endsAt)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.createdBy ?? "–"} · {when(a.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewing(viewing?.id === a.id ? null : a)}><Eye className="h-4 w-4" /> Xem</Button>
                          {live(a) ? (
                            <>
                              <Badge className="bg-success/10 text-success">Đang hiện</Badge>
                              <Button size="sm" variant="ghost" onClick={() => setRemoving(a)}>Gỡ</Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">{a.removedAt ? "Đã gỡ" : "Hết hạn"}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewing && (
                <div className="border-t bg-muted/30 p-4 text-sm">
                  <p className="mb-2 font-semibold">📣 {viewing.title}</p>
                  <div className="space-y-2 [&_h4]:mt-3 [&_h4]:font-semibold [&_table]:w-full [&_td]:border-b [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: renderAnnouncement(viewing.body) }} />
                </div>
              )}
            </div>
          ) : (
            <EmptyState icon={Megaphone} title="Chưa có thông báo nào" description="Soạn ở trên rồi bấm Đăng." />
          )}
        </Card>
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={post}
        title="Đăng thông báo cho mọi người chơi?"
        message={`“${title.trim()}” sẽ hiện ngay ở đầu Báo Trân Châu trong ${days} ngày${popup ? " và bật lên một lần cho mỗi người chơi" : ""}.`}
        confirmLabel="Đăng"
      />
      <ConfirmDialog open={removing !== null} onClose={() => setRemoving(null)} onConfirm={remove} title="Gỡ thông báo?" message={`“${removing?.title ?? ""}” sẽ không hiện cho người chơi nữa.`} confirmLabel="Gỡ" danger />
    </div>
  );
}
