import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CircleCheck, LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import type {
  InsurancePreviousContractInput,
  InsuranceRequest,
} from "@coverview/contracts/insurance-requests";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@coverview/ui";
import { api } from "../../api";
import { insuranceApi } from "../../insurance-api";
import { IdentityAttachmentPicker } from "../authorizations/IdentityAttachmentPicker";
import { DocumentUpload } from "../documents/DocumentUpload";

type Item = InsuranceRequest["items"][number];
const handled = ["submitted", "reviewing", "insurer_contacted", "offer_ready"];
const attachmentKey = (identity: IdentityMe, profileId: string) => [
  "private",
  identity.user.id,
  identity.session.id,
  "identity-attachment",
  profileId,
];

// What CoverView still needs from each person of a comparator request (20 October 2026): an
// identity document on the person's profile, and the previous year's health contract or the
// statement of having none. Only the persons whose profile this account owns are listed.
export function RequestChecklist({
  identity,
  request,
  onChange,
}: {
  identity: IdentityMe;
  request: InsuranceRequest;
  onChange: (request: InsuranceRequest) => void;
}) {
  const { t } = useTranslation("insuranceRequests");
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const people = request.items.filter(
    (item): item is Item & { profileId: string } => !!item.profileId,
  );
  const first = people[0]?.profileId;
  // Shared with the first person's own query: one request tells whether documents are open here.
  const probe = useQuery({
    queryKey: attachmentKey(identity, first ?? ""),
    queryFn: ({ signal }) => api.identityAttachment({ signal }, { profileId: first! }),
    enabled: !!first && handled.includes(request.state),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  if (!handled.includes(request.state) || !people.length) return null;
  const closed = probe.error instanceof ApiError && probe.error.code === "PLATFORM_NOT_FOUND";
  return (
    <section aria-label={t("checklist.label")} className="space-y-4">
      <div ref={setPortalContainer} className="contents" />
      {people.map((item) => (
        <Person
          key={item.id}
          identity={identity}
          request={request}
          item={item}
          profileId={item.profileId}
          named={people.length > 1}
          closed={closed}
          portalContainer={portalContainer}
          onChange={onChange}
        />
      ))}
      {closed && <p className="text-sm text-muted-foreground">{t("checklist.documentsClosed")}</p>}
    </section>
  );
}

function Person({
  identity,
  request,
  item,
  profileId,
  named,
  closed,
  portalContainer,
  onChange,
}: {
  identity: IdentityMe;
  request: InsuranceRequest;
  item: Item;
  profileId: string;
  named: boolean;
  closed: boolean;
  portalContainer: HTMLDivElement | null;
  onChange: (request: InsuranceRequest) => void;
}) {
  const { t } = useTranslation("insuranceRequests");
  const client = useQueryClient();
  const [picker, setPicker] = useState(false);
  const [upload, setUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const year = request.year - 1;
  const name = `${item.firstName} ${item.lastName}`;
  const attachment = useQuery({
    queryKey: attachmentKey(identity, profileId),
    queryFn: ({ signal }) => api.identityAttachment({ signal }, { profileId }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 5000 : false),
  });
  const save = useMutation({
    mutationFn: async (input: InsurancePreviousContractInput) => {
      const { csrfToken } = await insuranceApi.browser();
      return insuranceApi.previousContract(request.id, input, {
        csrfToken,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: (result) => {
      onChange(result);
      setUpload(false);
    },
    retry: false,
  });
  const answer = request.previousContracts.find((entry) => entry.personId === item.id);
  const status = attachment.data?.status ?? "missing";
  const failure = save.isError && (
    <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
      {t("checklist.contract.error")}
      {save.variables && (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0"
          onClick={() => save.mutate(save.variables)}
        >
          {t("retry")}
        </Button>
      )}
    </p>
  );
  return (
    <div className="space-y-2">
      {named && <p className="text-sm font-medium">{name}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!attachment.data || !portalContainer}
          onClick={() => setPicker(true)}
        >
          {status === "ready" ? (
            <CircleCheck className="text-green-600" aria-hidden="true" />
          ) : status === "processing" ? (
            <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" />
          ) : status === "missing" ? (
            <Plus aria-hidden="true" />
          ) : (
            <TriangleAlert className="text-amber-600" aria-hidden="true" />
          )}
          {t(`checklist.identity.${status}`)}
        </Button>
        {answer ? (
          <>
            {answer.kind === "document" ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/documents/$documentId" params={{ documentId: answer.documentId }}>
                  <CircleCheck className="text-green-600" aria-hidden="true" />
                  {t("checklist.contract.provided", { year })}
                </Link>
              </Button>
            ) : (
              <span className="inline-flex min-h-8 items-center gap-2 px-3 text-xs/relaxed font-medium">
                <CircleCheck className="size-3 text-green-600" aria-hidden="true" />
                {t("checklist.contract.declaredNone", { year })}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="font-semibold text-indigo-600"
              disabled={save.isPending}
              onClick={() => save.mutate({ personId: item.id, kind: "unset" })}
            >
              {t("checklist.contract.change")}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={closed || attachment.isPending || !portalContainer || save.isPending}
              onClick={() => setUpload(true)}
            >
              <Plus aria-hidden="true" />
              {t("checklist.contract.add", { year })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="font-semibold text-indigo-600"
              disabled={save.isPending}
              onClick={() => save.mutate({ personId: item.id, kind: "none" })}
            >
              {t("checklist.contract.none", { year })}
            </Button>
          </>
        )}
      </div>
      {attachment.isError && !closed && (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          {t("checklist.identity.error")}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => void attachment.refetch()}
          >
            {t("retry")}
          </Button>
        </p>
      )}
      {!upload && failure}
      <Sheet
        open={upload && !!portalContainer}
        onOpenChange={(value) => {
          if (!uploading && !save.isPending) setUpload(value);
        }}
      >
        <SheetContent
          portalContainer={portalContainer}
          className="overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[side=right]:w-full sm:max-w-lg"
          showCloseButton
          closeLabel={t("checklist.close")}
        >
          <SheetHeader className="mb-8 p-0 text-left">
            <SheetTitle>{t("checklist.contract.uploadTitle", { year })}</SheetTitle>
            <SheetDescription>
              {t("checklist.contract.uploadDescription", { year, name })}
            </SheetDescription>
          </SheetHeader>
          {upload && (
            <div className="space-y-4">
              <DocumentUpload
                identity={identity}
                portalContainer={portalContainer}
                targetProfileId={profileId}
                onBusyChange={setUploading}
                onDone={(document) => {
                  setUploading(false);
                  save.mutate({ personId: item.id, kind: "document", documentId: document.id });
                }}
              />
              {save.isPending && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t("checklist.contract.saving")}
                </p>
              )}
              {failure}
            </div>
          )}
        </SheetContent>
      </Sheet>
      {picker && attachment.data && (
        <IdentityAttachmentPicker
          identity={identity}
          attachment={attachment.data}
          portalContainer={portalContainer}
          onClose={() => setPicker(false)}
          onSaved={(result) => {
            client.setQueryData(attachmentKey(identity, profileId), result);
            setPicker(false);
          }}
          onRefresh={async () => {
            const result = await attachment.refetch({ throwOnError: true });
            if (!result.data) throw new Error("Identity attachment unavailable");
            return result.data;
          }}
        />
      )}
    </div>
  );
}
