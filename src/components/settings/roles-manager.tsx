"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ConfirmAction } from "@/components/ui-patterns/confirm-action";
import { toastManager } from "@/components/ui/toast";
import { PERMISSION_DEFINITIONS } from "@/lib/rbac";
import { createCustomRole, deleteCustomRole } from "@/server/custom-roles";

type CustomRole = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date | string;
  _count?: { memberships: number };
};

type SystemRole = {
  role: string;
  permissions: string[];
  isSystem: boolean;
};

const GROUPED_PERMS = (() => {
  const groups = new Map<string, { key: string; label: string; group: string }[]>();
  for (const def of PERMISSION_DEFINITIONS) {
    const arr = groups.get(def.group) || [];
    arr.push(def);
    groups.set(def.group, arr);
  }
  return groups;
})();

export function RolesManager({
  customRoles,
  systemRoles,
}: {
  customRoles: CustomRole[];
  systemRoles: SystemRole[];
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(["analytics.view"]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!name.trim()) { setError("Name required"); return; }
    if (selectedPerms.length === 0) { setError("Select at least one permission"); return; }
    setError("");
    startTransition(async () => {
      try {
        await createCustomRole({ name: name.trim(), description: description.trim() || undefined, permissions: selectedPerms });
        setName("");
        setDescription("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create");
      }
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCustomRole(id);
      toastManager.add({ title: "Role deleted", type: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="error">
          <AlertTitle>Could not save role</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Create custom role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Content Reviewer" className="h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Can review and approve content" className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from(GROUPED_PERMS.entries()).map(([group, perms]) => (
              <Card key={group} className="bg-muted/20 py-0 shadow-none">
                <CardContent className="p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
                  <div className="flex flex-wrap gap-2">
                    {perms.map((p) => (
                      <Label
                        key={p.key}
                        className="flex cursor-pointer items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-normal hover:bg-accent"
                      >
                        <Checkbox
                          checked={selectedPerms.includes(p.key)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedPerms((prev) => [...prev, p.key]);
                            else setSelectedPerms((prev) => prev.filter((x) => x !== p.key));
                          }}
                          className="size-3"
                        />
                        {p.label}
                      </Label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button size="sm" disabled={pending} onClick={handleCreate}>{pending ? "..." : "Create role"}</Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Custom roles ({customRoles.length})</h3>
        {customRoles.length === 0 ? (
          <Card className="gap-0 py-0"><Empty className="py-10">
            <EmptyHeader>
              <EmptyTitle>No custom roles yet</EmptyTitle>
              <EmptyDescription>Create a custom role with scoped permissions above.</EmptyDescription>
            </EmptyHeader>
          </Empty></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {customRoles.map((role) => (
              <Card key={role.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{role.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">/{role.slug} · {role._count?.memberships ?? 0} members</div>
                      {role.description ? <div className="mt-1 text-xs text-muted-foreground">{role.description}</div> : null}
                    </div>
                    <ConfirmAction
                      title="Delete custom role?"
                      description="Members using this role must be reassigned first."
                      confirmLabel="Delete role"
                      destructive
                      disabled={pending}
                      trigger={<Button size="sm" variant="ghost" className="h-7 text-xs">Delete</Button>}
                      onConfirm={() => handleDelete(role.id)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <Badge key={p} variant="outline" className="text-[9px]">{p}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">System roles (read-only)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systemRoles.map((sr) => (
            <Card key={sr.role} className="bg-muted/20">
              <CardContent className="p-4">
                <div className="text-sm font-medium capitalize">{sr.role}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {sr.permissions.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[9px]">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
