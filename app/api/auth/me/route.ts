import { auth, ok, unauthorized } from "@/lib/api";

export async function GET() {
  const user = await auth();
  if (!user) return unauthorized();
  return ok({ user });
}
