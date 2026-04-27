interface JobIconProps {
  name: string;
  iconUrl: string | null;
  size?: number;
  className?: string;
}

export function JobIcon({ name, iconUrl, size = 64, className = "" }: JobIconProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (!iconUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-primary/10 text-primary font-bold rounded-2xl ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl}
      alt={name}
      width={size}
      height={size}
      style={{ width: size, height: size, minWidth: size }}
      className={`rounded-2xl object-cover ${className}`}
    />
  );
}
