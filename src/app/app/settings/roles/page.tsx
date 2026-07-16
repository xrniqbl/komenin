import { PageHeader } from "@/components/app/page-header";
import { RolesManager } from "@/components/settings/roles-manager";
import { listCustomRoles, listSystemRoles } from "@/server/custom-roles";

export default async function RolesPage() {
  const [customRoles, systemRoles] = await Promise.all([
    listCustomRoles(),
    listSystemRoles(),
  ]);

  return (
    <div>
      <PageHeader
        title="Custom Roles"
        description="Create fine-grained roles by composing permissions. Assign to members via invite."
      />
      <RolesManager customRoles={customRoles} systemRoles={systemRoles} />
    </div>
  );
}
