import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logos/22recordings_logo2_horizontal_white.png"
      alt="22 Recordings"
      width={735}
      height={159}
      priority
      className={cn(
        "h-auto w-40 object-contain invert dark:invert-0",
        className,
      )}
    />
  );
}
