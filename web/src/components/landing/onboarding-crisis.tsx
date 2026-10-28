import { Clock, FileWarning, Users } from "lucide-react";
import {
  SectionContainer,
  SectionHeading,
  landingCard,
  sectionPadding,
} from "./section-container";

const staleDocs = [
  { file: "auth.md", updated: "2019" },
  { file: "api.md", updated: "2021" },
  { file: "deploy.md", updated: null },
  { file: "setup.md", updated: "2020" },
];

const interruptions = [
  { week: "Week 1", pct: 85 },
  { week: "Week 2", pct: 65 },
  { week: "Week 3", pct: 50 },
  { week: "Week 4", pct: 40 },
];

export default function OnboardingCrisis() {
  return (
    <div className="bg-background flex flex-col w-full border-t border-border">
      <SectionContainer className={`!max-w-7xl ${sectionPadding}`}>
        <SectionHeading label="The problem" title="Onboarding is broken.">
          New hires spend months learning a codebase before they ship anything
          meaningful.
        </SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={landingCard}>
            <h3 className="flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Slow ramp-up
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Average time for a developer to become productive in a new
              codebase.
            </p>
            <p className="mt-auto pt-10 text-5xl font-normal tracking-tight">
              3–6
              <span className="ml-2 text-base tracking-normal text-muted-foreground">
                months
              </span>
            </p>
          </div>

          <div className={landingCard}>
            <h3 className="flex items-center gap-2 font-medium">
              <FileWarning className="h-4 w-4 text-muted-foreground" />
              Outdated docs
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Documentation that&apos;s incomplete, stale, or doesn&apos;t
              exist at all.
            </p>
            <ul className="mt-auto pt-10 space-y-2 font-mono text-xs">
              {staleDocs.map(({ file, updated }) => (
                <li key={file} className="flex justify-between">
                  <span className="text-muted-foreground">{file}</span>
                  <span
                    className={updated ? "text-muted-foreground/60" : "text-red-400"}
                  >
                    {updated ? `last edited ${updated}` : "missing"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={landingCard}>
            <h3 className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              Team bottlenecks
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Senior developers keep getting pulled away to explain the
              architecture.
            </p>
            <div className="mt-auto pt-10 space-y-2">
              {interruptions.map(({ week, pct }) => (
                <div key={week} className="flex items-center gap-3 text-xs">
                  <span className="w-12 text-muted-foreground">{week}</span>
                  <div className="h-1.5 flex-1 bg-muted">
                    <div
                      className="h-full bg-accent/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                Time seniors spend answering questions
              </p>
            </div>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
}
