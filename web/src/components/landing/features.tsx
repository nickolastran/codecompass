"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SectionContainer } from "./section-container";

export default function Features() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVideo() {
      try {
        const response = await fetch("/api/videos");
        const data = await response.json();

        if (data.videos && data.videos.length > 0) {
          // Use the first video from the list
          setVideoUrl(data.videos[0].url);
        }
      } catch (error) {
        console.error("Error fetching video:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchVideo();
  }, []);

  return (
    <div className="flex flex-col w-full border-t border-border">
      <SectionContainer className="bg-white dark:bg-gray-900 !max-w-7xl">
        {/* Video Demo Section */}
        <div className="mb-12 sm:mb-16 md:mb-24 mx-auto">
          <motion.div
            className="flex items-center gap-2 mb-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <span className="text-teal-400 font-semibold text-sm sm:text-base">
              AI-Powered Solution
            </span>
          </motion.div>
          <motion.h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            CodeCompass will include an AI guide to any codebase
          </motion.h2>
          <motion.p
            className="text-gray-400 text-base sm:text-lg mb-8 sm:mb-12 md:mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            CodeCompass aims to transforms how developers explore and understand
            code. The RAG-powered chatbot will provide instant answers, while
            automatic documentation generation will keep everything up-to-date.
          </motion.p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left side - Features list */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            >
              <div className="flex items-start gap-3">
                <span className="text-teal-500 mt-1">✓</span>
                <span className="text-foreground">
                  Instant answers to codebase questions
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-teal-500 mt-1">✓</span>
                <span className="text-foreground">
                  Automatic documentation generation
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-teal-500 mt-1">✓</span>
                <span className="text-foreground">
                  Visual component tree diagrams
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-teal-500 mt-1">✓</span>
                <span className="text-foreground">
                  Multi-platform repository support
                </span>
              </div>
            </motion.div>

            {/* Right side - Video demo */}
            <motion.div
              className="relative rounded-lg overflow-hidden border border-border bg-card shadow-lg"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
            >
              {loading ? (
                <div className="w-full aspect-video flex items-center justify-center bg-muted">
                  <p className="text-muted-foreground">Loading video...</p>
                </div>
              ) : videoUrl ? (
                <video
                  className="w-full h-auto"
                  autoPlay
                  muted
                  playsInline
                  preload="metadata"
                  loop
                  src={videoUrl}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-muted">
                  <p className="text-muted-foreground">No video available</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Feature Cards Section */}
        <div
          id="features"
          className="max-w-5xl mx-auto"
          style={{ scrollMarginTop: "100px" }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4">
            Main Features of CodeCompass
          </h2>
          <p className="text-gray-400 text-center text-base sm:text-lg mb-8 sm:mb-12 md:mb-16 max-w-3xl mx-auto">
            Everything you need to understand, navigate, and contribute to any
            codebase from day one.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* RAG-Powered Chat */}
            <motion.div
              className="border border-gray-800 rounded-xl p-6 sm:p-8 bg-background transition-colors"
              initial={{ opacity: 0, y: 30, rotate: -5 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              whileHover={{
                y: -8,
                scale: 1.02,
                borderColor: "hsl(var(--accent) / 0.5)",
              }}
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  className="w-16 h-16 mb-6 flex items-center justify-center"
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.4,
                    delay: 0.2,
                    type: "spring",
                    bounce: 0.5,
                  }}
                  whileHover={{ rotate: 360, scale: 1.1 }}
                >
                  <svg
                    className="w-16 h-16 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-4">
                  RAG-Powered Chat
                </h3>
                <p className="text-sm sm:text-base text-gray-400">
                  Ask questions about any part of your codebase and get instant,
                  contextual answers.
                </p>
              </div>
            </motion.div>

            {/* Auto Documentation */}
            <motion.div
              className="border border-gray-800 rounded-xl p-6 sm:p-8 bg-background transition-colors"
              initial={{ opacity: 0, y: 30, rotate: -5 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              whileHover={{
                y: -8,
                scale: 1.02,
                borderColor: "hsl(var(--accent) / 0.5)",
              }}
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  className="w-16 h-16 mb-6 flex items-center justify-center"
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.4,
                    delay: 0.2,
                    type: "spring",
                    bounce: 0.5,
                  }}
                  whileHover={{ rotate: 360, scale: 1.1 }}
                >
                  <svg
                    className="w-16 h-16 text-teal-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-4">
                  Auto Documentation
                </h3>
                <p className="text-sm sm:text-base text-gray-400">
                  Generate comprehensive documentation that stays in sync with
                  your code changes.
                </p>
              </div>
            </motion.div>

            {/* Component Trees */}
            <motion.div
              className="border border-gray-800 rounded-xl p-6 sm:p-8 bg-background transition-colors"
              initial={{ opacity: 0, y: 30, rotate: -5 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              whileHover={{
                y: -8,
                scale: 1.02,
                borderColor: "hsl(var(--accent) / 0.5)",
              }}
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  className="w-16 h-16 mb-6 flex items-center justify-center"
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.4,
                    delay: 0.4,
                    type: "spring",
                    bounce: 0.5,
                  }}
                  whileHover={{ rotate: 360, scale: 1.1 }}
                >
                  <svg
                    className="w-16 h-16 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-4">
                  Component Trees
                </h3>
                <p className="text-sm sm:text-base text-gray-400">
                  Visualize code architecture with interactive component and
                  dependency diagrams.
                </p>
              </div>
            </motion.div>

            {/* Enterprise Ready */}
            <motion.div
              className="border border-gray-800 rounded-xl p-6 sm:p-8 bg-background transition-colors"
              initial={{ opacity: 0, y: 30, rotate: -5 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              whileHover={{
                y: -8,
                scale: 1.02,
                borderColor: "hsl(var(--accent) / 0.5)",
              }}
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  className="w-16 h-16 mb-6 flex items-center justify-center"
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.4,
                    delay: 0.4,
                    type: "spring",
                    bounce: 0.5,
                  }}
                  whileHover={{ rotate: 360, scale: 1.1 }}
                >
                  <svg
                    className="w-16 h-16 text-teal-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-4">
                  Enterprise Ready
                </h3>
                <p className="text-sm sm:text-base text-gray-400">
                  Deploy locally for security or use our hosted solution for
                  quick testing.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
}
