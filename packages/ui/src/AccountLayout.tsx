import type { ReactNode } from "react";
import { SectionHeading } from "./Layout";

export type AccountLayoutProps = {
  title: string;
  eyebrow: string;
  description: string;
  heading?: ReactNode;
  layout?: "split" | "tabs";
  details: ReadonlyArray<{ title: string; description: string; icon?: ReactNode }>;
  children: ReactNode;
};

export function AccountLayout({
  title,
  eyebrow,
  description,
  heading,
  layout = "split",
  details,
  children,
}: AccountLayoutProps) {
  return (
    <div className={layout === "tabs" ? "cv-account-layout cv-tabbed-page" : "cv-account-layout"}>
      {heading ?? (
        <SectionHeading
          className="cv-account-layout__heading"
          title={title}
          eyebrow={eyebrow}
          description={description}
          level={1}
        />
      )}
      <div className="cv-account-layout__content">{children}</div>
      <ul className="cv-account-layout__details">
        {details.map((detail) => (
          <li key={detail.title} className="cv-account-layout__detail">
            {detail.icon && (
              <span className="cv-account-layout__detail-icon" aria-hidden="true">
                {detail.icon}
              </span>
            )}
            <div>
              <h2>{detail.title}</h2>
              <p>{detail.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
