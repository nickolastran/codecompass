import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="w-full">
        <div className="container flex h-16 items-center justify-between px-4">
          <Skeleton className="h-[45px] w-[45px] rounded-full" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-6 w-64" />
          </div>
          <div className="space-y-4">
            <div className="flex flex-col space-y-5">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="border-b border-border"></div>
            <div className="space-y-5">
              <div className="flex flex-col items-start gap-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-9 w-full" />
              </div>
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
