import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

export function Container({
  size = "wide",
  className,
  ...props
}: ComponentProps<"div"> & { size?: "wide" | "reading" }) {
  return (
    <div
      className={cn("cv-container", size === "reading" && "cv-container--reading", className)}
      {...props}
    />
  );
}

export function Section({
  tone = "white",
  spacing = "normal",
  className,
  ...props
}: ComponentProps<"section"> & {
  tone?: "white" | "soft" | "dark";
  spacing?: "normal" | "compact";
}) {
  return (
    <section
      className={cn(
        "cv-section",
        tone !== "white" && `cv-section--${tone}`,
        spacing === "compact" && "cv-section--compact",
        className,
      )}
      {...props}
    />
  );
}

export function Stack({
  gap = "md",
  direction = "vertical",
  align = "start",
  className,
  ...props
}: ComponentProps<"div"> & {
  gap?: "sm" | "md" | "lg";
  direction?: "vertical" | "horizontal";
  align?: "start" | "center";
}) {
  return (
    <div
      className={cn(
        "cv-stack",
        gap !== "md" && `cv-stack--${gap}`,
        direction === "horizontal" && "cv-stack--horizontal",
        align === "center" && "cv-stack--center",
        className,
      )}
      {...props}
    />
  );
}

export type SectionHeadingProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  level?: 1 | 2 | 3;
  size?: "display" | "large" | "medium";
  align?: "start" | "center";
  id?: string;
  className?: string;
};

export function SectionHeading({
  title,
  eyebrow,
  description,
  level = 2,
  size = "large",
  align = "start",
  id,
  className,
}: SectionHeadingProps) {
  const Heading = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
  return (
    <div
      className={cn(
        "cv-heading",
        `cv-heading--${size}`,
        align === "center" && "cv-heading--center",
        className,
      )}
    >
      {eyebrow && <p className="cv-heading__eyebrow">{eyebrow}</p>}
      <Heading id={id} className="cv-heading__title">
        {title}
      </Heading>
      {description && <p className="cv-heading__description">{description}</p>}
    </div>
  );
}
