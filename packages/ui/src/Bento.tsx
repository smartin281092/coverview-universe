import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

export type BentoProps = Omit<ComponentProps<"article">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  illustration?: ReactNode;
  value?: ReactNode;
  label?: ReactNode;
};

export function Bento({
  title,
  description,
  illustration,
  value,
  label,
  className,
  children,
  ...props
}: BentoProps) {
  return (
    <article className={cn("cv-bento", className)} {...props}>
      <div>
        <h3 className="cv-bento__title">{title}</h3>
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
  );
}
