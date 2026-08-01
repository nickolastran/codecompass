"use client";

import React, { useState, useEffect, useRef } from "react";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";
import MessageList from "./message-list";
import ChatInput from "./chat-input";
import AnswerPanel from "./answer-panel";
import ChatEmptyState from "./chat-empty-state";
import ModelSelector, { AVAILABLE_MODELS } from "./model-selector";
import VersionSelector from "./version-selector";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConversationMessages,
  createConversation,
  createMessage,
  getCodeSnippetsForConversation,
  saveCodeSnippets,
} from "@/lib/services/repoService";
import { CodeSnippet as DBCodeSnippet } from "@/app/types/supabase";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: string;
}

interface CodeSnippet {
  file: string;
  code: string;
}

interface ConversationTurn {
  id: number;
  userQuestion: string;
  timestamp: string;
  codeSnippets: CodeSnippet[];
  loading: boolean;
}

function MessageListSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
      {/* User message skeleton */}
      <div className="mb-8 flex flex-row gap-6 px-5">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>

      {/* Assistant message skeleton */}
      <div className="mb-8">
        <div className="mt-6">
          <div className="bg-elevated rounded-lg border border-gray-800 p-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-800">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* User message skeleton */}
      <div className="mb-8 flex flex-row gap-6 px-5">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-2/3" />
        </div>
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>
    </div>
  );
}

export default function ChatInterface() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationTurns, setConversationTurns] = useState<
    ConversationTurn[]
  >([]);
  const [responseLoading, setResponseLoading] = useState<boolean>(false);
  const [chatInputDisabled, setChatInputDisabled] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState("");
  const initialMessage = useChatUIStore((state) => state.initialMessage);
  const selectedModel = useChatUIStore((state) => state.selectedModel);
  const setSelectedModel = useChatUIStore((state) => state.setSelectedModel);
  const conversation = useChatUIStore((state) => state.conversation);
  const setConversation = useChatUIStore((state) => state.setConversation);
  const repoId = useChatUIStore((state) => state.repoId);
  const selectedVersion = useChatUIStore((state) => state.selectedVersion);
  const hasSentInitialMessage = useRef(false);

  // Fetch messages for selected conversation
  const { data: conversationMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return [];
      const result = await getConversationMessages(conversation.id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!conversation?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Fetch code snippets for selected conversation
  const { data: conversationCodeSnippets, isLoading: snippetsLoading } =
    useQuery({
      queryKey: ["codeSnippets", conversation?.id],
      queryFn: async () => {
        if (!conversation?.id) return [];
        const result = await getCodeSnippetsForConversation(conversation.id);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
      enabled: !!conversation?.id,
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

  const sendMessage = async (text: string) => {
    if (chatInputDisabled || !text.trim()) return;

    setChatInputDisabled(true);
    setResponseLoading(true);
    const userQuestion = text;
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // If no conversation exists, create one
    let currentConversation = conversation;
    if (!currentConversation && repoId) {
      const result = await createConversation(
        repoId,
        userQuestion,
        selectedVersion,
      );
      if (result.success) {
        currentConversation = result.data;
        setConversation(currentConversation);

        // Invalidate conversations query to refresh the list
        queryClient.invalidateQueries({
          queryKey: ["conversations", repoId, selectedVersion],
        });
      } else {
        console.error("Failed to create conversation:", result.error);
        setChatInputDisabled(false);
        setResponseLoading(false);
        return;
      }
    }

    // Save user message to database
    if (currentConversation) {
      const messageResult = await createMessage(
        currentConversation.id,
        "user",
        userQuestion,
      );
      if (!messageResult.success) {
        console.error("Failed to save user message:", messageResult.error);
      }
    }

    // Add user message to chat
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: `temp-${Date.now()}`,
        text: userQuestion,
        sender: "user",
        timestamp,
      },
    ]);

    // Create a new conversation turn with loading state
    const turnId = Date.now();
    setConversationTurns((prevTurns) => [
      ...prevTurns,
      {
        id: turnId,
        userQuestion,
        timestamp,
        codeSnippets: [],
        loading: true,
      },
    ]);

    setInputValue("");

    try {
      // Call the streaming API endpoint

      const new_conversation: Message[] = [];
      //start a new conversation
      if (!conversationMessages) {
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userQuestion,
          model: selectedModel.name,
          conversation: conversationMessages
            ? conversationMessages
            : new_conversation,
          repoId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Handle the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let buffer = ""; // Buffer for incomplete SSE messages
      const assistantMessageId = `temp-assistant-${Date.now()}`;
      let firstContentReceived = false;
      const codeSnippets: CodeSnippet[] = []; // Accumulate snippets from stream

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("Stream done. Final accumulated text:", accumulatedText);
          break;
        }

        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete SSE messages (ending with \n\n)
        const messages = buffer.split("\n\n");

        // Keep the last incomplete message in the buffer
        buffer = messages.pop() || "";

        for (const message of messages) {
          if (!message.trim()) continue;

          // Parse SSE format: "data: {...}"
          if (message.startsWith("data: ")) {
            const dataStr = message.slice(6).trim();

            // Check for stream end
            if (dataStr === "[DONE]") {
              console.log("Received [DONE] signal");
              continue;
            }

            try {
              const dataObj = JSON.parse(dataStr);

              // Handle content events: {"type": "content", "content": "..."}
              if (dataObj.type === "content" && dataObj.content) {
                accumulatedText += dataObj.content;

                // On first content, hide loading and create assistant message
                if (!firstContentReceived) {
                  firstContentReceived = true;
                  setResponseLoading(false);

                  setConversationTurns((prevTurns) =>
                    prevTurns.map((turn) =>
                      turn.id === turnId
                        ? {
                            ...turn,
                            loading: false,
                          }
                        : turn,
                    ),
                  );

                  setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                      id: assistantMessageId,
                      text: accumulatedText,
                      sender: "assistant",
                      timestamp: new Date().toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    },
                  ]);
                } else {
                  // Update the assistant message with accumulated text
                  setMessages((prevMessages) =>
                    prevMessages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, text: accumulatedText }
                        : msg,
                    ),
                  );
                }
              }
              // Handle snippet events: {"type": "snippet", "file": "...", "code": "..."}
              else if (
                dataObj.type === "snippet" &&
                dataObj.file &&
                dataObj.code
              ) {
                const newSnippet: CodeSnippet = {
                  file: dataObj.file,
                  code: dataObj.code,
                };
                codeSnippets.push(newSnippet);

                // Update conversation turn with new snippet in real-time
                setConversationTurns((prevTurns) =>
                  prevTurns.map((turn) =>
                    turn.id === turnId
                      ? {
                          ...turn,
                          codeSnippets: [...codeSnippets],
                        }
                      : turn,
                  ),
                );
              }
              // Fallback: Handle legacy format {"content": "..."} (no type field)
              else if (
                dataObj.content &&
                typeof dataObj.content === "string" &&
                !dataObj.type
              ) {
                accumulatedText += dataObj.content;

                // On first content, hide loading and create assistant message
                if (!firstContentReceived) {
                  firstContentReceived = true;
                  setResponseLoading(false);

                  setConversationTurns((prevTurns) =>
                    prevTurns.map((turn) =>
                      turn.id === turnId
                        ? {
                            ...turn,
                            loading: false,
                          }
                        : turn,
                    ),
                  );

                  setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                      id: assistantMessageId,
                      text: accumulatedText,
                      sender: "assistant",
                      timestamp: new Date().toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    },
                  ]);
                } else {
                  // Update the assistant message with accumulated text
                  setMessages((prevMessages) =>
                    prevMessages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, text: accumulatedText }
                        : msg,
                    ),
                  );
                }
              }
            } catch (e) {
              console.warn("Failed to parse SSE data:", dataStr, e);
            }
          }
        }
      }

      // Save assistant message to database first to get the real message ID
      let realMessageId = assistantMessageId;
      if (currentConversation && accumulatedText) {
        const assistantMessageResult = await createMessage(
          currentConversation.id,
          "assistant",
          accumulatedText,
        );
        if (assistantMessageResult.success) {
          realMessageId = assistantMessageResult.data.id;
        } else {
          console.error(
            "Failed to save assistant message:",
            assistantMessageResult.error,
          );
        }
      }

      // Save code snippets to database with the real message ID
      if (currentConversation && codeSnippets.length > 0) {
        const saveResult = await saveCodeSnippets(
          currentConversation.id,
          realMessageId,
          codeSnippets,
        );

        if (saveResult.success) {
          queryClient.invalidateQueries({
            queryKey: ["codeSnippets", currentConversation.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["messages", currentConversation.id],
          });
        } else {
          console.error("Failed to save code snippets:", saveResult.error);
        }
      }

      // Ensure final state is updated (in case no snippets were received)
      setConversationTurns((prevTurns) =>
        prevTurns.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                loading: false,
                codeSnippets: codeSnippets,
              }
            : turn,
        ),
      );
    } catch (error) {
      console.error("Error sending message:", error);

      // Add error message
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: `temp-error-${Date.now()}`,
          text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
          sender: "assistant",
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      // Update conversation turn to show error
      setConversationTurns((prevTurns) =>
        prevTurns.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                loading: false,
                codeSnippets: [],
              }
            : turn,
        ),
      );
    } finally {
      setResponseLoading(false);
      setChatInputDisabled(false);
    }
  };

  const handleSend = () => {
    sendMessage(inputValue);
  };

  // Clear messages when conversation changes (including when set to null)
  useEffect(() => {
    setMessages([]);
    setConversationTurns([]);
  }, [conversation?.id]);

  // Load conversation messages and code snippets when they're fetched
  useEffect(() => {
    // Wait for both queries to finish loading before building turns
    if (messagesLoading || snippetsLoading) {
      return;
    }

    if (conversationMessages && conversationMessages.length > 0) {
      const loadedMessages: Message[] = conversationMessages.map((msg) => ({
        id: msg.id,
        text: msg.content,
        sender: msg.role,
        timestamp: new Date(msg.created_at).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
      setMessages(loadedMessages);

      // Build conversation turns from loaded messages and snippets
      const turns: ConversationTurn[] = [];

      for (let i = 0; i < loadedMessages.length; i += 2) {
        const userMsg = loadedMessages[i];
        const assistantMsg = loadedMessages[i + 1];

        if (userMsg && assistantMsg) {
          // Find snippets for this assistant message
          const snippetsForMsg = (conversationCodeSnippets || [])
            .filter((snippet) => snippet.message_id === assistantMsg.id)
            .map((snippet) => ({
              file: snippet.file_path,
              code: snippet.code_content,
            }));

          turns.push({
            id: i / 2,
            userQuestion: userMsg.text,
            timestamp: userMsg.timestamp,
            codeSnippets: snippetsForMsg,
            loading: false,
          });
        }
      }

      setConversationTurns(turns);
    }
  }, [
    conversationMessages,
    conversationCodeSnippets,
    messagesLoading,
    snippetsLoading,
  ]);

  // Auto-send initial message when component mounts
  useEffect(() => {
    if (initialMessage && !hasSentInitialMessage.current) {
      hasSentInitialMessage.current = true;
      // Clear any existing conversation to start fresh
      setConversation(null);
      // Send the initial message
      sendMessage(initialMessage);
    }
  }, [initialMessage, setConversation]);

  // Show empty state when there are no messages and no initial message
  const showEmptyState =
    messages.length === 0 && !initialMessage && !conversation;

  // Show loading state when fetching messages for a selected conversation
  const showMessagesLoading = messagesLoading && !!conversation;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-white dark:bg-background text-gray-900 dark:text-gray-300">
      {/* Chat Column */}
      <div className="flex flex-col w-1/2 border-r border-gray-200 dark:border-gray-800">
        {/* Header with Model and Version Selectors */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <ModelSelector
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
            />
            <VersionSelector />
          </div>
        </div>

        {showEmptyState ? (
          <ChatEmptyState onSendMessage={sendMessage} />
        ) : showMessagesLoading ? (
          <MessageListSkeleton />
        ) : (
          <MessageList messages={messages} loading={responseLoading} />
        )}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          disabled={chatInputDisabled}
        />
      </div>

      {/* Answers Column */}
      <AnswerPanel conversationTurns={conversationTurns} />
    </div>
  );
}
