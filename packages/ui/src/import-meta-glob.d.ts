// The one bundler feature this package uses: assets listed at build time by the Vite of the app
// that imports it (the site and Wallet). Declared here because the package has no Vite of its own.
interface ImportMeta {
  glob<T>(
    pattern: string,
    options: { eager: true; query: "?url"; import: "default" },
  ): Record<string, T>;
}
