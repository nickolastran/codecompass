"use client";
import dynamic from "next/dynamic";
import Hero from "./hero";
import CTA from "./cta";
import OnboardingCrisis from "./onboarding-crisis";
const Features = dynamic(() => import("./features").then((mod) => mod.default));
const Comparison = dynamic(() =>
  import("./comparison").then((mod) => mod.default),
);

type LandingPageProps = {
  isAuthenticated: boolean;
};

export default function LandingPage({ isAuthenticated }: LandingPageProps) {
  return (
    <div className="dark:bg-gray-900 flex flex-col items-center justify-center">
      <Hero isAuthenticated={isAuthenticated} />
      <OnboardingCrisis />
      <Features />
      <Comparison />
      <CTA isAuthenticated={isAuthenticated} />
    </div>
  );
}
