import type { Metadata } from "next";

export const metadata: Metadata = { title: "Log in" };
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
