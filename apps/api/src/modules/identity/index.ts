export { registerIdentity } from "./identity.routes.js";
export { IdentityError } from "./identity.security.js";
export type { IdentityService } from "./identity.service.js";
export { identityUsers } from "./identity.schema.js";
export {
  lockProfileOwner,
  toProfile,
  confirmDocumentProfileFields,
  lockDocumentProfile,
  readDocumentProfile,
  enrichDocumentProfile,
} from "./identity.profile.repository.js";
