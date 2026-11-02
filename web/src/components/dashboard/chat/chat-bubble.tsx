"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";

export default function ChatBubble() {
  const [inputValue, setInputValue] = useState("");
  const expand = useChatUIStore((state) => state.expand);
  const isExpanded = useChatUIStore((state) => state.isExpanded);
  const hasDocumentation = useChatUIStore((state) => state.hasDocumentation);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cmd/Ctrl+K focuses the chat input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSend = () => {
    if (inputValue.trim()) {
      // Expand to full chat and pass the message
      expand(inputValue);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  // Hide chat bubble if documentation doesn't exist or chat is expanded
  if (isExpanded || !hasDocumentation) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-[400px] md:w-[500px] lg:w-[600px] xl:w-[700px]">
      <motion.div
        layoutId="chat-container"
        className="w-full mx-auto"
        style={{ borderRadius: 8 }}
      >
        <div className="relative">
          <textarea
            ref={inputRef}
            placeholder={`Ask about this codebase (${/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl+K"})`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full bg-background backdrop-blur-md text-gray-900 dark:text-gray-100 px-4 py-3 pr-12 rounded-lg border border-gray-300 dark:border-border focus:outline-none
                      focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 focus:shadow-[0_0_15px_rgba(20,184,166,0.3)]
                      placeholder-gray-400 dark:placeholder-gray-500 resize-none disabled:cursor-not-allowed
                      transition-shadow duration-200 opacity-90"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="absolute bottom-3 right-3 p-2 text-teal-500 hover:text-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
