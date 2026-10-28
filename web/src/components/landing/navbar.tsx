import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

type NavbarProps = {
  isAuthenticated: boolean;
};

// Section ids live on the LandingSection wrappers
const links = [
  { href: "#demo", label: "Demo" },
  { href: "#features", label: "Features" },
  { href: "#comparison", label: "Compare" },
];

export default function Navbar({ isAuthenticated }: NavbarProps) {
  return (
    <div className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      {/* Same width and padding as the sections, so the logo lines up with their content */}
      <div className="mx-auto flex h-14 w-full max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-4rem)] lg:max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/codecompass.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
          />
          <span className="font-semibold text-foreground">CodeCompass</span>
        </Link>

        <nav className="ml-auto hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Button size="sm" asChild>
              <Link href="/dashboard/organizations">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/login">Start indexing</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
