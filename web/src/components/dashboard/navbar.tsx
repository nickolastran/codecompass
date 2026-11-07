"use client";

import { Button } from "@/components/ui/button";
import { NavContext } from "./navcontext";
import Image from "next/image";
import { signOut } from "@/app/(auth)/client";
import Link from "next/link";
import { motion } from "framer-motion";

export function DashboardNavbar() {
  return (
    <header className="w-full bg-background border-b border-border">
      <div className="flex h-13 *:items-center justify-between px-5">
        <div className="flex items-center flex-row gap-5">
          {/* Replace this with our logo */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Link href="/dashboard/organizations" aria-label="Organizations">
              <Image
                src="/codecompass.png"
                loading="eager" // header logo is the LCP image
                alt=""
                width={40}
                height={40}
                className="h-10 w-10"
              />
            </Link>
          </motion.div>
          <div className="font-extralight text-lg text-input">/</div>
          <NavContext />
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/profile">Profile</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
