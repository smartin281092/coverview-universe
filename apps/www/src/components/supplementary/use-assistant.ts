import { useCallback, useEffect, useRef, useState } from "react";
import type { SupplementaryAssistantResult } from "@coverview/api-client/supplementary-insurance";
import { effectiveProfile, type Profile } from "./supplementary-model";
import type { SupplementaryApi } from "./use-supplementary";

type Query = { message: string; answers: Record<string, string> };

/**
 * The assistant reads the need, ranks the database's products and asks a question only when its
 * answer would change the result. A profile changed afterwards by the visitor reruns the same
 * query; a profile the assistant used (answers, age read in the text) becomes the page's.
 */
export function useAssistant(
  api: SupplementaryApi,
  profile: Profile,
  onProfile: (profile: Profile) => void,
) {
  const [query, setQuery] = useState<Query | null>(null);
  const [result, setResult] = useState<SupplementaryAssistantResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState(0);
  const synced = useRef<string | null>(null);
  // Values the page took from the assistant (an age read in the text, an answer): sent back as
  // unknown, so that a later answer can still change them.
  const adopted = useRef<Partial<Profile>>({});
  const profileRef = useRef(profile);
  const onProfileRef = useRef(onProfile);
  profileRef.current = profile;
  onProfileRef.current = onProfile;
  const signature = JSON.stringify(profile);
  const active = query !== null;
  useEffect(() => {
    if (active && synced.current !== signature) setRun((value) => value + 1);
  }, [signature, active]);
  useEffect(() => {
    if (!query) return;
    const abort = new AbortController();
    const current = profileRef.current;
    setBusy(true);
    setFailed(false);
    api
      .assistant(
        {
          message: query.message,
          profile: {
            birthYear: current.birthYear === adopted.current.birthYear ? null : current.birthYear,
            sex: current.sex === adopted.current.sex ? null : current.sex,
            canton: current.canton === adopted.current.canton ? null : current.canton,
          },
          answers: query.answers,
        },
        abort.signal,
      )
      .then((value) => {
        if (abort.signal.aborted) return;
        setResult(value);
        const effective = effectiveProfile(current);
        const next: Profile = {
          birthYear:
            value.profile.birthYear !== effective.birthYear
              ? value.profile.birthYear
              : current.birthYear,
          sex: value.profile.sex !== effective.sex ? value.profile.sex : current.sex,
          canton: value.profile.canton !== effective.canton ? value.profile.canton : current.canton,
        };
        if (next.birthYear !== current.birthYear) adopted.current.birthYear = next.birthYear;
        if (next.sex !== current.sex) adopted.current.sex = next.sex;
        if (next.canton !== current.canton) adopted.current.canton = next.canton;
        const key = JSON.stringify(next);
        synced.current = key;
        if (key !== JSON.stringify(current)) onProfileRef.current(next);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [api, query, run]);
  const ask = useCallback((message: string) => {
    synced.current = JSON.stringify(profileRef.current);
    adopted.current = {};
    setResult(null);
    setQuery({ message, answers: {} });
  }, []);
  const answer = useCallback((id: string, value: string) => {
    setQuery((current) =>
      current ? { ...current, answers: { ...current.answers, [id]: value } } : current,
    );
  }, []);
  const clear = useCallback(() => {
    setQuery(null);
    setResult(null);
    setFailed(false);
    setBusy(false);
  }, []);
  return {
    query,
    result: query ? result : null,
    busy,
    failed,
    ask,
    answer,
    clear,
    retry: () => setRun((value) => value + 1),
  };
}
