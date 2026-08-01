"use client";

import { motion } from "framer-motion";
import {
  Clock,
  FileWarning,
  Users,
  AlertCircle,
  AlertTriangle,
  Minus,
} from "lucide-react";
import { SectionContainer } from "./section-container";

export default function OnboardingCrisis() {
  return (
    <div className="dark:bg-gray-900 flex flex-col w-full border-t border-border">
      <SectionContainer className="bg-white dark:bg-gray-900 !max-w-7xl">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          The Developer Onboarding Crisis
        </h2>
        <p className="text-gray-400 text-center text-base sm:text-lg mb-8 sm:mb-12 md:mb-16 max-w-3xl mx-auto">
          New employees spend months familiarizing themselves with complex
          company codebases before making meaningful contributions
        </p>

        {/* Asymmetric Grid Layout */}
        <div className="space-y-6">
          {/* Large Card - Full Width */}
          <motion.div
            className="border border-border rounded-xl p-8 bg-card transition-colors"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            whileHover={{
              y: -8,
              scale: 1.02,
              borderColor: "hsl(var(--accent) / 0.5)",
            }}
          >
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <div className="flex items-start gap-3 mb-4">
                  <Clock className="w-8 h-8 text-teal-400 mt-1" />
                  <div>
                    <h3 className="text-3xl font-semibold mb-3">3-6 months</h3>
                    <p className="text-muted-foreground text-base">
                      Average time for developers to become productive in a new
                      codebase
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-sm text-muted-foreground">
                    Slow ramp-up time costs companies thousands in lost
                    productivity
                  </span>
                </div>
              </div>

              {/* Visual representation */}
              <div className="flex-1">
                <div className="p-6 bg-muted rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground font-mono">
                      Productivity Timeline
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 bg-background rounded overflow-hidden border border-border">
                      <motion.div
                        className="h-full bg-teal-500/50"
                        initial={{ width: 0 }}
                        whileInView={{ width: "16.666%" }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.5,
                          delay: 0.2,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                    <div className="h-3 bg-background rounded overflow-hidden border border-border">
                      <motion.div
                        className="h-full bg-teal-500/50"
                        initial={{ width: 0 }}
                        whileInView={{ width: "33.333%" }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.5,
                          delay: 0.3,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                    <div className="h-3 bg-background rounded overflow-hidden border border-border">
                      <motion.div
                        className="h-full bg-teal-400/50"
                        initial={{ width: 0 }}
                        whileInView={{ width: "50%" }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.5,
                          delay: 0.4,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                    <div className="h-3 bg-background rounded overflow-hidden border border-border">
                      <motion.div
                        className="h-full bg-teal-300/50"
                        initial={{ width: 0 }}
                        whileInView={{ width: "83.333%" }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.5,
                          delay: 0.5,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between mt-3 text-sm text-muted-foreground">
                    <span>Month 1</span>
                    <span>Month 6</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Two Smaller Cards - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 2 - Outdated Docs */}
            <motion.div
              className="border border-border rounded-xl p-6 bg-card transition-colors"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
              whileHover={{
                y: -8,
                scale: 1.02,
                borderColor: "hsl(var(--accent) / 0.5)",
              }}
            >
              <div className="flex items-start gap-3 mb-4">
                <FileWarning className="w-6 h-6 text-teal-400 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Outdated docs</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Documentation that is incomplete, outdated, or does not
                    exist at all
                  </p>
                </div>
              </div>

              {/* Visual representation */}
              <div className="mt-6 p-4 bg-muted rounded-lg border border-border space-y-2">
                <div className="flex items-center gap-2 opacity-40">
                  <div className="w-3 h-3 rounded bg-muted-foreground/50"></div>
                  <div className="h-2 bg-muted-foreground/30 rounded flex-1"></div>
                  <span className="text-xs text-muted-foreground">2019</span>
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  <div className="w-3 h-3 rounded bg-muted-foreground/50"></div>
                  <div className="h-2 bg-muted-foreground/30 rounded flex-1"></div>
                  <span className="text-xs text-muted-foreground">2021</span>
                </div>
                <div className="flex items-center gap-2 opacity-30">
                  <div className="w-3 h-3 rounded bg-muted-foreground/50"></div>
                  <div className="h-2 bg-muted-foreground/30 rounded flex-1 line-through"></div>
                  <span className="text-xs text-red-500">Missing</span>
                </div>
                <div className="flex items-center gap-2 opacity-60">
                  <div className="w-3 h-3 rounded bg-muted-foreground/50"></div>
                  <div className="h-2 bg-muted-foreground/30 rounded flex-1"></div>
                  <span className="text-xs text-muted-foreground">2020</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-muted-foreground">
                  Knowledge gaps
                </span>
              </div>
            </motion.div>

            {/* Card 3 - Team Bottlenecks */}
            <motion.div
              className="border border-border rounded-xl p-6 bg-card transition-colors"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
              whileHover={{
                y: -8,
                scale: 1.02,
                borderColor: "hsl(var(--accent) / 0.5)",
              }}
            >
              <div className="flex items-start gap-3 mb-4">
                <Users className="w-6 h-6 text-teal-400 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">
                    Team bottlenecks
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Senior developers constantly interrupted to explain code
                    architecture
                  </p>
                </div>
              </div>

              {/* Visual representation */}
              <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center">
                      <span className="text-xs font-mono text-teal-400">
                        Sr
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <AlertCircle
                      key={i}
                      className="w-6 h-6 text-muted-foreground/50"
                    />
                  ))}
                </div>
                <div className="mt-3 text-center text-xs text-muted-foreground">
                  Constant interruptions
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Minus className="w-4 h-4 text-red-400" />
                <span className="text-xs text-muted-foreground">
                  Reduced productivity
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
}
