"use client";
import { ArrowRight, Send } from "lucide-react";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
}: ChatInputProps) {
  const { initialMessage } = useChatUIStore();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !disabled) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-border bg-background">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              initialMessage ? "Ask a follow-up question" : "Ask CodeCompass"
            }
            rows={1}
            disabled={disabled}
            className="w-full bg-background text-foreground px-4 py-6 pr-14 leading-6 rounded-lg border border-border focus:outline-none
                    focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 focus:shadow-[0_0_15px_rgba(20,184,166,0.3)]
                    placeholder:text-muted-foreground resize-none disabled:opacity-50 disabled:cursor-not-allowed
                    transition-shadow duration-200"
          />
          <div className="group absolute top-1/2 right-3 -translate-y-1/2">
            <button
              onClick={onSend}
              disabled={!value.trim() || disabled}
              aria-label="Send message"
              className="flex size-8 items-center justify-center rounded-full transition-colors text-teal-500 hover:text-teal-400 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
            >
              {value.trim() && !disabled ? (
                <Send size={20} strokeWidth={2.5} />
              ) : (
                <ArrowRight size={16} />
              )}
            </button>
            <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-md bg-popover px-2.5 py-1 text-xs text-popover-foreground border shadow-md opacity-0 transition-opacity group-hover:opacity-100">
              Enter to send, Shift+Enter for new line
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
