import { describe, expect, it } from "vitest";

import { previewKind, previewPathFromUrl, UntrustedPreviewError } from "@/features/files/protected-preview";
import { availableMembershipActions, CONFIRMED_ACTIONS, isWhatsappUrl, membersListPath, membershipRequest, whatsappUrlRule } from "@/features/groups/group-rules";
import { validateForm } from "@/features/resources/form-schema";
import { formSpecsFor, policyAllows, RESOURCE_FORM_POLICIES } from "@/features/resources/resource-form-policy";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import type { ResourceDefinition } from "@/contracts/types";
import { messages } from "@/i18n/messages";
import { DOCUMENT_POLICY, LIBRARY_POLICY, validateUpload } from "@/lib/uploads";
import { formatFileSize } from "@/lib/utils";

const MB = 1024 * 1024;
const pdf = (size = 1024, name = "notes.pdf") => new File([new Uint8Array(size)], name, { type: "application/pdf" });

describe("groups policy and form", () => {
  const policy = RESOURCE_FORM_POLICIES.groups!;
  const definition = RESOURCE_DEFINITIONS.groups as ResourceDefinition;

  it("is writable under groups.manage, archives instead of deleting, and covers every contract-required field", () => {
    expect(policy.capability).toBe("groups.manage");
    expect(policyAllows(policy, "create")).toBe(true);
    expect(policyAllows(policy, "edit")).toBe(true);
    expect(policyAllows(policy, "delete")).toBe(false);
    const required = definition.fields.filter((field) => field.required && !field.readOnly).map((field) => field.name);
    for (const name of required) expect(policy.allowedCreateFields, name).toContain(name);
  });

  it("keeps the WhatsApp write-only fields out of the group form (they have their own capability-gated endpoint)", () => {
    expect(policy.allowedCreateFields.some((name) => name.startsWith("whatsapp"))).toBe(false);
  });

  it("builds relation selects for the academic hierarchy, a select for posting permission and an image upload", () => {
    const specs = Object.fromEntries(formSpecsFor("groups", "create").map((spec) => [spec.name, spec]));
    for (const name of ["university", "faculty", "major", "academic_year", "semester", "subject"]) expect(specs[name]?.kind, name).toBe("relation");
    expect(specs.university?.required).toBe(true);
    expect(specs.faculty?.required).toBe(false);
    expect(specs.send_messages_permission?.kind).toBe("select");
    expect(specs.send_messages_permission?.options).toEqual(["all_members", "admins_only"]);
    expect(specs.image?.kind).toBe("file");
    expect(specs.requires_approval?.defaultValue).toBe(true);
  });

  it("requires name and university and sends typed ids", () => {
    const specs = formSpecsFor("groups", "create");
    const empty = validateForm(specs, {}, "create");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(Object.keys(empty.errors).sort()).toEqual(["name", "send_messages_permission", "university"]);
    const ok = validateForm(specs, { name: "Year 1 CS", university: "3", faculty: "5", requires_approval: true, send_messages_permission: "admins_only", is_active: true }, "create");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.payload).toMatchObject({ name: "Year 1 CS", university: 3, faculty: 5, requires_approval: true, send_messages_permission: "admins_only", is_active: true });
  });
});

describe("files policy and form", () => {
  const policy = RESOURCE_FORM_POLICIES.files!;

  it("is writable under files.manage and soft-deletable", () => {
    expect(policy.capability).toBe("files.manage");
    expect(policyAllows(policy, "create")).toBe(true);
    expect(policyAllows(policy, "delete")).toBe(true);
    expect(policy.allowedCreateFields).toEqual(expect.arrayContaining(["title", "file", "visibility", "group", "is_printable", "is_active"]));
  });

  it("requires the file on create but lets an edit keep the stored one", () => {
    const create = validateForm(formSpecsFor("files", "create"), { title: "Lecture 1", visibility: "public" }, "create", policy.crossRules);
    expect(create.ok).toBe(false);
    if (!create.ok) expect(create.errors.file).toBe("validation.required");
    const edit = validateForm(formSpecsFor("files", "edit"), { title: "Lecture 1", visibility: "public" }, "edit", policy.crossRules);
    expect(edit.ok).toBe(true);
    const withFile = validateForm(formSpecsFor("files", "create"), { title: "Lecture 1", visibility: "public", file: pdf() }, "create", policy.crossRules);
    expect(withFile.ok).toBe(true);
    if (withFile.ok) expect(withFile.payload.file).toBeInstanceOf(File);
  });

  it("mirrors the backend scope rules: group-only needs a group, major-only needs a major and an academic year", () => {
    const specs = formSpecsFor("files", "create");
    const base = { title: "T", file: pdf() };
    const groupOnly = validateForm(specs, { ...base, visibility: "group_only" }, "create", policy.crossRules);
    expect(groupOnly.ok).toBe(false);
    if (!groupOnly.ok) expect(groupOnly.errors.group).toBe("validation.groupRequired");
    expect(validateForm(specs, { ...base, visibility: "group_only", group: "4" }, "create", policy.crossRules).ok).toBe(true);
    const majorOnly = validateForm(specs, { ...base, visibility: "major_only" }, "create", policy.crossRules);
    if (!majorOnly.ok) expect(majorOnly.errors.major).toBe("validation.majorRequired");
    const noYear = validateForm(specs, { ...base, visibility: "major_only", major: "2" }, "create", policy.crossRules);
    if (!noYear.ok) expect(noYear.errors.academic_year).toBe("validation.academicYearRequired");
    expect(validateForm(specs, { ...base, visibility: "major_only", major: "2", academic_year: "1" }, "create", policy.crossRules).ok).toBe(true);
  });

  it("offers every backend visibility with a localized label", () => {
    const visibility = formSpecsFor("files", "create").find((spec) => spec.name === "visibility");
    expect(visibility?.options).toEqual(["public", "students_only", "verified_students_only", "major_only", "group_only", "admin_only"]);
    for (const option of visibility?.options ?? []) {
      expect(`enum.${option}` in messages.ar, option).toBe(true);
      expect(`enum.${option}` in messages.en, option).toBe(true);
    }
  });
});

describe("library upload validation", () => {
  it("uses the backend document policy (PDF and images up to 25 MB)", () => {
    expect(LIBRARY_POLICY).toBe(DOCUMENT_POLICY);
    expect(validateUpload(pdf(12 * MB, "big.pdf"), LIBRARY_POLICY)).toBeNull();
    expect(validateUpload({ name: "x.pdf", size: 26 * MB, type: "application/pdf" }, LIBRARY_POLICY)).toBe("size");
    expect(validateUpload({ name: "x.exe", size: 10, type: "application/x-msdownload" }, LIBRARY_POLICY)).toBe("type");
    expect(validateUpload({ name: "x.docx", size: 10, type: "" }, LIBRARY_POLICY)).toBe("type");
    expect(validateUpload({ name: "x.pdf", size: 0, type: "application/pdf" }, LIBRARY_POLICY)).toBe("empty");
  });

  it("formats sizes for the table", () => {
    expect(formatFileSize(512, "en")).toBe("512 B");
    expect(formatFileSize(2048, "en")).toBe("2.0 KB");
    expect(formatFileSize(12 * MB, "en")).toBe("12.0 MB");
    expect(formatFileSize(3 * 1024 * MB, "en")).toBe("3.0 GB");
    expect(formatFileSize(null, "en")).toBe("0 B");
    expect(formatFileSize("x", "en")).toBe("—");
    // Arabic is the default: localized units, never B/KB/MB/GB.
    expect(formatFileSize(512)).toContain("بايت");
    expect(formatFileSize(2048)).toContain("ك.ب");
    expect(formatFileSize(12 * MB)).toContain("م.ب");
    expect(formatFileSize(3 * 1024 * MB)).toContain("غ.ب");
  });
});

describe("membership moderation rules", () => {
  it("offers only the actions that make sense for each status", () => {
    expect(availableMembershipActions("pending")).toEqual(["approve", "reject"]);
    expect(availableMembershipActions("approved")).toEqual(["role", "remove", "block"]);
    expect(availableMembershipActions("blocked")).toEqual(["unblock"]);
    expect(availableMembershipActions("rejected")).toEqual(["approve"]);
    expect(availableMembershipActions("left")).toEqual([]);
  });

  it("maps actions onto the dashboard membership endpoints (remove and unblock are reject)", () => {
    expect(membershipRequest("approve", 7)).toEqual({ path: "/api/v1/dashboard/group-memberships/7/approve/", method: "POST" });
    expect(membershipRequest("remove", 7).path).toBe("/api/v1/dashboard/group-memberships/7/reject/");
    expect(membershipRequest("unblock", 7).path).toBe("/api/v1/dashboard/group-memberships/7/reject/");
    expect(membershipRequest("block", 7).path).toBe("/api/v1/dashboard/group-memberships/7/block/");
    expect(membershipRequest("role", 7, "moderator")).toEqual({ path: "/api/v1/dashboard/group-memberships/7/role/", method: "PATCH", body: { role: "moderator" } });
    expect(() => membershipRequest("role", 7, "owner")).toThrow();
  });

  it("asks for confirmation on every action that removes or restricts access, but not on approve", () => {
    expect(CONFIRMED_ACTIONS).toEqual(expect.arrayContaining(["reject", "remove", "block", "unblock", "role"]));
    expect(CONFIRMED_ACTIONS).not.toContain("approve");
  });

  it("uses the join-requests endpoint for pending requests and memberships for members", () => {
    expect(membersListPath(5, "requests")).toBe("/api/v1/dashboard/groups/5/join-requests/");
    expect(membersListPath(5, "members")).toBe("/api/v1/dashboard/groups/5/memberships/");
  });

  it("accepts only official https WhatsApp links", () => {
    expect(isWhatsappUrl("https://chat.whatsapp.com/AbCdEf123")).toBe(true);
    expect(isWhatsappUrl("https://wa.me/963900000000")).toBe(true);
    expect(isWhatsappUrl("http://wa.me/963900000000")).toBe(false);
    expect(isWhatsappUrl("https://evil.example/chat.whatsapp.com")).toBe(false);
    expect(isWhatsappUrl("javascript:alert(1)")).toBe(false);
    expect(whatsappUrlRule.check({ url: "https://example.com/x" })).toEqual({ field: "url", error: "validation.whatsappUrl" });
    expect(whatsappUrlRule.check({ url: "https://wa.me/1" })).toBeNull();
  });
});

describe("protected preview paths", () => {
  const token = "3f2b6c1e-8a4d-4c7e-9b1a-0d5e6f7a8b9c";

  it("reduces the absolute backend preview_url to a protected-stream path", () => {
    expect(previewPathFromUrl(`https://api.example.test/api/v1/protected-files/${token}/`)).toBe(`/api/v1/protected-files/${token}/`);
    expect(previewPathFromUrl(`/api/v1/support/attachments/${token}/`)).toBe(`/api/v1/support/attachments/${token}/`);
  });

  it("ignores the host of the backend URL: only its path is ever requested, through the BFF", () => {
    expect(previewPathFromUrl(`//other.test/api/v1/protected-files/${token}/`)).toBe(`/api/v1/protected-files/${token}/`);
  });

  it("refuses anything that is not exactly an allowlisted stream", () => {
    for (const bad of [
      "", undefined, 5, `https://x.test/api/v1/dashboard/users/`, `/api/v1/protected-files/../auth/me/`, `/api/v1/protected-files/${token}`,
      `/api/v1/protected-files/${token}/extra/`, `/api/v1/protected-files/%2e%2e/`, `/api/v1/verification-card-access/${token}/`,
    ]) expect(() => previewPathFromUrl(bad), String(bad)).toThrow(UntrustedPreviewError);
  });

  it("chooses a viewer from the served type and falls back to the stored file type", () => {
    expect(previewKind("application/pdf")).toBe("pdf");
    expect(previewKind("image/png; charset=binary")).toBe("image");
    expect(previewKind("application/octet-stream", "pdf")).toBe("pdf");
    expect(previewKind("text/html")).toBe("unsupported");
  });
});
