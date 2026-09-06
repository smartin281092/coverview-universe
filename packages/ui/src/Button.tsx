import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva("cv-button", {
  variants: {
    variant: {
      default: "",
      outline: "cv-button--outline",
      secondary: "cv-button--secondary",
      ghost: "cv-button--ghost",
      destructive: "cv-button--destructive",
      link: "cv-button--link",
    },
    size: {
      default: "",
      xs: "cv-button--xs",
      sm: "cv-button--sm",
      lg: "cv-button--lg",
      icon: "cv-button--icon",
      "icon-xs": "cv-button--icon",
      "icon-sm": "cv-button--icon",
      "icon-lg": "cv-button--icon",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"a"> & VariantProps<typeof buttonVariants>) {
  return (
    <a
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
