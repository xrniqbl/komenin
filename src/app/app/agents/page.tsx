import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAiRouterStatus } from "@/lib/ai";
import { listAgents } from "@/server/agents";

export default async function AgentsPage() {
  const agents = await listAgents();
  const ai = getAiRouterStatus();

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Personas, knowledge, memory, and playground for grounded engagement drafts."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant={ai.enabled ? "default" : "secondary"}>
              {ai.enabled ? "gateway ready" : "local fallback"}
            </Badge>
            <Button render={<Link href="/app/agents/new" />} nativeButton={false}>
              New agent
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        {agents.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No agents yet</CardTitle>
              <CardDescription>
                Create an agent or let campaign creation provision a default persona.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  <Link href={`/app/agents/${agent.id}`} className="hover:underline">
                    {agent.name}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {agent.tone} · {agent.language} · {agent.status}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="mb-2">{agent.systemPrompt}</div>
                <div className="text-xs">
                  Knowledge docs: {agent._count.knowledgeDocuments} · Memory:{" "}
                  {agent._count.memoryEntries} · Campaigns: {agent._count.campaigns}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
