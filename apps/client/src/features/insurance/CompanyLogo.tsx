import type { InsuranceCompanyId } from "@coverview/contracts";

const png = new Set<InsuranceCompanyId>(["allianz", "assura", "automate"]);
export function CompanyLogo({
  companyId,
  className,
  alt = "",
}: {
  companyId: InsuranceCompanyId;
  // Sizing classes replace the default bounds: kept side by side, the stylesheet's order chose
  // the wider bound and a wide logo overflowed its box (8 October 2026).
  className?: string;
  // Empty when the name is written next to the logo; the name when the logo replaces it.
  alt?: string;
}) {
  return (
    <img
      src={`/companies/${companyId}.${png.has(companyId) ? "png" : "svg"}`}
      alt={alt}
      className={`object-contain ${companyId === "generali" ? "rounded bg-red-700 p-1" : ""} ${className ?? "max-h-12 max-w-28"}`}
    />
  );
}
