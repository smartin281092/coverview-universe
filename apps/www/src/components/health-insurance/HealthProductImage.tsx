import type { ReactNode } from "react";
import type { HealthOffer } from "@coverview/api-client/health-insurance";
import { healthProductImage } from "@coverview/ui/health-product-images";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { interpolate } from "./health-format";

export function HealthProductImage({
  offer,
  thumbnail = false,
  fallback = null,
}: {
  offer: Pick<HealthOffer, "modelId" | "name" | "insurerBrand" | "insurerName">;
  thumbnail?: boolean;
  // Shown when the model has no illustration (the insurer's logo, for instance).
  fallback?: ReactNode;
}) {
  const src = healthProductImage(offer.modelId);
  if (!src) return fallback;
  return (
    <img
      className={thumbnail ? "hi-product-image is-thumbnail" : "hi-product-image"}
      src={src}
      alt={interpolate(copy.productImage, {
        model: offer.name,
        brand: offer.insurerBrand ?? offer.insurerName,
      })}
      width={768}
      height={768}
      decoding="async"
      loading={thumbnail ? "lazy" : "eager"}
    />
  );
}
