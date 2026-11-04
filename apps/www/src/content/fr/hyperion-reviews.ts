/**
 * Avis Google repris du dépôt smartin281092/bmpartners (commit bba0848, composant
 * frontend/src/components/google-reviews.jsx), texte et nom tels que publiés. Les dates relatives du
 * dépôt (« il y a 2 jours ») étaient périmées à la copie : elles ne sont pas affichées. Sélection :
 * sujets prévoyance, 3e pilier, investissement et assurance-vie ; note Google 5/5 sur 15 avis selon
 * frontend/src/data/business-info.js. Plusieurs avis citent l’ancienne raison sociale.
 */
export type HyperionReview = { id: string; fullName: string; rating: number; comment: string };

export const hyperionReviews = {
  rating: 5,
  count: 15,
  reviewUrl: "https://g.page/r/CbbH4Iu7UTmKEAE/review",
  items: [
    {
      id: "arun-c",
      fullName: "Arun Calstas",
      rating: 5,
      comment:
        "Jeune de 23 ans sans aucune solution de prévoyance, je ne savais pas du tout par où commencer pour mon 3ème pilier. Grâce à BM Partners, j'ai non seulement pu mettre en place une stratégie vraiment optimisée pour le long terme, mais j'ai surtout enfin compris le fonctionnement du système de prévoyance suisse, ce qui n'est pas évident au départ. Ils ont pris le temps de tout m'expliquer de manière claire et transparente, en mettant en évidence l'impact énorme que peut avoir un bon choix dès le début. On sent qu'ils maîtrisent parfaitement leur sujet et qu'ils cherchent réellement à proposer la meilleure solution, adaptée à notre situation. Je me sens aujourd'hui beaucoup plus serein pour mon avenir financier et surtout confiant dans les décisions que j'ai prises. Je recommande à 100% pour toute personne qui veut faire les choses intelligemment dès le départ.",
    },
    {
      id: "fanny-c",
      fullName: "Fanny Cappelaere",
      rating: 5,
      comment:
        "Sébastien a su me conseiller avec expertise et sens de la clientèle. Il m'a orienté vers un produit efficace et rentable pour mon 3e pilier. Ouverture de police, transfert de l'ancien pilier vers le nouveau... Tout s'est déroulé d'une façon extrêmement fluide ! Je suis désormais confiante pour l'avenir de mon 3P et ses performances à venir.",
    },
    {
      id: "michael-b",
      fullName: "Michael Blass",
      rating: 5,
      comment:
        "I had the opportunity to be advised by Mr. Bassa regarding my third pillar, and I must say I was truly impressed by his expertise. He quickly understood my needs and was able to recommend the investment solution that suited me perfectly.",
    },
    {
      id: "mehdi-g",
      fullName: "Mehdi Ghadimy",
      rating: 5,
      comment:
        "Grâce aux conseils avisés de Bassa Martin Partners, j'ai pu réaliser des économies significatives sur mon assurance maladie de base en raison de ma bonne santé, ce qui m'a permis de souscrire trois assurances complémentaires pour les voyages, les soins dentaires et un capital hospitalisation couvrant ma franchise de 2500 CHF, tout en mettant en place une stratégie de 3ème pilier prometteuse. L'équipe a entrepris l'intégralité des démarches administratives pour moi, offrant un service clé en main qui a optimisé ma protection sociale et ma prévoyance de manière très professionnelle.",
    },
    {
      id: "pernilla-w",
      fullName: "Pernilla Weisse",
      rating: 5,
      comment:
        "Nous avons reçu une analyse de notre situation. Suite à cela, des recommandations personnalisées pour le couple et de manière individuelle concernant : les assurances, produits d'investissements, etc. C'est à chaque fois un plaisir de faire le rendez-vous, on se sent soutenu, accompagné. C'est une équipe à l'écoute, à qui on fait confiance et qui est disponible donc un réel soulagement au quotidien !",
    },
    {
      id: "larry-f",
      fullName: "Larry Fisherman",
      rating: 5,
      comment:
        "Je suis très satisfait de mon expérience avec Bassa Martin Partners Assurances et Prévoyance. J'avais initialement un schéma de 3b en nantissement qui ne me convenait pas, mais Loïc a su parfaitement analyser ma situation et me proposer des solutions adaptées. Il m'a accompagné avec professionnalisme pour mettre en place un plan nettement plus optimisé, en tenant compte de mes besoins et de mes objectifs. Je recommande vivement leurs services et je suis très content du résultat.",
    },
    {
      id: "didier-m",
      fullName: "Didier Martin",
      rating: 5,
      comment:
        "Service au top ! Analyse complète de mon contrat d'assurance vie avec à la clé la suppression de frais de fractionnement de prime inutiles de plus de 435 CHF par an, que je n'avais jamais remarqués et qu'aucun de mes conseillers n'avait relevés pendant plus de 30 ans ! Ils ont réussi à conserver le fractionnement sans les frais : exceptionnel ! Merci beaucoup ! Explications simples, claires et efficaces. Je recommande à 100% 👍🏼",
    },
    {
      id: "stephanie-c",
      fullName: "Stéphanie Crova",
      rating: 5,
      comment:
        "Sébastien m'a parlé avec conviction des opportunités qui existent et que je ne connaissais pas. J'ai naturellement suivi ces conseils me sentant en confiance et guidée dans mon intérêt. Depuis je lui ai confié mes assurances et me sens accompagnée avec justesse et soutenue dans ce domaine qui n'est pas ma zone d'expertise et où auparavant j'étais moyennement satisfaite. Je le recommande sans hésitation.",
    },
    {
      id: "xavier-t",
      fullName: "Xavier Triscone",
      rating: 5,
      comment:
        "Un grand merci à Loïc Bassa pour son professionnalisme et ses conseils avisés. Il est très à l'écoute, réactif et transparent. C'est un plaisir d'être accompagné par quelqu'un d'aussi compétent et humain. Je recommande vivement ce cabinet à Genève pour toute personne cherchant un suivi de qualité en assurances et prévoyance !",
    },
    {
      id: "oceane-v",
      fullName: "Océane Delphine Vidal Dias",
      rating: 5,
      comment:
        "Sébastien est très professionnel, à l'écoute et très réactif. Il se montre de très bon conseils pour comparer les meilleures solutions par rapport à notre situation personnelle.",
    },
  ] satisfies HyperionReview[],
} as const;
