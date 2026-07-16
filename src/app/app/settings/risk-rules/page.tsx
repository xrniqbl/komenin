import { PageHeader } from "@/components/app/page-header";
import { RiskRulesManager } from "@/components/settings/risk-rules-manager";
import { listRiskRules } from "@/server/risk-rules";

export default async function RiskRulesPage() {
  const rules = await listRiskRules();

  return (
    <div>
      <PageHeader
        title="Risk Rules"
        description="Custom guardrails: banned phrases, promo-claim detectors, and toxicity rules. High severity blocks the draft."
      />
      <RiskRulesManager rules={rules} />
    </div>
  );
}
