"use client";

import { useRouter } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";

export function ForcedChangePassword() {
  const router = useRouter();
  return (
    <ChangePasswordForm
      onDone={() => {
        router.replace("/dashboard");
        router.refresh();
      }}
    />
  );
}
