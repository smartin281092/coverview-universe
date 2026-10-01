import type { HealthOffer } from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { interpolate } from "./health-format";

const assets = import.meta.glob<string>("../../assets/health-products/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const images = new Map(
  Object.entries(assets).map(([path, url]) => [
    path
      .split("/")
      .pop()
      ?.replace(/\.webp$/, ""),
    url,
  ]),
);

export function HealthProductImage({
  offer,
  thumbnail = false,
}: {
  offer: Pick<HealthOffer, "modelId" | "name" | "insurerBrand" | "insurerName">;
  thumbnail?: boolean;
}) {
  const src = images.get(offer.modelId);
  if (!src) return null;
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
