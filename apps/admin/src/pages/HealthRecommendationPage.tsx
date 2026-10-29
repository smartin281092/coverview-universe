import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  RecommendationApiError,
  type RecommendationRules,
  type RecommendationInput,
  type RecommendationResult,
  type EvidenceCatalog,
} from "@coverview/api-client/health-recommendation";
import {
  evidenceCatalogSchema,
  recommendationInputSchema,
} from "@coverview/contracts/health-recommendation";
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  LoadingState,
} from "@coverview/ui";
import { AdminBoundary } from "../features/users/AdminBoundary";
import { recommendationApi as api } from "../health-recommendation-api";
const fictional: RecommendationInput = {
  profileVersion: 1,
  tariff: {
    year: 2027,
    birthYear: 1990,
    accident: true,
    deductible: 300,
    regionId: "VD-1",
    categories: [],
    insurerIds: [],
    benefitKeys: [],
    offset: 0,
  },
  tariffKnown: { birth: true, locality: false },
  scope: "same_deductible",
  answers: {
    priority: { version: 2, status: "answered", values: ["premium"] },
    access: { version: 2, status: "answered", values: ["any"] },
    obligations: { version: 2, status: "answered", values: ["yes"] },
    professionals: { version: 2, status: "answered", values: ["none"] },
  },
  legacyAnswers: [],
  optIn: true,
  explore: [],
  stop: false,
};
function download(name: string, value: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csv = (value: string | number | null | undefined) =>
  `"${String(value ?? "")
    .replaceAll('"', '""')
    .replace(/^[=+@-]/, "'$&")}"`;
function Configuration({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t } = useTranslation("healthRecommendation"),
    cache = useQueryClient();
  const [portal, setPortal] = useState<HTMLDivElement | null>(null),
    [config, setConfig] = useState<RecommendationRules | null>(null),
    [reason, setReason] = useState("");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [limit, setLimit] = useState(30),
    [selected, setSelected] = useState<string | null>(null),
    [modelId, setModelId] = useState<string | null>(null);
  const [owner, setOwner] = useState(""),
    [caseStatus, setCaseStatus] = useState("open"),
    [note, setNote] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [imported, setImported] = useState<EvidenceCatalog | null>(null),
    [catalogReason, setCatalogReason] = useState(""),
    [catalogIssue, setCatalogIssue] = useState(""),
    [catalogDone, setCatalogDone] = useState<string | null>(null),
    [fileKey, setFileKey] = useState(0),
    // The operation that failed last, so its error shows next to it.
    [failed, setFailed] = useState<string | null>(null);
  const [profile, setProfile] = useState(JSON.stringify(fictional, null, 2)),
    [simulation, setSimulation] = useState<RecommendationResult | null>(null);
  const abort = useRef(new AbortController()),
    keys = useRef(new Map<string, string>());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const root = ["private", identity.user.id, identity.session.id, "health-recommendation"];
  const query = useQuery({
    queryKey: root,
    queryFn: ({ signal }) => api.admin(2027, signal),
    enabled: !blocked,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  useEffect(() => {
    if (query.data) {
      setConfig(query.data.rules.config);
      setReason("");
    }
  }, [query.data]);
  const catalog = query.data?.catalog,
    record = catalog?.cases.find((item) => item.id === selected),
    model = catalog?.models.find((item) => item.id === modelId);
  async function perform(
    name: string,
    body: unknown,
    work: (options: {
      csrfToken: string;
      idempotencyKey: string;
      signal: AbortSignal;
    }) => Promise<unknown>,
  ) {
    if (blocked || pending) return;
    setPending(true);
    setError("");
    setFailed(null);
    setSaved(false);
    if (name !== "catalog") setCatalogDone(null);
    const operation = name + JSON.stringify(body),
      key = keys.current.get(operation) ?? crypto.randomUUID();
    keys.current.set(operation, key);
    try {
      await work({
        csrfToken: identity.csrfToken,
        idempotencyKey: key,
        signal: abort.current.signal,
      });
      if (!abort.current.signal.aborted) {
        if (name !== "simulate" && name !== "loadCatalog") {
          setSaved(true);
          await cache.invalidateQueries({ queryKey: root });
        }
      }
    } catch (cause) {
      if (!abort.current.signal.aborted) {
        setFailed(name);
        setError(
          t(cause instanceof RecommendationApiError && cause.status === 409 ? "conflict" : "error"),
        );
      }
    } finally {
      if (!abort.current.signal.aborted) setPending(false);
    }
  }
  const select = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    values: string[],
  ) => (
    <label className="grid gap-2 text-sm">
      {t(label)}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={t(label)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent portalContainer={portal}>
          {values.map((item) => (
            <SelectItem key={item} value={item}>
              {t(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
  if (blocked) return null;
  if (query.isPending) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return (
      <div role="alert">
        <p>{t("error")}</p>
        <Button onClick={() => void query.refetch()}>{t("retry")}</Button>
      </div>
    );
  const filtered =
    catalog?.models.filter(
      (item) =>
        (status === "all" || item.status === status) &&
        `${item.insurerName} ${item.name} ${item.tariffCode}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    ) ?? [];
  return (
    <div ref={setPortal} className="space-y-10">
      <header>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      {error && failed !== "catalog" && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {saved && failed !== "catalog" && !catalogDone && <p role="status">{t("saved")}</p>}
      {/* Publishing a catalogue first, in one place (user request, 29 October 2026): the file, its
          check right beneath it, a reason of its own and the result next to the button. */}
      <section
        id="catalog-publish"
        className="space-y-4 rounded-xl border p-5"
        aria-labelledby="catalog-publish-title"
      >
        <h2 id="catalog-publish-title" className="text-xl font-medium">
          {t("catalogPublishTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {catalog ? t("catalogCurrent", { id: catalog.id }) : t("noCatalog")}
        </p>
        <p className="text-sm text-muted-foreground">{t("importHint")}</p>
        <label className="grid gap-2 text-sm">
          {t("catalogFile")}
          <Input
            key={fileKey}
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setImported(null);
              setCatalogDone(null);
              setCatalogIssue("");
              if (!file) return;
              if (file.size > 5000000) {
                setCatalogIssue(t("catalogTooLarge"));
                return;
              }
              void file.text().then((value) => {
                let raw: unknown;
                try {
                  raw = JSON.parse(value);
                } catch {
                  setCatalogIssue(t("catalogUnreadable"));
                  return;
                }
                const parsed = evidenceCatalogSchema.safeParse({
                  ...(raw as object),
                  id: `catalog_${crypto.randomUUID()}`,
                });
                if (!parsed.success) {
                  const issue = parsed.error.issues[0];
                  setCatalogIssue(
                    t("catalogInvalid", {
                      detail: `${issue?.path.join(".") || "—"} : ${issue?.message ?? ""}`,
                    }),
                  );
                  return;
                }
                setImported(parsed.data);
              });
            }}
          />
        </label>
        {catalogIssue && (
          <p role="alert" className="text-sm text-destructive">
            {catalogIssue}
          </p>
        )}
        {imported && (
          <>
            <p role="status" className="text-sm font-medium">
              {t("catalogReady", {
                models: imported.models.length,
                benefits: imported.benefits.length,
                cases: imported.cases.length,
                checkedAt: imported.checkedAt,
              })}
            </p>
            <label className="grid gap-2 text-sm">
              {t("catalogReasonLabel")}
              <Input
                value={catalogReason}
                onChange={(event) => setCatalogReason(event.target.value)}
                maxLength={2000}
              />
            </label>
            <Button
              disabled={pending || catalogReason.trim().length < 10}
              onClick={() => {
                const input = {
                  catalog: imported,
                  reason: catalogReason,
                  expectedCatalogId: catalog?.id ?? null,
                };
                void perform("catalog", input, (options) =>
                  api.publishCatalog(input, options).then(() => {
                    setCatalogDone(imported.id);
                    setImported(null);
                    setCatalogReason("");
                    setFileKey((value) => value + 1);
                  }),
                );
              }}
            >
              {pending ? t("loading") : t("publishCatalog")}
            </Button>
          </>
        )}
        {error && failed === "catalog" && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {catalogDone && (
          <p role="status" className="text-sm font-medium text-emerald-700">
            {t("catalogPublished", { id: catalogDone })}
          </p>
        )}
      </section>
      {config && (
        <section className="space-y-5">
          <h2 className="text-xl font-medium">{t("rules")}</h2>
          <form
            className="grid gap-5 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const body = { expectedRevision: query.data.rules.revision, config, reason };
              void perform("publish", body, (options) => api.publish(body, options));
            }}
          >
            {select(
              "activation",
              config.activation,
              (value) =>
                setConfig({ ...config, activation: value as RecommendationRules["activation"] }),
              ["off", "opt_in", "on"],
            )}
            {(Object.keys(config.weights) as (keyof RecommendationRules["weights"])[]).map(
              (key) => (
                <label className="grid gap-2 text-sm" key={key}>
                  {t(key)}
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={config.weights[key]}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        weights: { ...config.weights, [key]: Number(event.target.value) },
                      })
                    }
                  />
                </label>
              ),
            )}
            <label className="grid gap-2 text-sm">
              {t("serviceEvidence")}
              <Select
                value={config.serviceEvidence}
                onValueChange={(value) =>
                  setConfig({
                    ...config,
                    serviceEvidence: value as RecommendationRules["serviceEvidence"],
                  })
                }
              >
                <SelectTrigger aria-label={t("serviceEvidence")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent portalContainer={portal}>
                  <SelectItem value="official">{t("evidenceOfficial")}</SelectItem>
                  <SelectItem value="verified">{t("evidenceVerified")}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {(
              [
                "serviceContributionCap",
                "meaningfulAnnualDifferenceMinor",
                "tieAnnualMinor",
                "researchReviewDays",
              ] as const
            ).map((key) => (
              <label className="grid gap-2 text-sm" key={key}>
                {t(key)}
                <Input
                  type="number"
                  min={key === "serviceContributionCap" || key === "researchReviewDays" ? 1 : 0}
                  max={
                    key === "serviceContributionCap"
                      ? 10
                      : key === "researchReviewDays"
                        ? 365
                        : 100000000
                  }
                  required
                  value={config[key]}
                  onChange={(event) => setConfig({ ...config, [key]: Number(event.target.value) })}
                />
              </label>
            ))}
            <label className="grid gap-2 text-sm md:col-span-2">
              {t("rationale")}
              <textarea
                className="min-h-24 rounded-md border border-input bg-background p-3"
                required
                minLength={10}
                maxLength={4000}
                value={config.rationale}
                onChange={(event) => setConfig({ ...config, rationale: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm md:col-span-2">
              {t("reason")}
              <Input
                required
                minLength={10}
                maxLength={2000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={pending || reason.length < 10}>
              {pending ? t("loading") : t("publish")}
            </Button>
          </form>
          <details>
            <summary className="cursor-pointer py-3">{t("history")}</summary>
            <p className="text-sm text-muted-foreground">{t("historyHint")}</p>
            {query.data.history.map((version) => (
              <article
                className="flex flex-wrap items-center justify-between gap-3 border-b py-4"
                key={version.id}
              >
                <div>
                  <p>
                    {t("revision", { revision: version.revision })}
                    {" · "}
                    {new Date(version.at).toLocaleString("fr-CH")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {version.reason}
                    {" · "}
                    {version.actor}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setConfig(version.config)}>
                  {t("restore")}
                </Button>
              </article>
            ))}
          </details>
        </section>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-medium">{t("simulation")}</h2>
        <p className="text-sm text-muted-foreground">{t("simulationHint")}</p>
        <label className="grid gap-2 text-sm">
          {t("profile")}
          <textarea
            className="h-64 rounded-md border border-input bg-background p-3 font-mono text-xs"
            maxLength={40000}
            value={profile}
            onChange={(event) => setProfile(event.target.value)}
          />
        </label>
        <Button
          disabled={!config || pending}
          onClick={() => {
            try {
              const input = recommendationInputSchema.parse(JSON.parse(profile));
              void perform("simulate", { input, config }, async (options) => {
                const value = await api.simulate(input, config!, options);
                if (!options.signal.aborted) setSimulation(value);
              });
            } catch {
              setError(t("error"));
            }
          }}
        >
          {t("simulate")}
        </Button>
        {simulation && (
          <>
            <p>
              {t("simulationResult", {
                count: simulation.examinedCandidateCount,
                outcome: simulation.outcome,
                scenarios: simulation.examinedScenarios,
              })}
            </p>
            <p>{simulation.nextQuestion?.title}</p>
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["model", "premium", "annual", "compatibility"].map((key) => (
                      <th className="p-3" key={key}>
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {simulation.ranked.slice(0, 15).map((row) => (
                    <tr key={row.offer.id} className="border-b">
                      <td className="p-3">
                        {row.offer.insurerName}
                        {" · "}
                        {row.offer.name}
                        {" · "}
                        {row.offer.deductible}
                      </td>
                      <td>{row.offer.monthlyPremiumMinor}</td>
                      <td>{row.annualInsuranceCareMinor ?? "—"}</td>
                      <td>{row.compatibility}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      {!catalog ? (
        <p>{t("noCatalog")}</p>
      ) : (
        <>
          <section className="space-y-5">
            <h2 className="text-xl font-medium">{t("coverage")}</h2>
            <p>
              {t("coverageCount", {
                models: catalog.models.length,
                insurers: catalog.insurers.length,
                researched: catalog.models.filter((item) => item.status !== "not_researched")
                  .length,
                verified: catalog.models.filter((item) => item.status === "verified").length,
                remaining: catalog.models.filter((item) => item.status === "not_researched").length,
              })}
            </p>
            <p className="text-sm text-muted-foreground">{t("coverageHint")}</p>
            {catalog.benefitTypes.length > 0 && (
              <p className="text-sm">
                {t("taxonomy", {
                  types: catalog.benefitTypes.length,
                  benefits: catalog.benefits.length,
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label={t("search")}
                placeholder={t("search")}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setLimit(30);
                }}
              />
              {select(
                "status",
                status,
                (value) => {
                  setStatus(value);
                  setLimit(30);
                },
                [
                  "all",
                  "not_researched",
                  "researched",
                  "partial",
                  "inaccessible",
                  "verified",
                  "review",
                ],
              )}
            </div>
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["company", "model", "regions", "status", "details"].map((key) => (
                      <th className="p-3" key={key}>
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((item) => (
                    <tr className="border-b" key={item.id}>
                      <td className="p-3">
                        {item.insurerName}
                        {" · "}
                        {item.insurerId}
                      </td>
                      <td className="p-3">
                        {item.name}
                        {" · "}
                        {item.tariffCode}
                      </td>
                      <td className="max-w-48 p-3 text-xs">{item.regions.join(", ")}</td>
                      <td>{t(item.status)}</td>
                      <td>
                        <Button variant="ghost" onClick={() => setModelId(item.id)}>
                          {t("details")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > limit && (
              <Button variant="outline" onClick={() => setLimit((value) => value + 30)}>
                {t("continue")}
              </Button>
            )}
          </section>
          <section className="space-y-5">
            <h2 className="text-xl font-medium">
              {t("queue")}
              {" ("}
              {catalog.cases.filter((item) => item.status !== "resolved").length}
              {")"}
            </h2>
            <div className="max-h-[38rem] overflow-auto">
              {[...catalog.cases]
                .sort(
                  (a, b) =>
                    ["blocking", "important", "secondary"].indexOf(a.priority) -
                    ["blocking", "important", "secondary"].indexOf(b.priority),
                )
                .map((item) => (
                  <article
                    className="flex flex-wrap items-center justify-between gap-3 border-b py-4"
                    key={item.id}
                  >
                    <div>
                      <strong className="font-medium">
                        {item.insurerName}
                        {" · "}
                        {item.modelNames.join(", ")}
                      </strong>
                      <p className="text-sm">
                        {item.rule}
                        {" · "}
                        {item.year}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(item.priority)}
                        {" · "}
                        {t(item.status)}
                        {" · "}
                        {item.owner ?? "—"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelected(item.id);
                        setOwner(item.owner ?? "");
                        setCaseStatus(item.status);
                        setNote("");
                      }}
                    >
                      {t("inspect")}
                    </Button>
                  </article>
                ))}
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="text-xl font-medium">{t("catalog")}</h2>
            <p className="text-xs break-all">{t("catalogVersion", { id: catalog.id })}</p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  download(`catalogue-${catalog.year}.json`, JSON.stringify(catalog, null, 2))
                }
              >
                {t("catalogExport")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  download(`controles-${catalog.year}.json`, JSON.stringify(catalog.cases, null, 2))
                }
              >
                {t("reviewExport")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    `couverture-${catalog.year}.csv`,
                    [
                      [
                        "assureur_id",
                        "compagnie",
                        "modele_id",
                        "modele",
                        "annee",
                        "regions",
                        "statut",
                        "sources",
                      ],
                      ...catalog.models.map((item) => [
                        item.insurerId,
                        item.insurerName,
                        item.id,
                        item.name,
                        item.year,
                        item.regions.join(";"),
                        item.status,
                        item.sourceIds.join(";"),
                      ]),
                    ]
                      .map((row) => row.map(csv).join(","))
                      .join("\r\n"),
                    "text/csv;charset=utf-8",
                  )
                }
              >
                {t("coverageExport")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    `rapport-operateur-${catalog.year}.md`,
                    catalog.cases
                      .map(
                        (item) =>
                          `## ${item.insurerName} · ${item.modelNames.join(", ")}\n\n${item.year} · ${item.priority} · ${item.status} · ${item.owner ?? "—"}\n\n${item.confirmed}\n\n${item.missing}\n\n${item.question}\n\n${item.provisionalTreatment}\n\n${item.sourceIds
                            .map((id) => {
                              const source = catalog.sources.find((s) => s.id === id);
                              return source ? `${source.url} — ${source.passage}` : id;
                            })
                            .join("\n\n")}`,
                      )
                      .join("\n\n"),
                    "text/markdown;charset=utf-8",
                  )
                }
              >
                {t("reportExport")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("reviewDue", {
                count: query.data.reviewDue.sourceIds.length,
                date: query.data.reviewDue.nextAt ?? "—",
              })}
            </p>
            <details>
              <summary className="cursor-pointer py-3">{t("catalogHistory")}</summary>
              <p className="text-sm text-muted-foreground">{t("historyHint")}</p>
              {query.data.catalogHistory.map((version) => (
                <div
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
                >
                  <div className="min-w-0 text-sm">
                    <p className="break-all">{version.id}</p>
                    <p>
                      {new Date(version.at).toLocaleString("fr-CH")}
                      {" · "}
                      {version.reason}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      void perform("loadCatalog", version.id, async (options) => {
                        const previous = await api.catalogVersion(version.id, options.signal);
                        if (!options.signal.aborted) {
                          setImported({ ...previous, id: `catalog_${crypto.randomUUID()}` });
                          setCatalogReason(t("rollbackReason", { id: version.id }));
                          setCatalogIssue("");
                          setCatalogDone(null);
                          document
                            .getElementById("catalog-publish")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      })
                    }
                  >
                    {t("prepareRestore")}
                  </Button>
                </div>
              ))}
            </details>
          </section>
        </>
      )}
      <Sheet
        open={!!record || !!model}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setSelected(null);
            setModelId(null);
          }
        }}
      >
        <SheetContent
          portalContainer={portal}
          className="overflow-y-auto sm:max-w-2xl"
          closeLabel={t("close")}
        >
          <SheetHeader>
            <SheetTitle>
              {record
                ? `${record.insurerName} · ${record.modelNames.join(", ")}`
                : `${model?.insurerName ?? ""} · ${model?.name ?? ""}`}
            </SheetTitle>
            <SheetDescription>{record?.id ?? model?.id}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 p-6">
            {["confirmed", "missing"].map((key) => (
              <section key={key}>
                <h3 className="font-medium">{t(key)}</h3>
                <p className="text-sm">
                  {key === "confirmed"
                    ? (record?.confirmed ?? model?.confirmed)
                    : (record?.missing ?? model?.missing)}
                </p>
              </section>
            ))}
            {record && (
              <>
                {["question", "impact", "provisionalTreatment", "action"].map((key) => (
                  <section key={key}>
                    <h3>{t(key === "provisionalTreatment" ? "provisional" : key)}</h3>
                    <p className="text-sm">
                      {record[key as "question" | "impact" | "provisionalTreatment" | "action"]}
                    </p>
                  </section>
                ))}
                <label className="grid gap-2 text-sm">
                  {t("owner")}
                  <Input
                    maxLength={200}
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                  />
                </label>
                {select("status", caseStatus, setCaseStatus, [
                  "open",
                  "in_review",
                  "resolved",
                  "deferred",
                ])}
                <label className="grid gap-2 text-sm">
                  {t("note")}
                  <textarea
                    className="min-h-24 rounded-md border p-3"
                    maxLength={3000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <Button
                  disabled={pending || note.length < 5}
                  onClick={() => {
                    const input = {
                      expectedRevision: record.revision,
                      status: caseStatus as typeof record.status,
                      owner: owner || null,
                      note,
                    };
                    void perform("review", { id: record.id, input }, (options) =>
                      api.review(catalog!.id, record.id, input, options),
                    );
                  }}
                >
                  {t("update")}
                </Button>
                <h3>{t("audit")}</h3>
                {record.history.map((event, index) => (
                  <p className="text-xs" key={index}>
                    {event.at}
                    {" · "}
                    {event.actor}
                    {" · "}
                    {event.action}
                    {" · "}
                    {event.note}
                  </p>
                ))}
              </>
            )}
            <h3>{t("sources")}</h3>
            {(record?.sourceIds ?? model?.sourceIds ?? []).map((id) => {
              const source = catalog?.sources.find((item) => item.id === id);
              return (
                source && (
                  <article className="space-y-2 border-t pt-3 text-sm" key={id}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                      {source.title}
                      {" ↗"}
                    </a>
                    <p>{source.passage}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.page ? `p. ${source.page} · ` : ""}
                      {source.quality}
                      {" · "}
                      {source.checkedAt}
                    </p>
                  </article>
                )
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
export function HealthRecommendationPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Configuration identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
