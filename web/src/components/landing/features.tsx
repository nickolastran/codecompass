"use client";

import { useEffect, useState } from "react";
import { Check, FileText, MessageSquare, Network, Server } from "lucide-react";
import { LandingSection, SectionHeading, landingCard } from "./section-container";
import Demo from "./demo";

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
      }
    }

    fetchVideo();
  }, []);

  return (
    <>
      <LandingSection>
        <SectionHeading label="The solution" title="Ask your codebase.">
          CodeCompass indexes your repository, answers questions about it, and
          writes docs that stay current.
        </SectionHeading>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
          {highlights.map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-accent shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* Only takes up space once there's a video to show */}
        {videoUrl && (
          <div className="mt-10 rounded-md overflow-hidden border border-border bg-card">
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
          </div>
        )}
      </LandingSection>

      <LandingSection id="demo">
        <SectionHeading label="Try it" title="Ask a question, see the code.">
          Every answer comes with the lines it&apos;s talking about. Pick a
          question below.
        </SectionHeading>
        <Demo />
      </LandingSection>

      <LandingSection id="features">
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
      </LandingSection>
    </>
  );
}
