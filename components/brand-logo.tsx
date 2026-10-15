import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  square = false,
}: {
  className?: string;
  square?: boolean;
}) {
  return (
    <Image
      src={
        square
          ? "/logos/22recordings_logo1_white.png"
          : "/logos/22recordings_logo2_horizontal_white.png"
      }
      alt="22 Recordings"
      width={square ? 437 : 735}
      height={square ? 433 : 159}
      priority
      className={cn(
        "h-auto w-40 object-contain invert dark:invert-0",
        className,
      )}
    />
  );
}
