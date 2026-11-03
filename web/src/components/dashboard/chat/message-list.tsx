import AnimatedSkeleton from "./animated-skeleton";
import CodeSnippet from "./code-snippet";
import MessageBubble from "./message-bubble";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: string;
}

interface ConversationTurn {
  id: number;
  codeSnippets: { file: string; code: string }[];
  loading: boolean;
}

interface MessageListProps {
  messages: Message[];
  turns: ConversationTurn[];
  loading: boolean;
}

// One row per question: question + answer on the left, its snippets on the right.
// Turns are appended in the same order as user messages, so row i ↔ turns[i].
export default function MessageList({ messages, turns, loading }: MessageListProps) {
  const rows = messages.flatMap((m, i) =>
    m.sender === "user"
      ? [{ question: m, answer: messages[i + 1]?.sender === "assistant" ? messages[i + 1] : undefined }]
      : [],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6">
        {rows.map(({ question, answer }, i) => {
          const turn = turns[i];
          return (
            <section
              key={question.id}
              className="grid gap-6 py-8 border-b border-border last:border-b-0 lg:grid-cols-2 lg:min-h-[640px]"
            >
              <div className="min-w-0">
                <h2 className="text-2xl leading-snug text-gray-800 dark:text-gray-200">
                  {question.text}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {question.timestamp}
                </p>
                {answer ? (
                  <MessageBubble text={answer.text} />
                ) : (
                  loading && i === rows.length - 1 && <AnimatedSkeleton />
                )}
              </div>

              {/* Snippets scroll inside the row, which takes the answer's height */}
              <div className="relative min-w-0">
                <div className="space-y-4 lg:absolute lg:inset-0 lg:overflow-y-auto lg:pr-2">
                  {turn?.loading ? (
                    <AnimatedSkeleton />
                  ) : turn?.codeSnippets.length ? (
                    turn.codeSnippets.map((snippet, j) => (
                      <CodeSnippet key={j} file={snippet.file} code={snippet.code} />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No code snippets for this question
                    </p>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
