/**
 * Cas d'éval de routage — EVAL-02.
 *
 * Format JS et non YAML : ces cas doivent tourner sur un dépôt fraîchement
 * initialisé, avant tout `pnpm install`. Zéro dépendance, zéro parsing.
 *
 * Sémantique des assertions (EVAL-03) — lire avant d'ajouter un cas :
 *   load    : satellites qui DOIVENT être chargés   (assertion d'inclusion)
 *   exclude : satellites qui NE DOIVENT PAS l'être  (assertion de disjonction)
 *
 * Ce n'est volontairement PAS une égalité d'ensembles. Un satellite ni listé
 * ni exclu est neutre : l'agent a le droit de le charger ou non. Une égalité
 * stricte produirait des échecs à chaque ajout de satellite et l'éval finirait
 * désactivée — c'est le mode de mort le plus courant d'une suite de tests.
 *
 * Ne lister dans `load` que ce dont l'absence rendrait la tâche non conforme.
 * Ne lister dans `exclude` que ce dont la présence serait un vrai gaspillage.
 */

export const cases = [
  // — Backend et données ————————————————————————————————
  {
    id: "R-001",
    task: "Ajouter une table `invoices` avec son schéma Drizzle et sa migration.",
    load: ["data.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "design.md"],
  },
  {
    id: "R-002",
    task: "Créer l'endpoint POST /projects avec validation et gestion d'erreurs.",
    load: ["api.md", "contracts.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md"],
  },
  {
    id: "R-003",
    task: "Un utilisateur d'une organisation voit les projets d'une autre organisation. Corriger.",
    load: ["data.md", "permissions.md", "security.md"],
    exclude: ["marketing-web.md", "seo.md", "design.md"],
  },
  {
    id: "R-004",
    task: "Ajouter le rôle `viewer` et la permission `projects.read` sans casser les rôles existants.",
    load: ["permissions.md", "evolution.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md"],
  },
  {
    id: "R-005",
    task: "Diffuser en temps réel l'avancement d'un déploiement aux membres autorisés de l'organisation.",
    load: ["realtime.md", "permissions.md", "events.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md"],
  },
  {
    id: "R-006",
    task: "Envoyer les relances d'abonnement expiré via un job planifié quotidien.",
    load: ["jobs.md", "email.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "realtime.md"],
  },
  {
    id: "R-007",
    task: "Brancher les webhooks Stripe pour activer les entitlements à la souscription.",
    load: ["billing.md", "security.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "design.md"],
  },
  {
    id: "R-008",
    task: "Permettre l'upload d'un logo d'organisation, stocké et servi de façon privée.",
    load: ["storage.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "realtime.md"],
  },

  // — Frontends applicatifs ——————————————————————————————
  {
    id: "R-009",
    task: "Construire l'écran de liste des projets avec pagination, état vide et état d'erreur.",
    load: ["frontend.md", "design.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "jobs.md"],
  },
  {
    id: "R-010",
    task: "Ajouter un formulaire de création de projet avec validation et messages d'erreur affichés.",
    load: ["frontend.md", "design.md", "i18n.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "jobs.md", "realtime.md"],
  },

  // — Site marketing et visibilité ————————————————————————
  {
    id: "R-011",
    task: "Refondre la page pricing de www : nouveaux paliers, FAQ, CTA d'essai.",
    load: ["marketing-web.md", "seo.md"],
    exclude: ["backend.md", "data.md", "realtime.md", "jobs.md", "frontend.md", "design.md"],
  },
  {
    id: "R-012",
    task: "Publier le site en français et en anglais avec les bonnes balises hreflang et un sitemap par locale.",
    load: ["seo.md", "marketing-web.md", "i18n.md"],
    exclude: ["backend.md", "data.md", "realtime.md", "jobs.md"],
  },
  {
    id: "R-013",
    task: "Rendre le contenu du blog exploitable par les agents et moteurs de réponse IA.",
    load: ["geo.md"],
    exclude: ["backend.md", "data.md", "realtime.md", "jobs.md", "billing.md"],
  },

  // — i18n applicative ——————————————————————————————————
  {
    id: "R-014",
    task: "Externaliser toutes les chaînes de l'app admin et gérer les pluriels correctement.",
    load: ["i18n.md", "frontend.md"],
    exclude: ["marketing-web.md", "data.md", "jobs.md", "realtime.md"],
  },

  // — Transverse et outillage ————————————————————————————
  {
    id: "R-015",
    task: "Ajouter `date-fns` au projet pour formater des dates.",
    load: ["dependencies.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "realtime.md", "billing.md"],
  },
  {
    id: "R-016",
    task: "La CI échoue par intermittence sur un test de permissions. Diagnostiquer et corriger.",
    load: ["testing.md", "delivery.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "design.md"],
  },
  {
    id: "R-017",
    task: "Extraire le module `notifications` du module `projects` devenu trop gros.",
    load: ["architecture.md", "conventions.md", "evolution.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md"],
  },
  {
    id: "R-018",
    task: "Corriger une faute d'orthographe dans le libellé du bouton « Enregistrer » de l'app client.",
    load: ["i18n.md"],
    exclude: [
      "architecture.md", "data.md", "backend.md", "realtime.md", "jobs.md",
      "billing.md", "security.md", "permissions.md", "marketing-web.md", "seo.md", "geo.md",
    ],
  },

  // — Ambiguïté métier (routage seulement — le comportement est testé par C-01) —
  {
    id: "R-021",
    task: "Facturer au prorata quand un utilisateur change de palier en cours de mois.",
    load: ["billing.md", "data.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "realtime.md"],
  },

  {
    id: "R-022",
    task: "Lancer les applications en local pour que je teste la slice en cours dans mon navigateur.",
    load: ["environment.md", "program.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "billing.md", "data.md"],
  },

  // — Offre commerciale ————————————————————————————————
  // Créer un plan ≠ afficher un plan : la contrepartie Stripe existe (CAT-03/CAT-08),
  // donc billing.md est requis ici. C'est le pendant de R-025.
  {
    id: "R-023",
    task: "Ajouter un plan Team à trois paliers avec ses entitlements, et mettre à jour la page pricing.",
    load: ["catalog.md", "marketing-web.md", "billing.md"],
    exclude: ["realtime.md", "jobs.md", "storage.md", "geo.md"],
  },
  // L'exclusion la plus contre-intuitive de §5, et donc celle qui a le plus besoin
  // d'être testée : une page pricing qui ne fait qu'AFFICHER ne charge pas billing.md.
  {
    id: "R-025",
    task: "Réordonner les colonnes du tableau comparatif de la page pricing et corriger deux libellés.",
    load: ["catalog.md", "marketing-web.md"],
    exclude: ["billing.md", "realtime.md", "jobs.md", "storage.md", "data.md"],
  },
  // Un îlot interactif est du travail frontend malgré l'exclusion générale des tâches www.
  {
    id: "R-026",
    task: "Ajouter au site marketing un formulaire de demande de démo, avec ses états de chargement et d'erreur.",
    load: ["marketing-web.md", "frontend.md"],
    exclude: ["realtime.md", "jobs.md", "billing.md", "geo.md"],
  },
  // Conformité : launch.md doit se déclencher, et data.md rester chargé (l'effacement
  // touche la persistance). Aucune raison de charger le marketing ni le temps réel.
  {
    id: "R-027",
    task: "Permettre à un utilisateur d'exporter ses données et de supprimer son compte lui-même.",
    load: ["launch.md", "data.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "realtime.md", "billing.md"],
  },
  {
    id: "R-024",
    task: "Le webhook invoice.payment_failed n'active pas la période de grâce. Diagnostiquer.",
    load: ["billing.md", "jobs.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "design.md"],
  },

  // Régressions observées pendant l'adaptation CoverView : anciens défauts
  // de fournisseur, de preset, de cible et commandes seulement Claude.
  {
    id: "R-028",
    task: "Adapter la connexion CoverView au projet WorkOS demandé, en préservant les sessions protégées.",
    load: ["auth.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md"],
  },
  {
    id: "R-029",
    task: "Appliquer la palette fournie et le preset shadcn CoverView aux boutons ouvrant les détails de Wallet.",
    load: ["brand.md", "design.md", "frontend.md"],
    exclude: ["billing.md", "jobs.md"],
  },
  {
    id: "R-030",
    task: "Préparer le déploiement dédié Infomaniak Horizon sur coverview.ch en protégeant les instances présentes.",
    load: ["hosting.md", "delivery.md"],
    exclude: ["design.md", "frontend.md"],
  },
  {
    id: "R-031",
    task: "Préparer une nouvelle session Codex à contexte propre pour continuer une slice Astra Ultra.",
    load: ["codex.md", "program.md"],
    exclude: ["billing.md", "realtime.md", "jobs.md"],
  },

  // — Couche programme ———————————————————————————————————
  {
    id: "R-019",
    task: "Préparer le plan de la prochaine slice du backlog et me le soumettre.",
    load: ["program.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "realtime.md", "billing.md"],
  },
  {
    id: "R-020",
    task: "Trier les candidats de MEMORY.md et me proposer leur destination.",
    load: ["memory.md"],
    exclude: ["marketing-web.md", "seo.md", "geo.md", "realtime.md", "billing.md", "data.md"],
  },
];
