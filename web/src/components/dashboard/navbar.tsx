"use client";

import { Button } from "@/components/ui/button";
import { NavContext } from "./navcontext";
import Image from "next/image";
import { signOut } from "@/app/(auth)/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export function DashboardNavbar() {
  const router = useRouter();
  return (
    <header className="w-full bg-background border-b border-border">
      <div className="flex h-13 *:items-center justify-between px-5">
        <div className="flex items-center flex-row gap-5 hover:cursor-pointer">
          {/*Replace this with our logo */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Image
              src="/codecompass.png"
              alt="Logo"
              width={40}
              height={40}
              className="h-10 w-10"
              onClick={() => {
                router.push("/dashboard/organizations");
              }}
            />
          </motion.div>
          <div className="font-extralight text-lg text-input">/</div>
          <NavContext />
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign Out
          </Button>
          <Button variant="default" size="sm">
            Profile
          </Button>
        </div>
      </div>
    </header>
  );
}
