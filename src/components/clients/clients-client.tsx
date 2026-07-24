"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient, updateAgencyLabel, updateClient } from "@/server/clients";

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
  isActive: boolean;
  leads: number;
  campaigns: number;
};

export function ClientsClient({
  clients,
  agencyLabel,
  workspaceName,
}: {
  clients: ClientRow[];
  agencyLabel: string;
  workspaceName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [label, setLabel] = useState(agencyLabel);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Agency label</CardTitle>
          <CardDescription>
            Optional brand line for this control-plane workspace ({workspaceName}).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="agency-label">Label</Label>
            <Input
              id="agency-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Northstar Growth Agency"
            />
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateAgencyLabel({ agencyLabel: label });
              })
            }
          >
            Save label
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add client</CardTitle>
          <CardDescription>
            Clients are tags for reporting and lead assignment — not full tenant isolation yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Brand Co"
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="client-notes">Notes</Label>
            <Textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20"
            />
          </div>
          <div>
            <Button
              disabled={pending || name.trim().length < 2}
              onClick={() =>
                startTransition(async () => {
                  await createClient({ name, notes: notes || undefined });
                  setName("");
                  setNotes("");
                })
              }
            >
              Create client
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No clients yet. Create one to tag campaigns and leads.
            </CardContent>
          </Card>
        ) : (
          clients.map((client) => (
            <Card key={client.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{client.name}</CardTitle>
                    <CardDescription>
                      {client.slug} · {client.campaigns} campaigns · {client.leads} leads
                    </CardDescription>
                  </div>
                  <Badge variant={client.isActive ? "secondary" : "outline"}>
                    {client.isActive ? "active" : "inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {client.notes ? (
                  <p className="w-full text-sm text-muted-foreground">{client.notes}</p>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await updateClient({
                        clientId: client.id,
                        isActive: !client.isActive,
                      });
                    })
                  }
                >
                  {client.isActive ? "Deactivate" : "Activate"}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
