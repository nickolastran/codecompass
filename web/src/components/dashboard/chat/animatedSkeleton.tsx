"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

const skeletonLines = [
  "100%",
  "90%",
  "95%",
  "70%",
  "80%",
  "92%",
  "100%",
  "90%",
  "95%",
  "70%",
  "80%",
  "92%",
];

export default function AnimatedSkeleton() {
  const skeletonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skeletonRef.current) {
      skeletonRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, []);

  return (
    <motion.div
      ref={skeletonRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mt-5 bg-elevated rounded-sm"
    >
      <div className="space-y-3 p-4">
        {skeletonLines.map((width, index) => (
          <motion.div
            key={index}
            initial={{ width: 0 }}
            animate={{ width }}
            transition={{
              duration: 0.6,
              ease: "easeOut",
              delay: index * 0.05,
            }}
          >
            <Skeleton className={`h-4 w-[${width}] dark:bg-accent `} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
