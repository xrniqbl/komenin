import { CompetitorsClient } from "@/components/competitors/competitors-client";
import { PageHeader } from "@/components/app/page-header";
import { getCompetitorOverview, listCompetitorProfiles } from "@/server/competitors";

export default async function CompetitorsPage() {
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
