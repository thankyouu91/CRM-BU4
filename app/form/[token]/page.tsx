import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { openIntakeLink } from "@/lib/customer-intake-queries";
import { IntakeForm } from "./intake-form";

// Never cached or indexed (middleware.ts): the link is checked each time it is opened.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thông tin doanh nghiệp", robots: { index: false, follow: false } };

/** /form/<token>: a company fills in its details for the CRM, without an account. */
export default async function IntakePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!(await openIntakeLink(token))) notFound();
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight">Thông tin doanh nghiệp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vui lòng điền thông tin công ty và người liên hệ. Chúng tôi sẽ kiểm tra trước khi cập nhật vào hệ thống. Ô có dấu * là bắt buộc.
        </p>
        <IntakeForm token={token} />
      </div>
    </main>
  );
}
