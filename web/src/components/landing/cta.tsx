"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { GridPattern } from "../ui/shadcn-io/grid-pattern";
import { cn } from "@/lib/utils";
import { SectionContainer } from "./section-container";

type CTAProps = {
  isAuthenticated: boolean;
};

export default function CTA({ isAuthenticated }: CTAProps) {
  return (
    <div className="flex flex-col w-full border-t border-border">
      <SectionContainer className="relative !max-w-7xl !py-12 sm:!py-16 md:!py-24">
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
        <motion.div
          className="relative overflow-hidden border border-border rounded-2xl bg-gradient-to-br from-accent/10 via-card to-card p-8 sm:p-12 md:p-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Animated background gradient */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-accent/5"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center text-center gap-4 sm:gap-6">
            <motion.h2
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            >
              Ready to transform your{" "}
              <span className="text-accent">codebase navigation?</span>
            </motion.h2>

            <motion.p
              className="text-base sm:text-lg text-muted-foreground max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            >
              Join developers who are already cutting onboarding time from
              months to minutes with AI-powered code documentation.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 mt-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button size="lg" className="group" asChild>
                  <Link
                    href={
                      isAuthenticated ? "/dashboard/organizations" : "/login"
                    }
                  >
                    {isAuthenticated ? "Go to Dashboard" : "Get started"}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button size="lg" variant="outline" className="group" asChild>
                  <Link href="/docs/self-hosting">
                    <BookOpen className="mr-2 h-4 w-4" />
                    View self-hosting docs
                  </Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Optional: Add some decorative elements */}
            <motion.div
              className="mt-8 flex items-center gap-8 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-teal-400" />
                <span>Open source</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-teal-400" />
                <span>Self-hosted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-teal-400" />
                <span>Free forever</span>
              </div>
            </motion.div>
          </div>

          {/* Decorative circles */}
          <motion.div
            className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-accent/10 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-accent/10 blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.5, 0.3, 0.5],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      </SectionContainer>
    </div>
  );
}
