"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "../ui/navigation-menu";

type NavbarProps = {
  isAuthenticated: boolean;
};

export default function Navbar({ isAuthenticated }: NavbarProps) {
  return (
    <div className="sticky top-0 z-50 w-full border-b border-border backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/codecompass.png"
              alt="CodeCompass Logo"
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <span className="text-xl font-bold text-foreground">
              CodeCompass
            </span>
          </Link>
        </div>
        <div className="hidden md:flex gap-8 items-center">
          {/* Navigation Links */}
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <button
                    onClick={() => {
                      document
                        .getElementById("features")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus:text-foreground focus:outline-none"
                  >
                    Features
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <button
                    onClick={() => {
                      document
                        .getElementById("comparison")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus:text-foreground focus:outline-none"
                  >
                    Compare
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Button variant="default" size="sm" asChild>
                <Link href="/dashboard/organizations">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button variant="default" size="sm">
                  <Link href="/login">Start indexing</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
