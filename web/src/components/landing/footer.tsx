import Link from "next/link";
import Image from "next/image";
import { Github } from "lucide-react";
import { SectionContainer } from "./section-container";

const REPO_URL = "https://github.com/nickolastran/codecompass";

export default function Footer() {
  return (
    <footer className="flex flex-col w-full border-t border-border">
      <SectionContainer className="!max-w-7xl !py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/codecompass.png"
              alt="CodeCompass Logo"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span className="font-semibold text-foreground">CodeCompass</span>
          </Link>

          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <a
              href={`${REPO_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Issues
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </nav>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CodeCompass
          </p>
        </div>
      </SectionContainer>
    </footer>
  );
}
