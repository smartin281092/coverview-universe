import { z } from "zod";
import {
  communicationPreferencesInputSchema,
  communicationRecordInputSchema,
  communicationsSchema,
  recordingRequestInputSchema,
  recordingDecisionInputSchema,
  recordingSchema,
  transcriptInputSchema,
  transcriptActionInputSchema,
} from "@coverview/contracts/partner-communications";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
export function createCommunicationClient(request: PartnerRequest) {
  const id = encodeURIComponent,
    root = (wallet: boolean) => (wallet ? "/wallet" : "/partner");
  return {
    communications: (
      leadId: string,
      query: { recordsCursor?: string; recordingsCursor?: string },
      wallet = false,
      signal?: AbortSignal,
    ) =>
      request(
        `${root(wallet)}/leads/${id(leadId)}/communications?${new URLSearchParams(query)}`,
        communicationsSchema,
        signal,
      ),
    recording: (
      recordingId: string,
      wallet = false,
      beforeRevision?: number,
      signal?: AbortSignal,
    ) =>
      request(
        `${root(wallet)}/recordings/${id(recordingId)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        recordingSchema,
        signal,
      ),
    updateCommunicationPreferences: (
      leadId: string,
      input: z.infer<typeof communicationPreferencesInputSchema>,
      o: PartnerMutation,
    ) =>
      request(
        `/wallet/leads/${id(leadId)}/communications/preferences`,
        communicationsSchema,
        o.signal,
        communicationPreferencesInputSchema.parse(input),
        o,
      ),
    recordCommunication: (
      leadId: string,
      input: z.infer<typeof communicationRecordInputSchema>,
      o: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${id(leadId)}/communications`,
        communicationsSchema,
        o.signal,
        communicationRecordInputSchema.parse(input),
        o,
      ),
    requestRecording: (
      leadId: string,
      input: z.infer<typeof recordingRequestInputSchema>,
      o: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${id(leadId)}/recordings`,
        recordingSchema,
        o.signal,
        recordingRequestInputSchema.parse(input),
        o,
      ),
    decideRecording: (
      recordingId: string,
      input: z.infer<typeof recordingDecisionInputSchema>,
      o: PartnerMutation,
    ) =>
      request(
        `/wallet/recordings/${id(recordingId)}/decisions`,
        recordingSchema,
        o.signal,
        recordingDecisionInputSchema.parse(input),
        o,
      ),
    saveTranscript: (
      recordingId: string,
      input: z.infer<typeof transcriptInputSchema>,
      o: PartnerMutation,
    ) =>
      request(
        `/partner/recordings/${id(recordingId)}/transcripts`,
        recordingSchema,
        o.signal,
        transcriptInputSchema.parse(input),
        o,
      ),
    createTranscriptTask: (
      recordingId: string,
      input: z.infer<typeof transcriptActionInputSchema>,
      o: PartnerMutation,
    ) =>
      request(
        `/partner/recordings/${id(recordingId)}/tasks`,
        recordingSchema,
        o.signal,
        transcriptActionInputSchema.parse(input),
        o,
      ),
  };
}
