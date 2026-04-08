interface PlayerAvatarProps {
  name: string;
  color: string;
  avatarUrl?: string | null;
  size?: string;
  fontSize?: string;
}

export default function PlayerAvatar({
  name,
  color,
  avatarUrl,
  size = "w-9 h-9",
  fontSize = "text-sm font-bold",
}: PlayerAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${size} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center font-bold text-white ${fontSize} flex-shrink-0`}
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
