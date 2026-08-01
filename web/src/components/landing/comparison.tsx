import { SectionContainer } from "./section-container";

export default function Comparison() {
  return (
    <div className="flex flex-col w-full border-t border-border">
      <SectionContainer className="bg-white dark:bg-gray-900 !max-w-7xl">
        <div
          id="comparison"
          className="mx-auto"
          style={{ scrollMarginTop: "100px" }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4">
            How CodeCompass will stand apart
          </h2>
          <p className="text-gray-400 text-center text-base sm:text-lg mb-8 sm:mb-12 md:mb-16 max-w-3xl mx-auto">
            Unlike other solutions, CodeCompass combines AI-powered exploration
            with automatic documentation and enterprise-grade deployment
            options.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Traditional Documentation */}
            <div className="border border-gray-800 rounded-xl p-4 sm:p-6 bg-background">
              <h3 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">
                Traditional Documentation
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <span className="text-red-500 text-lg">✗</span>
                  <span className="text-gray-400 text-sm">
                    Manual updates required
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500 text-lg">✗</span>
                  <span className="text-gray-400 text-sm">
                    Quickly becomes outdated
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500 text-lg">✗</span>
                  <span className="text-gray-400 text-sm">
                    Static, non-interactive
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500 text-lg">✗</span>
                  <span className="text-gray-400 text-sm">
                    No contextual answers
                  </span>
                </li>
              </ul>
            </div>

            {/* CodeCompass - Center Highlighted Card */}
            <div className="border-2 border-teal-500 rounded-xl p-4 sm:p-6 bg-background relative">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-teal-500 flex items-center justify-center text-xs">
                  ✓
                </div>
                <h3 className="text-lg sm:text-xl font-semibold">
                  CodeCompass
                </h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <span className="text-teal-500 text-lg">✓</span>
                  <span className="text-foreground text-sm font-medium">
                    AI-powered exploration
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-500 text-lg">✓</span>
                  <span className="text-foreground text-sm font-medium">
                    Auto-generated docs
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-500 text-lg">✓</span>
                  <span className="text-foreground text-sm font-medium">
                    Interactive chat interface
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-500 text-lg">✓</span>
                  <span className="text-foreground text-sm font-medium">
                    Multi-platform support
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-500 text-lg">✓</span>
                  <span className="text-foreground text-sm font-medium">
                    Local & cloud deployment
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-500 text-lg">✓</span>
                  <span className="text-foreground text-sm font-medium">
                    Open source
                  </span>
                </li>
              </ul>
            </div>

            {/* Other Such Tools */}
            <div className="border border-gray-800 rounded-xl p-4 sm:p-6 bg-background">
              <h3 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">
                Other Such Tools
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <span className="text-orange-500 text-lg">✗</span>
                  <span className="text-gray-400 text-sm">
                    Limited platform support (only GitHub)
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-500 text-lg">✗</span>
                  <span className="text-gray-400 text-sm">
                    Cloud-only solutions (No self-hosting option)
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-500 text-lg">✗</span>
                  <span className="text-gray-400 text-sm">
                    Proprietary systems (Not Open Source)
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
}
