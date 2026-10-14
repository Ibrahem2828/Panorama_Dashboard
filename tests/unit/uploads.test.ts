import { describe, expect, it } from "vitest";

import { acceptAttribute, DOCUMENT_POLICY, effectiveMaxBytes, IMAGE_POLICY, LECTURE_POLICY, MAX_REQUEST_UPLOAD_BYTES, uploadPolicyForField, validateUpload } from "@/lib/uploads";

const MB = 1024 * 1024;
const file = (name: string, size: number, type = "") => ({ name, size, type });

describe("upload policy selection", () => {
  it("maps contract file fields to the backend policy", () => {
    expect(uploadPolicyForField("original_file")).toBe(LECTURE_POLICY);
    expect(uploadPolicyForField("image")).toBe(IMAGE_POLICY);
    expect(uploadPolicyForField("card_image")).toBe(IMAGE_POLICY);
    expect(uploadPolicyForField("file")).toBe(DOCUMENT_POLICY);
    expect(uploadPolicyForField("anything_else")).toBe(DOCUMENT_POLICY);
  });

  it("never allows more than one BFF request can carry", () => {
    expect(effectiveMaxBytes(DOCUMENT_POLICY)).toBe(25 * MB);
    expect(effectiveMaxBytes(IMAGE_POLICY)).toBe(8 * MB);
    expect(effectiveMaxBytes(LECTURE_POLICY)).toBe(MAX_REQUEST_UPLOAD_BYTES);
    // One BFF request (51 MiB) carries the largest backend limit (50 MiB lectures) plus multipart framing.
    expect(MAX_REQUEST_UPLOAD_BYTES).toBe(50 * MB);
  });

  it("builds an accept attribute with extensions and mime types", () => {
    const accept = acceptAttribute(IMAGE_POLICY);
    expect(accept).toContain(".png");
    expect(accept).toContain("image/webp");
    expect(accept).not.toContain("pdf");
  });
});

describe("validateUpload", () => {
  it("accepts allowed files, including an empty or generic browser mime type", () => {
    expect(validateUpload(file("a.pdf", 10, "application/pdf"), DOCUMENT_POLICY)).toBeNull();
    expect(validateUpload(file("A.JPG", 10, "image/jpeg"), DOCUMENT_POLICY)).toBeNull();
    expect(validateUpload(file("a.webp", 10, ""), IMAGE_POLICY)).toBeNull();
    expect(validateUpload(file("a.docx", 10, "application/octet-stream"), LECTURE_POLICY)).toBeNull();
  });

  it("rejects wrong types by extension or mime", () => {
    expect(validateUpload(file("a.exe", 10), DOCUMENT_POLICY)).toBe("type");
    expect(validateUpload(file("noext", 10), DOCUMENT_POLICY)).toBe("type");
    expect(validateUpload(file("a.pdf", 10, "application/pdf"), IMAGE_POLICY)).toBe("type");
    expect(validateUpload(file("a.png", 10, "text/html"), DOCUMENT_POLICY)).toBe("type");
  });

  it("rejects empty files before size", () => {
    expect(validateUpload(file("a.pdf", 0, "application/pdf"), DOCUMENT_POLICY)).toBe("empty");
  });

  it("enforces the size limit inclusively", () => {
    expect(validateUpload(file("a.png", 8 * MB, "image/png"), IMAGE_POLICY)).toBeNull();
    expect(validateUpload(file("a.png", 8 * MB + 1, "image/png"), IMAGE_POLICY)).toBe("size");
    expect(validateUpload(file("a.pdf", 50 * MB), LECTURE_POLICY)).toBeNull();
    expect(validateUpload(file("a.pdf", 50 * MB + 1), LECTURE_POLICY)).toBe("size");
  });
});
