"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getDocPagesForVersion } from "@/lib/services/repoService";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";
import { FALLBACK, suggestPrompts } from "@/lib/suggestPrompts";

interface ChatEmptyStateProps {
  onSendMessage: (message: string) => void;
}

export default function ChatEmptyState({ onSendMessage }: ChatEmptyStateProps) {
  const time = new Date().getHours();
  const repoId = useChatUIStore((state) => state.repoId);
  const version = useChatUIStore((state) => state.selectedVersion);

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["suggested-prompts", repoId, version],
    queryFn: async () => {
      const result = await getDocPagesForVersion(repoId!, version!);
      return result.success ? suggestPrompts(result.data) : FALLBACK;
    },
    enabled: !!repoId && version !== null,
    staleTime: Infinity,
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 pb-32">
      {/* Greeting */}
      <div className="mb-8 text-center">
        <h1 className="flex items-center justify-center gap-3 text-3xl font-normal dark:text-gray-100 mb-2">
          <Image src="/codecompass.png" alt="" width={36} height={36} />
          {time < 12
            ? "Good Morning"
            : time < 17
              ? "Good Afternoon"
              : "Good Evening"}
        </h1>
        <p className="dark:text-gray-400">
          Ask me anything about this codebase
        </p>
      </div>

      {/* Suggested Prompts */}
      <div className="w-full max-w-2xl min-h-[136px]">
        <p className="text-sm text-gray-400 mb-3">Suggested prompts:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(isLoading ? [] : (suggestions ?? FALLBACK)).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSendMessage(suggestion)}
              className="px-4 py-3 bg-background border border-border rounded-lg
                       text-left text-sm dark:text-gray-200 hover:bg-elevated
                       hover:border-teal-500/50 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
