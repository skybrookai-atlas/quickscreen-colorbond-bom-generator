import { AmazingFencingLogo } from "./AmazingFencingLogo";

interface AnyfenceLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showSubtitle?: boolean;
  variant?: "default" | "white";
}

export function AnyfenceLogo({
  className = "",
}: AnyfenceLogoProps) {
  return (
    <AmazingFencingLogo className={className} />
  );
}
