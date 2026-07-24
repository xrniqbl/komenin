import { CompetitorsClient } from "@/components/competitors/competitors-client";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { getCompetitorOverview, listCompetitorProfiles } from "@/server/competitors";

export default async function CompetitorsPage() {
  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.competitorRadar))) {
    return (
      <div>
        <PageHeader
          title="Competitor Radar"
          description="This module is currently disabled by feature flag."
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Module off</CardTitle>
            <CardDescription>
              Enable <code>competitor_radar</code> in Admin → Feature flags to show this surface.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    );
  }

  const [overview, profiles] = await Promise.all([
    getCompetitorOverview(),
    listCompetitorProfiles(),
  ]);

  return (
    <div>
      <PageHeader
        title="Competitor Radar"
        description="Track competitors' posting activity, volume trends, and top keywords. Backed by listener discovery."
      />
      <CompetitorsClient initialProfiles={profiles} ownPosts={overview.ownPosts} />
    </div>
  );
}
