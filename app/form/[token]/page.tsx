import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { openIntakeLink } from "@/lib/customer-intake-queries";
import { BlackHoleBackground } from "@/components/form/black-hole-background";
import { IntakeForm } from "./intake-form";

// Never cached or indexed (middleware.ts): the link is checked each time it is opened.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thông tin doanh nghiệp", robots: { index: false, follow: false } };

/** /form/<token>: a company fills in its details for the CRM, without an account. */
export default async function IntakePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!(await openIntakeLink(token))) notFound();
  // Always dark (space needs night): "dark" switches the colour tokens for this page only.
  return (
    <div className="dark relative min-h-[100dvh] bg-[#04040c] text-foreground">
      {/* Fixed behind the page while it scrolls; the gradient shows without WebGL and while three.js loads. */}
      <div aria-hidden className="fixed inset-0 bg-[radial-gradient(ellipse_40%_12%_at_50%_50%,rgba(255,160,80,0.28),transparent),radial-gradient(ellipse_70%_45%_at_50%_50%,rgba(120,40,120,0.18),transparent)]" />
      <BlackHoleBackground className="fixed inset-0" />
      <div aria-hidden className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.65))]" />
      <main className="relative z-10 px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-white/10 bg-black/45 p-5 backdrop-blur-[6px]">
            <h1 className="text-xl font-semibold tracking-tight">Thông tin doanh nghiệp</h1>
            <p className="mt-1 text-sm text-white/70">
              Vui lòng điền thông tin công ty và người liên hệ. Chúng tôi sẽ kiểm tra trước khi cập nhật vào hệ thống. Ô có dấu * là bắt buộc.
            </p>
          </div>
          <IntakeForm token={token} />
        </div>
      </main>
    </div>
  );
}
