/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_URL?: string;
  readonly PUBLIC_WALLET_URL?: string;
  // "false" hides sign-in and offer requests until accounts and email exist in that environment.
  readonly PUBLIC_REQUESTS_ENABLED?: string;
}
