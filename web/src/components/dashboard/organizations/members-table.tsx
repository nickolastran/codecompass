"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrganizationMember } from "@/app/types/supabase";
import {
  getOrgMembers,
  removeMemberFromOrg,
  updateMemberRole,
  leaveOrganization,
} from "@/lib/services/orgService";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/dashboard/dashboard-provider";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Lazy load dropdown menu components
const DropdownMenu = dynamic(
  () =>
    import("@/components/ui/dropdown-menu").then((mod) => ({
      default: mod.DropdownMenu,
    })),
  { ssr: false },
);
const DropdownMenuContent = dynamic(
  () =>
    import("@/components/ui/dropdown-menu").then((mod) => ({
      default: mod.DropdownMenuContent,
    })),
  { ssr: false },
);
const DropdownMenuItem = dynamic(
  () =>
    import("@/components/ui/dropdown-menu").then((mod) => ({
      default: mod.DropdownMenuItem,
    })),
  { ssr: false },
);
const DropdownMenuTrigger = dynamic(
  () =>
    import("@/components/ui/dropdown-menu").then((mod) => ({
      default: mod.DropdownMenuTrigger,
    })),
  { ssr: false },
);

type MembersTableProps = {
  organizationId: string;
};

export function MembersTable({ organizationId }: MembersTableProps) {
  // Get userId from React Query cache via useAuth hook
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const router = useRouter();

  const [ownerIds, setOwnerIds] = useState<Set<string | undefined>>(new Set());
  const [removingMember, setRemovingMember] =
    useState<OrganizationMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const [managingMember, setManagingMember] =
    useState<OrganizationMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<"owner" | "teammate">(
    "teammate",
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [isLeavingDialogOpen, setIsLeavingDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<OrganizationMember[]>({
    queryKey: ["members", organizationId],
    queryFn: async () => {
      const result = await getOrgMembers(organizationId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });

  useEffect(() => {
    if (data) {
      const owners = data.filter((member) => member.role === "owner");
      setOwnerIds(new Set(owners.map((owner) => owner.user_id)));
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <div className="p-8 text-center text-muted-foreground">
          Loading members...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10">
        <div className="p-8 text-center text-destructive">
          Error: {error.message}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="p-8 text-center text-muted-foreground">
          No members found in this organization.
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;

    setIsRemoving(true);
    setRemoveError(null);

    try {
      const result = await removeMemberFromOrg(
        organizationId,
        removingMember.user_id,
      );

      if (!result.success) {
        setRemoveError(result.error);
        return;
      }

      // Invalidate and refetch members list
      await queryClient.invalidateQueries({
        queryKey: ["members", organizationId],
      });

      // Close dialog and reset state
      setRemovingMember(null);
    } catch (error) {
      console.error("Failed to remove member:", error);
      setRemoveError("An unexpected error occurred");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!managingMember) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const result = await updateMemberRole(
        organizationId,
        managingMember.user_id,
        selectedRole,
      );

      if (!result.success) {
        setUpdateError(result.error);
        return;
      }

      // Invalidate and refetch members list
      await queryClient.invalidateQueries({
        queryKey: ["members", organizationId],
      });

      // Close dialog and reset state
      setManagingMember(null);
    } catch (error) {
      console.error("Failed to update member role:", error);
      setUpdateError("An unexpected error occurred");
    } finally {
      setIsUpdating(false);
    }
  };

  const openManageDialog = (member: OrganizationMember) => {
    setManagingMember(member);
    setSelectedRole(member.role);
    setUpdateError(null);
  };

  const handleLeaveOrganization = async () => {
    setIsLeaving(true);
    setLeaveError(null);

    try {
      const result = await leaveOrganization(organizationId);

      if (!result.success) {
        setLeaveError(result.error);
        return;
      }

      // Redirect to organizations list after leaving
      router.push("/dashboard/organizations");
    } catch (error) {
      console.error("Failed to leave organization:", error);
      setLeaveError("An unexpected error occurred");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-muted-foreground">Email</TableHead>
            <TableHead className="text-muted-foreground">Role</TableHead>
            <TableHead className="text-muted-foreground">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((member) => (
            <TableRow key={member.user_id}>
              <TableCell className="font-medium">{member.user_email}</TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    member.role === "owner"
                      ? "bg-primary/10 text-primary ring-primary/30"
                      : "bg-secondary/50 text-secondary-foreground ring-secondary"
                  }`}
                >
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(member.joined_at)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end items-center gap-2">
                  {ownerIds.has(userId) && member.user_id === userId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ownerIds.size <= 1}
                      className="mr-1"
                      onClick={() => setIsLeavingDialogOpen(true)}
                    >
                      Leave organization
                    </Button>
                  ) : member.role === "teammate" && ownerIds.has(userId) ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openManageDialog(member)}
                      >
                        Manage role
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <EllipsisVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            className="focus:cursor-pointer mt-1 text-sm text-destructive bg-elevated focus:text-foreground focus:bg-destructive"
                            onSelect={() => setRemovingMember(member)}
                          >
                            Remove member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : member.role === "teammate" &&
                    member.user_id === userId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-1"
                      onClick={() => setIsLeavingDialogOpen(true)}
                    >
                      Leave organization
                    </Button>
                  ) : (
                    <> </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={!!removingMember}
        onOpenChange={(open) => {
          if (!open) {
            setRemovingMember(null);
            setRemoveError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">{removingMember?.user_email}</span>{" "}
              from this organization? They will lose access to all repositories
              and data.
            </DialogDescription>
          </DialogHeader>
          {removeError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {removeError}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isRemoving}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!managingMember}
        onOpenChange={(open) => {
          if (!open) {
            setManagingMember(null);
            setUpdateError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage access</DialogTitle>
            <DialogDescription>
              Change the role for{" "}
              <span className="font-medium">{managingMember?.user_email}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select
                value={selectedRole}
                onValueChange={(value) =>
                  setSelectedRole(value as "owner" | "teammate")
                }
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teammate">Member</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedRole === "owner"
                  ? "Owners can manage members, settings, and have full access to all repositories."
                  : "Members can access repositories but cannot manage organization settings."}
              </p>
            </div>
            {updateError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {updateError}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isUpdating}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleUpdateRole}
              disabled={isUpdating || selectedRole === managingMember?.role}
            >
              {isUpdating ? "Updating..." : "Update role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isLeavingDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsLeavingDialogOpen(false);
            setLeaveError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this organization? You will lose
              access to all repositories and data. You can only rejoin if
              someone invites you again.
            </DialogDescription>
          </DialogHeader>
          {leaveError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {leaveError}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isLeaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleLeaveOrganization}
              disabled={isLeaving}
            >
              {isLeaving ? "Leaving..." : "Leave organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
