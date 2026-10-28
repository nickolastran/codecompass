import Image from "next/image";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingSection, SectionHeading, landingCard } from "./section-container";

const columns = [
  {
    name: "Traditional documentation",
    good: false,
    items: [
      "Manual updates required",
      "Quickly becomes outdated",
      "Static, non-interactive",
      "No contextual answers",
    ],
  },
  {
    name: "CodeCompass",
    good: true,
    items: [
      "AI-powered exploration",
      "Auto-generated docs",
      "Interactive chat interface",
      "GitHub, GitLab, and local repos",
      "Local & cloud deployment",
      "Open source",
    ],
  },
  {
    name: "Other tools",
    good: false,
    items: [
      "GitHub only",
      "Cloud only, no self-hosting",
      "Proprietary, not open source",
    ],
  },
];

export default function Comparison() {
  return (
    <LandingSection id="comparison">
      <SectionHeading label="Compare" title="How CodeCompass is different.">
        Chat, generated docs, and the option to self-host, in one open source
        tool.
      </SectionHeading>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(({ name, good, items }) => (
          <div
            key={name}
            className={cn(landingCard, good && "border-accent/60 bg-accent/5")}
          >
            <h3 className="flex items-center gap-2 font-medium">
              {good && (
                <Image
                  src="/codecompass.png"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5"
                />
              )}
              {name}
            </h3>
            <ul className="mt-6 space-y-3 text-sm">
              {items.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  {good ? (
                    <Check className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <X className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  )}
                  <span className={good ? "text-foreground" : "text-muted-foreground"}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </LandingSection>
  );
}
