import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  Fieldset,
  FieldsetLegend,
} from "@/components/ui/fieldset";
import { Form } from "@/components/ui/form";
import { FormSelect } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getWorkspaceSsoConfig, saveWorkspaceSsoConfig } from "@/server/sso";
import { requireActiveWorkspace } from "@/server/workspace-access";

export default async function SecuritySettingsPage() {
  const { workspace } = await requireActiveWorkspace();
  const config = await getWorkspaceSsoConfig();

  async function save(formData: FormData) {
    "use server";
    await saveWorkspaceSsoConfig({
      protocol: String(formData.get("protocol") || "saml") as "saml" | "oidc",
      issuer: String(formData.get("issuer") || ""),
      entryPoint: String(formData.get("entryPoint") || ""),
      certificate: String(formData.get("certificate") || ""),
      emailDomain: String(formData.get("emailDomain") || ""),
      defaultRole: String(formData.get("defaultRole") || "operator") as
        | "operator"
        | "admin"
        | "analyst"
        | "auditor"
        | "viewer",
      isActive: formData.get("isActive") === "on",
      ssoRequired: formData.get("ssoRequired") === "on",
    });
  }

  return (
    <div>
      <PageHeader
        title="Security & SSO"
        description="Configure workspace SAML SSO and region residency controls."
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <Form action={save} className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Home region: <span className="font-medium text-foreground">{workspace.homeRegion}</span>
            </div>
            <Fieldset className="space-y-4">
              <FieldsetLegend>Identity provider</FieldsetLegend>
              <Field name="protocol">
                <FieldLabel htmlFor="protocol">Protocol</FieldLabel>
                <FormSelect
                  id="protocol"
                  name="protocol"
                  defaultValue={config?.protocol || "saml"}
                  options={[
                    { value: "saml", label: "SAML" },
                    { value: "oidc", label: "OIDC" },
                  ]}
                />
              </Field>
              <Field name="issuer">
                <FieldLabel htmlFor="issuer">Issuer</FieldLabel>
                <Input id="issuer" name="issuer" defaultValue={config?.issuer || ""} required />
              </Field>
              <Field name="entryPoint">
                <FieldLabel htmlFor="entryPoint">IdP entry point</FieldLabel>
                <Input id="entryPoint" name="entryPoint" defaultValue={config?.entryPoint || ""} required />
              </Field>
              <Field name="certificate">
                <FieldLabel htmlFor="certificate">Certificate (PEM)</FieldLabel>
                <Textarea
                  id="certificate"
                  name="certificate"
                  rows={5}
                  defaultValue={config?.certificate || ""}
                  className="font-mono text-xs"
                  required
                />
              </Field>
            </Fieldset>
            <Fieldset className="space-y-4">
              <FieldsetLegend>Access policy</FieldsetLegend>
              <Field name="emailDomain">
                <FieldLabel htmlFor="emailDomain">Email domain</FieldLabel>
                <Input
                  id="emailDomain"
                  name="emailDomain"
                  defaultValue={config?.emailDomain || ""}
                  placeholder="example.com"
                />
                <FieldDescription>Optional domain restriction for SSO logins.</FieldDescription>
              </Field>
              <Field name="defaultRole">
                <FieldLabel htmlFor="defaultRole">Default role</FieldLabel>
                <FormSelect
                  id="defaultRole"
                  name="defaultRole"
                  defaultValue={config?.defaultRole || "operator"}
                  options={[
                    { value: "operator", label: "operator" },
                    { value: "admin", label: "admin" },
                    { value: "analyst", label: "analyst" },
                    { value: "auditor", label: "auditor" },
                    { value: "viewer", label: "viewer" },
                  ]}
                />
              </Field>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox name="isActive" defaultChecked={config?.isActive ?? true} />
                SSO active
              </Label>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox name="ssoRequired" defaultChecked={workspace.ssoRequired} />
                Require SSO for this workspace
              </Label>
            </Fieldset>
            <Button type="submit">Save SSO settings</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
