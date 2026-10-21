import { describe, expect, it } from "vitest";
import { ownerOnlyAcl } from "./file-storage.js";

const owner = { ID: "owner-id" };
const minioStub = {
  Owner: { ID: "" },
  Grants: [{ Permission: "FULL_CONTROL" as const, Grantee: { Type: "CanonicalUser" as const } }],
};

describe("document bucket ACL", () => {
  it("accepts a provider ACL granting its owner only", () => {
    const acl = {
      Owner: owner,
      Grants: [
        {
          Permission: "FULL_CONTROL" as const,
          Grantee: { Type: "CanonicalUser" as const, ...owner },
        },
      ],
    };
    expect(ownerOnlyAcl(acl, false)).toBe(true);
    expect(ownerOnlyAcl(acl, true)).toBe(true);
  });

  it("refuses public or foreign grants, even for a declared MinIO", () => {
    for (const grant of [
      {
        Permission: "READ" as const,
        Grantee: { Type: "Group" as const, URI: "http://acs.amazonaws.com/groups/global/AllUsers" },
      },
      { Permission: "READ" as const, Grantee: { Type: "CanonicalUser" as const, ID: "other" } },
    ]) {
      const acl = {
        Owner: owner,
        Grants: [
          {
            Permission: "FULL_CONTROL" as const,
            Grantee: { Type: "CanonicalUser" as const, ...owner },
          },
          grant,
        ],
      };
      expect(ownerOnlyAcl(acl, false)).toBe(false);
      expect(ownerOnlyAcl(acl, true)).toBe(false);
    }
  });

  it("accepts the MinIO stub only when MinIO is declared", () => {
    expect(ownerOnlyAcl(minioStub, true)).toBe(true);
    expect(ownerOnlyAcl(minioStub, false)).toBe(false);
    expect(
      ownerOnlyAcl(
        {
          ...minioStub,
          Grants: [
            ...minioStub.Grants,
            { Permission: "READ" as const, Grantee: { Type: "Group" as const } },
          ],
        },
        true,
      ),
    ).toBe(false);
    expect(ownerOnlyAcl({ Grants: minioStub.Grants }, true)).toBe(false);
  });
});
