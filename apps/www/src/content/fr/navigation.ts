// The site's main menu (9 October 2026): the comparator's header everywhere, with a Comparator
// and an Audit menu built on the model the user gave (highlights on the left, a filterable list on
// the right). Every link is a page of its own: no anchor.
export type NavigationIcon =
  | "heart-pulse"
  | "chart"
  | "scale"
  | "compare"
  | "book"
  | "calculator"
  | "sliders"
  | "search-check"
  | "file"
  | "shield"
  | "folder"
  | "briefcase"
  | "route"
  | "signature";
export type NavigationLink = { href: string; icon: NavigationIcon; label: string };
export type NavigationHighlight = NavigationLink & { description: string };
export type NavigationMenu = {
  id: "comparateur" | "audit";
  label: string;
  highlightsTitle: string;
  listTitle: string;
  highlights: NavigationHighlight[];
  links: NavigationLink[];
};

export const navigation = {
  label: "Navigation principale",
  home: "Accueil CoverView",
  open: "Ouvrir le menu",
  close: "Fermer le menu",
  menuTitle: "Menu",
  filter: "Filtrer…",
  filterLabel: "Filtrer les liens de ce menu",
  empty: "Aucun lien ne correspond.",
  cart: "Mon panier",
  signIn: "Se connecter",
  createAccount: "Créer un compte",
  menus: [
    {
      id: "comparateur",
      label: "Comparateur",
      highlightsTitle: "À la une",
      listTitle: "Comparer",
      highlights: [
        {
          href: "/comparateur-assurance-maladie-2027",
          icon: "heart-pulse",
          label: "Assurance maladie 2027",
          description:
            "Les primes officielles de toutes les caisses, par commune, modèle et franchise.",
        },
        {
          href: "/benchmark",
          icon: "chart",
          label: "Comparer un 3e pilier",
          description: "Frais, risques, protections et flexibilité dans un cadre commun.",
        },
        {
          href: "/etudes-de-cas/comparaison",
          icon: "scale",
          label: "Deux 3es piliers face à face",
          description: "Un cas fictif pour examiner une nouvelle proposition avant de choisir.",
        },
      ],
      links: [
        {
          href: "/comparateur-assurance-maladie-2027",
          icon: "heart-pulse",
          label: "Assurance maladie",
        },
        { href: "/comparer", icon: "compare", label: "Comparer mes options" },
        { href: "/benchmark", icon: "chart", label: "Critères du benchmark" },
        { href: "/articles/lire-un-benchmark", icon: "book", label: "Lire un benchmark" },
        { href: "/calculer-retraite", icon: "calculator", label: "Calculer ma retraite" },
        { href: "/outils", icon: "sliders", label: "Simulateurs" },
      ],
    },
    {
      id: "audit",
      label: "Audit",
      highlightsTitle: "À la une",
      listTitle: "Analyser",
      highlights: [
        {
          href: "/analyser-3p",
          icon: "search-check",
          label: "Analyser mon 3e pilier",
          description: "Placements, frais, garanties : les points clés de votre contrat.",
        },
        {
          href: "/rapports/exemple",
          icon: "file",
          label: "Votre rapport de prévoyance",
          description: "Les dix volets d’un rapport, à travers un exemple fictif.",
        },
        {
          href: "/etudes-de-cas/maintien",
          icon: "shield",
          label: "Conserver son 3e pilier",
          description: "Quand l’analyse confirme que le contrat actuel répond à vos besoins.",
        },
      ],
      links: [
        { href: "/analyser-3p", icon: "search-check", label: "Analyser mon 3e pilier" },
        { href: "/recuperer-contrats", icon: "folder", label: "Récupérer mes contrats" },
        { href: "/retrouver-lpp", icon: "briefcase", label: "Retrouver mes avoirs LPP" },
        { href: "/rapports", icon: "file", label: "Rapport de prévoyance" },
        { href: "/methode", icon: "route", label: "Notre méthode" },
        { href: "/signature", icon: "signature", label: "Procurations et signature" },
        { href: "/articles/pourquoi-conserver", icon: "book", label: "Changer de 3e pilier ?" },
      ],
    },
  ] satisfies NavigationMenu[],
};
