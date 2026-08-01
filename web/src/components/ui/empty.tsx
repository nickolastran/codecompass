// components/ui/empty.tsx
import { ReactNode } from "react";

interface EmptyProps {
  title: string;
  description?: string;
  children?: ReactNode;
  icon?: ReactNode;
}

export function Empty({ title, description, children, icon }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      {icon && <div className="mb-3 rounded-lg bg-muted p-2">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
