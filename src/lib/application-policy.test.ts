import { describe, expect, it } from "vitest";
import { canOpenEmployer, contentSnapshot, skillMatchScore } from "./application-policy";

describe("approval gate", () => {
  const approved = { status: "Approved", summary: "A", cover: "B", answers: "C" };

  it("allows the exact approved content", () => {
    expect(canOpenEmployer({ ...approved, approvalSnapshot: contentSnapshot(approved) })).toBe(true);
  });

  it("requires fresh approval after any content edit", () => {
    expect(canOpenEmployer({ ...approved, cover: "Changed", approvalSnapshot: contentSnapshot(approved) })).toBe(false);
  });

  it("blocks rejected and pending applications even if a snapshot exists", () => {
    const snapshot = contentSnapshot(approved);
    expect(canOpenEmployer({ ...approved, status: "Rejected", approvalSnapshot: snapshot })).toBe(false);
    expect(canOpenEmployer({ ...approved, status: "Pending Review", approvalSnapshot: snapshot })).toBe(false);
  });
});

describe("skill overlap score", () => {
  it("scores matching skills case-insensitively", () => {
    expect(skillMatchScore(["Figma", "Research"], ["figma", "Research", "SQL"])).toBe(67);
  });

  it("returns zero when there are no requirements", () => {
    expect(skillMatchScore(["Figma"], [])).toBe(0);
  });
});
