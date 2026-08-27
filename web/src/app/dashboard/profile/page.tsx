"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Building2,
  Check,
  Laptop,
  LogOut,
  Moon,
  Sun,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { NavbarContextSetter } from "@/components/dashboard/navbar-context-setter";
import { useAuth } from "@/app/dashboard/dashboard-provider";
import { createClient } from "@/utils/supabase/client";
import { signOut } from "@/app/(auth)/client";
import { getOrgs } from "@/lib/services/orgService";
import { OrganizationWithRole } from "@/app/types/supabase";
import { formatRelativeTime } from "@/lib/utils";

type Notice = { kind: "ok" | "error"; text: string } | null;

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  const meta = user?.user_metadata ?? {};
  const currentName =
    meta.display_name ||
    meta.user_name ||
    meta.preferred_username ||
    meta.full_name ||
    user?.email?.split("@")[0] ||
    "";
  const provider = user?.app_metadata?.provider ?? "email";

  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  // next-themes can't be read until after hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: orgs } = useQuery<OrganizationWithRole[]>({
    queryKey: ["organizations"],
    queryFn: async () => {
      const result = await getOrgs();
      if (!result.success) throw new Error(result.error);
      return result.data as OrganizationWithRole[];
    },
  });

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ kind: "ok", text: await fn() });
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setBusy(false);
    }
  }

  const saveName = () =>
    run(async () => {
      const display_name = name.trim();
      if (!display_name) throw new Error("Username can't be empty");
      const { error } = await supabase.auth.updateUser({ data: { display_name } });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      router.refresh();
      return "Username updated";
    });

  const saveEmail = () =>
    run(async () => {
      const next = email.trim().toLowerCase();
      if (next === user?.email) throw new Error("That's already your email");
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      return `Confirmation link sent to ${next}. The change applies once you click it.`;
    });

  const savePassword = () =>
    run(async () => {
      if (password.length < 8)
        throw new Error("Password must be at least 8 characters");
      if (password !== confirm) throw new Error("Passwords don't match");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      return "Password updated";
    });

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-10 px-4">
      <NavbarContextSetter contextText="Profile" />

      {/* Identity */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-medium uppercase">
          {currentName.charAt(0) || "?"}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl text-foreground truncate">{currentName}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {user?.email}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Signed in with {provider}
            {user?.created_at && ` · joined ${formatRelativeTime(user.created_at)}`}
          </p>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            notice.kind === "ok"
              ? "border-border text-foreground"
              : "border-destructive text-destructive"
          }`}
        >
          {notice.kind === "ok" ? (
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="flex gap-2">
              <Input
                id="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
              />
              <Button
                onClick={saveName}
                disabled={busy || name.trim() === currentName}
              >
                Save
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                onClick={saveEmail}
                disabled={busy || !email.trim() || email.trim() === user?.email}
              >
                Change
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We&apos;ll email a confirmation link to the new address.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button onClick={savePassword} disabled={busy || !password}>
            Update password
          </Button>
          <p className="text-xs text-muted-foreground">
            Sign-in today is magic link and OAuth only, so a password is a
            backup for when email/password login is enabled.
          </p>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(
              [
                ["light", Sun],
                ["dark", Moon],
                ["system", Laptop],
              ] as const
            ).map(([value, Icon]) => (
              <Button
                key={value}
                variant={mounted && theme === value ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(value)}
                className="capitalize"
              >
                <Icon className="h-4 w-4" />
                {value}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Organizations */}
      <Card>
        <CardHeader>
          <CardTitle>Your organizations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {orgs?.length ? (
            orgs.map((org) => (
              <Link
                key={org.id}
                href={`/dashboard/org/${org.id}`}
                className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {org.name}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {org.role}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              You&apos;re not in any organization yet.{" "}
              <Link href="/dashboard/new" className="text-primary underline">
                Create one
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={() => signOut()} disabled={busy}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Signed in somewhere you don&apos;t recognise? End every session.
            </p>
            <Button
              variant="destructive"
              onClick={() => signOut("global")}
              disabled={busy}
            >
              Sign out everywhere
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
