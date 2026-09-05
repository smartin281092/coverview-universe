/**
 * Configuration de `/preview` — complétée à l'initialisation du projet (S-000).
 *
 * Les personas NE SONT PAS définies ici : elles sont importées des seeds, qui en
 * sont la source de vérité unique (DOC-10). Une matrice recopiée ici divergerait
 * au premier rôle ajouté.
 */

// Chemin du module de personas exporté par les seeds — ajusté à S-000 si besoin.
// Emplacement par défaut aligné sur l'arborescence ARCH-06 (`apps/api/src/platform/db`).
// Le fichier est en `.mjs` volontairement : ce script tourne sans build, il ne peut
// pas importer du TypeScript. Les seeds TS importent ce module, jamais l'inverse —
// il reste la source de vérité unique des identifiants de test (ENV-03, DOC-10).
const PERSONAS_MODULE = "./apps/api/src/platform/db/seed/personas.mjs";

export const apps = [
  { key: "client", label: "App client", dir: "apps/client", port: 3000 },
  { key: "admin", label: "Console admin", dir: "apps/admin", port: 3001 },
  { key: "www", label: "Site marketing", dir: "apps/www", port: 3002 },
  { key: "api", label: "API", dir: "apps/api", port: 4000, health: "/health" },
];

export const services = [
  { label: "Mailpit — emails transactionnels", url: "http://localhost:8025" },
  { label: "MinIO — console de stockage", url: "http://localhost:9001", note: "minioadmin / minioadmin" },
];

/** Moyens de paiement de test — Stripe test mode uniquement (BILL-10). */
export const testPayments = {
  "Paiement accepté": "4242 4242 4242 4242",
  "3D Secure requis": "4000 0025 0000 3155",
  "Carte refusée": "4000 0000 0000 9995",
  "Expiration / CVC / code postal": "n'importe quelle date future, n'importe quel CVC, n'importe quel code postal",
};

/** Parcours de fumée minimal, valable quelle que soit la slice. */
export const smokeChecks = [
  "Créer un compte depuis l'app client, puis se connecter",
  "Vérifier l'e-mail de bienvenue dans Mailpit",
  "Se connecter en `outsider` : aucune donnée d'une autre organisation ne doit apparaître",
  "Se connecter en `viewer` : les actions d'écriture doivent être absentes, pas seulement désactivées",
  "Ouvrir la console admin avec la persona plateforme",
];

export let personas = [];
export let personasError = null;
try {
  ({ personas } = await import(PERSONAS_MODULE));
} catch (e) {
  personasError = `Personas indisponibles (${PERSONAS_MODULE}) — lancer les seeds ou corriger PERSONAS_MODULE dans preview.config.mjs.`;
}
