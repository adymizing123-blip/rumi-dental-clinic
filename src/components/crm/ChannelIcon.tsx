import { Facebook, Globe, Instagram, MessageCircle, Music2, Phone, Search } from "lucide-react";
import type { Channel } from "@/types/db";
import { cn } from "@/lib/utils";

const MAP: Record<Channel, { Icon: typeof Phone; className: string }> = {
  whatsapp: { Icon: MessageCircle, className: "bg-[#25D366] text-white" },
  instagram: { Icon: Instagram, className: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white" },
  facebook: { Icon: Facebook, className: "bg-[#1877F2] text-white" },
  tiktok: { Icon: Music2, className: "bg-black text-white" },
  google: { Icon: Search, className: "bg-white text-[#4285F4] ring-1 ring-slate-200" },
  website: { Icon: Globe, className: "bg-brand-600 text-white" },
  phone: { Icon: Phone, className: "bg-indigo-600 text-white" },
};

export function ChannelIcon({ channel, size = "sm" }: { channel: Channel; size?: "sm" | "md" }) {
  const { Icon, className } = MAP[channel];
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full",
        size === "sm" ? "h-4 w-4" : "h-6 w-6",
        className,
      )}
      aria-hidden
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
    </span>
  );
}
