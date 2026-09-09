import { DocumentError } from "./document.errors.js";

// Explicit correction input, not a natural-language instruction interpreter.
// The caller validates these values against the target profile schema before saving.
export function actionResponseValues(topic: string, response: string): Record<string, string> {
  const value = response.trim();
  const invalid = () => new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
  if (!value) throw invalid();
  if (topic === "address") {
    const parts = value.split(/[,;\n]+/u).map((part) => part.trim());
    if (parts.some((part) => !part)) throw invalid();
    if (parts.length === 4) {
      const [street, postalCode, city, country] = parts;
      return { street: street!, postalCode: postalCode!, city: city!, country: country! };
    }
    if (parts.length === 3) {
      const locality = /^(\d{3,10}|[A-Z]{2}-\d{3,10})\s+(.+)$/u.exec(parts[1]!);
      if (locality)
        return {
          street: parts[0]!,
          postalCode: locality[1]!,
          city: locality[2]!,
          country: parts[2]!,
        };
    }
    throw invalid();
  }
  if (topic === "birthDate") {
    const date = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/u.exec(value);
    if (date)
      return { birthDate: `${date[3]}-${date[2]!.padStart(2, "0")}-${date[1]!.padStart(2, "0")}` };
  }
  return { [topic]: value };
}
