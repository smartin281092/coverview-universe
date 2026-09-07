import type { InsuranceCompanyId } from "@coverview/contracts";

const png = new Set<InsuranceCompanyId>(["allianz", "assura", "automate"]);
export function CompanyLogo({
  companyId,
  className = "",
}: {
  companyId: InsuranceCompanyId;
  className?: string;
}) {
  return (
    <img
      src={`/companies/${companyId}.${png.has(companyId) ? "png" : "svg"}`}
      alt=""
      className={`max-h-12 max-w-28 object-contain ${companyId === "generali" ? "rounded bg-red-700 p-1" : ""} ${className}`}
    />
  );
}
