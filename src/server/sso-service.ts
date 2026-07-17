import { db } from "@/lib/db";

export async function getSsoLoginTarget(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return db.ssoConfig.findFirst({
    where: {
      isActive: true,
      emailDomain: domain,
    },
    orderBy: { createdAt: "desc" },
  });
}