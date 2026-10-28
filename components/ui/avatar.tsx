import { cn, initials } from "@/lib/utils";

const sizes = { xs: "h-6 w-6 text-[10px]", sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-14 w-14 text-lg" };

export function Avatar({
  name,
  color = "#52525b",
  size = "sm",
  className,
}: {
  name: string;
  color?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-card [text-shadow:0_0_1px_rgb(0_0_0/0.35)]",
        sizes[size],
        className,
      )}
      style={{ background: color }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  users,
  max = 4,
  size = "xs",
}: {
  users: { id: string; name: string; avatarColor: string }[];
  max?: number;
  size?: keyof typeof sizes;
}) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((u) => (
        <Avatar key={u.id} name={u.name} color={u.avatarColor} size={size} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-card",
            sizes[size],
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
