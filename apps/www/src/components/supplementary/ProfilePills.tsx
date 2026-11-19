import {
  supplementaryCantons,
  type SupplementaryCanton,
  type SupplementaryCatalog,
} from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { interpolate, type Profile } from "./supplementary-model";

export type ProfileSetting = "birth" | "sex" | "canton";
const years = Array.from({ length: 2026 - 1927 + 1 }, (_, index) => 2026 - index);

// Opens a profile setting from elsewhere (an assistant's assumption): focus, then the list.
export function openProfileSetting(prefix: string, setting: ProfileSetting) {
  const select = document.getElementById(`${prefix}-${setting}`);
  if (!(select instanceof HTMLSelectElement)) return;
  select.scrollIntoView({ block: "center", behavior: "smooth" });
  select.focus({ preventScroll: true });
  try {
    select.showPicker();
  } catch {
    // Without showPicker (or without a user gesture), the focused select is enough.
  }
}

/**
 * The price profile as pills (native selects: keyboard, screen readers and phone pickers come
 * with them). Without a choice, the default is named as such.
 */
export function ProfilePills({
  prefix,
  profile,
  onChange,
  localities,
  tone = "dark",
  title = true,
}: {
  prefix: string;
  profile: Profile;
  onChange: (profile: Profile) => void;
  localities: SupplementaryCatalog["localities"] | undefined;
  tone?: "dark" | "light";
  title?: boolean;
}) {
  const locality = (canton: SupplementaryCanton) =>
    localities?.find((item) => item.canton === canton)?.locality ?? copy.profile.cantons[canton];
  return (
    <div className={`sc-profile is-${tone}`} role="group" aria-label={copy.profile.title}>
      {title && <span className="sc-profile-title">{copy.profile.title}</span>}
      <div className="sc-profile-pills">
        <label className="sc-pill">
          <span className="sc-pill-label">{copy.profile.birthYearShort}</span>
          <select
            id={`${prefix}-birth`}
            aria-label={copy.profile.birthYear}
            value={profile.birthYear ?? ""}
            onChange={(event) =>
              onChange({
                ...profile,
                birthYear: event.target.value ? Number(event.target.value) : null,
              })
            }
          >
            <option value="">{copy.profile.birthYearDefault}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="sc-pill">
          <span className="sc-pill-label">{copy.profile.sex}</span>
          <select
            id={`${prefix}-sex`}
            aria-label={copy.profile.sex}
            value={profile.sex ?? ""}
            onChange={(event) =>
              onChange({
                ...profile,
                sex:
                  event.target.value === "female" || event.target.value === "male"
                    ? event.target.value
                    : null,
              })
            }
          >
            <option value="">{copy.profile.sexUnset}</option>
            <option value="female">{copy.profile.sexOptions.female}</option>
            <option value="male">{copy.profile.sexOptions.male}</option>
          </select>
        </label>
        <label className="sc-pill">
          <span className="sc-pill-label">{copy.profile.canton}</span>
          <select
            id={`${prefix}-canton`}
            aria-label={copy.profile.canton}
            value={profile.canton ?? ""}
            onChange={(event) =>
              onChange({
                ...profile,
                canton: supplementaryCantons.find((item) => item === event.target.value) ?? null,
              })
            }
          >
            <option value="">{copy.profile.cantonDefault}</option>
            {supplementaryCantons.map((canton) => (
              <option key={canton} value={canton}>
                {interpolate(copy.profile.cantonOption, {
                  canton: copy.profile.cantons[canton],
                  locality: locality(canton),
                })}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
