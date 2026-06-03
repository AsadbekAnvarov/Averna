import Link from "next/link";

/**
 * Averna logo.
 *
 * To use YOUR own logo image, just drop a file named `logo.png` (or
 * `logo.svg`) into the project's `public/` folder and update LOGO_SRC
 * below to "/logo.png". Everything else stays the same.
 */
const LOGO_SRC = "/logo.png";

interface LogoProps {
  /** Pixel size of the square logo mark. */
  size?: number;
  /** Show the "Averna Learning" wordmark next to the mark. */
  showText?: boolean;
  /** Make the whole logo a link to this href. */
  href?: string;
  className?: string;
}

export function Logo({
  size = 40,
  showText = true,
  href,
  className = "",
}: LogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt="Averna logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-lg object-contain drop-shadow-[0_0_12px_rgba(0,229,255,0.55)]"
      />
      {showText && (
        <span className="font-bold leading-tight">
          <span className="neon-text-cyan">Averna</span>{" "}
          <span className="text-white">Learning</span>
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}
