import type { InsuranceCompanyId } from "@coverview/contracts";

const png = new Set<InsuranceCompanyId>(["allianz", "assura", "automate"]);
export function CompanyLogo({
  companyId,
  className = "",
  alt = "",
}: {
  companyId: InsuranceCompanyId;
  className?: string;
  // Empty when the name is written next to the logo; the name when the logo replaces it.
  alt?: string;
}) {
  return (
    <img
      src={`/companies/${companyId}.${png.has(companyId) ? "png" : "svg"}`}
      alt={alt}
      className={`max-h-12 max-w-28 object-contain ${companyId === "generali" ? "rounded bg-red-700 p-1" : ""} ${className}`}
    />
  );
}
