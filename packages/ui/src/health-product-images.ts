// Illustrations of the health insurance models (README in ./health-products), shared by the public
// site and Wallet since 20 October 2026: one WebP per 2027 model id, listed by the app's bundler.
const assets = import.meta.glob<string>("./health-products/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const images = new Map(
  Object.entries(assets).map(([path, url]) => [
    path
      .split("/")
      .pop()
      ?.replace(/\.webp$/u, ""),
    url,
  ]),
);

export const healthProductImage = (modelId: string) => images.get(modelId);
