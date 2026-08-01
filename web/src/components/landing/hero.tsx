"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { GridPattern } from "@/components/ui/shadcn-io/grid-pattern";
import { cn } from "@/lib/utils";
import { SectionContainer } from "./section-container";

type HeroProps = {
  isAuthenticated: boolean;
};

export default function Hero({ isAuthenticated }: HeroProps) {
  return (
    <div className="dark:bg-gray-900 flex flex-col w-full items-center justify-center">
      <SectionContainer noPadding className="!max-w-7xl">
        {/* Hero Section - Full Screen */}
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center gap-4 px-4 sm:px-6">
          <GridPattern
            width={20}
            height={20}
            x={-1}
            y={-1}
            className={cn(
              "dark:fill-elevated/10 dark:stroke-elevated/40 fill-accent/10 stroke-accent/20",
              "[mask-image:linear-gradient(to_top,white,rgba(255,255,255,0.5),transparent)]",
            )}
          />
          <motion.h1
            className={cn(
              "relative z-10 flex flex-col text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-medium items-center justify-center",
            )}
            style={{ lineHeight: "1.2" }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <motion.span
              className="block text-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            >
              Navigate any codebase
            </motion.span>
            <motion.span
              className="text-accent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            >
              in minutes, not months
            </motion.span>
          </motion.h1>
          <motion.p
            className="relative z-10 pt-2 text-foreground my-3 text-sm sm:mt-5 lg:mb-0 sm:text-base lg:text-lg text-center max-w-4xl px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
          >
            CodeCompass is <span className="font-semibold italic">the</span>{" "}
            <span className="text-accent font-semibold italic">
              open-source
            </span>{" "}
            AI-powered code navigation tool.
            <br className="hidden sm:block" />
            <span className="block sm:inline mt-2 sm:mt-0">
              Index your project • Generate documentation • Onboard your team
              faster
            </span>
          </motion.p>
          <motion.div
            className="relative z-10 flex flex-row gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
          >
            {isAuthenticated ? (
              <Button asChild>
                <Link href="/dashboard/organizations">Go to Dashboard</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/login">Get started</Link>
              </Button>
            )}
            <Button variant="outline">Our Features</Button>
          </motion.div>
        </div>
      </SectionContainer>
    </div>
  );
}
