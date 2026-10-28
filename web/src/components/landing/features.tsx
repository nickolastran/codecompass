"use client";

import { useEffect, useState } from "react";
import { Check, FileText, MessageSquare, Network, Server } from "lucide-react";
import {
  SectionContainer,
  SectionHeading,
  landingCard,
  sectionPadding,
} from "./section-container";

const highlights = [
  "Instant answers to codebase questions",
  "Automatic documentation generation",
  "Visual component tree diagrams",
  "Multi-platform repository support",
];

const features = [
  {
    icon: MessageSquare,
    title: "Chat with your code",
    body: "Ask about any part of the codebase and get answers grounded in the actual code.",
  },
  {
    icon: FileText,
    title: "Docs that keep up",
    body: "Documentation is generated from the code. Re-index to bring it up to date.",
  },
  {
    icon: Network,
    title: "Component trees",
    body: "See how modules and components depend on each other in interactive diagrams.",
  },
  {
    icon: Server,
    title: "Run it anywhere",
    body: "Self-host for private code, or use the hosted version to try it quickly.",
  },
];

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
      <SectionContainer className={`bg-background !max-w-7xl ${sectionPadding}`}>
        {/* Video Demo Section */}
        <SectionHeading label="The solution" title="Ask your codebase.">
          CodeCompass indexes your repository, answers questions about it, and
          writes docs that stay current.
        </SectionHeading>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-10 items-center">
          <ul className="space-y-4">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check className="h-4 w-4 text-accent shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-md overflow-hidden border border-border bg-card">
            {loading ? (
              <div className="w-full aspect-video flex items-center justify-center bg-muted">
                <p className="text-sm text-muted-foreground">Loading video...</p>
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
                <p className="text-sm text-muted-foreground">No video available</p>
              </div>
            )}
          </div>
        </div>

        {/* Feature Cards Section */}
        <div
          id="features"
          className="pt-24 sm:pt-32"
          style={{ scrollMarginTop: "100px" }}
        >
          <SectionHeading label="Features" title="Everything a new hire needs.">
            Understand, navigate, and contribute to any codebase from day one.
          </SectionHeading>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className={landingCard}>
                <Icon className="h-5 w-5 text-muted-foreground" />
                <h3 className="mt-6 font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionContainer>
    </div>
  );
}
