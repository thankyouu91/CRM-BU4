import { Link2Off } from "lucide-react";

export const metadata = { title: "Liên kết không còn hiệu lực", robots: { index: false, follow: false } };

/** Unknown, expired or revoked link: the same page for every reason. */
export default function ShareNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Link2Off className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold">Liên kết không còn hiệu lực</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Liên kết trình chiếu này đã hết hạn, đã bị thu hồi hoặc không đúng. Hãy xin người gửi một liên kết mới.
        </p>
      </div>
    </main>
  );
}
