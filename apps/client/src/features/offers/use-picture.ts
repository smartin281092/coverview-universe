import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// A picture the API serves as an attachment (C8c): fetched with the session, then typed with the
// MIME type the profile states, and released when no longer shown.
export function usePictureUrl(
  queryKey: readonly unknown[],
  load: (signal: AbortSignal) => Promise<Blob>,
  mime: string | null,
) {
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => load(signal),
    enabled: !!mime,
    gcTime: 0,
    retry: false,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!query.data || !mime) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(new Blob([query.data], { type: mime }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data, mime]);
  return url;
}
