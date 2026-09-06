import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import { Card } from "./Card";

export type BentoProps = Omit<ComponentProps<"article">, "title"> & {
  title: ReactNode;
  level?: 2 | 3;
  description?: ReactNode;
  illustration?: ReactNode;
  value?: ReactNode;
  label?: ReactNode;
};

export function Bento({
  title,
  level = 3,
  description,
  illustration,
  value,
  label,
  className,
  children,
  ...props
}: BentoProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Card asChild className={cn("cv-bento", className)}>
      <article {...props}>
        <div>
          <Heading className="cv-bento__title">{title}</Heading>
          {description && <p className="cv-bento__description">{description}</p>}
        </div>
        {value != null && (
          <div>
            <p className="cv-bento__value">{value}</p>
            {label && <p className="cv-bento__label">{label}</p>}
          </div>
        )}
        {illustration && <div className="cv-bento__illustration">{illustration}</div>}
        {children}
      </article>
    </Card>
  );
}
