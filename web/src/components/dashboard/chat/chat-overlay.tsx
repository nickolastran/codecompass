"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";
import ChatInterface from "./chat-interface";

export default function ChatOverlay() {
  const { isExpanded } = useChatUIStore();

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* Morphing chat container */}
          <motion.div
            layoutId="chat-container"
            transition={{ duration: 0.3 }}
            style={{
              borderRadius: 12,
            }}
            layout
            className="relative flex h-full w-full overflow-y-auto transform-gpu will-change-transform bg-white dark:bg-background border border-border shadow-2xl"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.15, duration: 0.1 }}
              className="relative z-20 w-full flex flex-col h-full"
            >
              {/* Chat interface */}
              <div className="flex-1 overflow-hidden px-2">
                <ChatInterface />
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
