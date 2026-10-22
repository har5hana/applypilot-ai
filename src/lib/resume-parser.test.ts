import { describe, expect, it } from "vitest";
import { extractResumeFields } from "./resume-parser";

describe("resume profile extraction", () => {
  it("finds contact details, role, skills, education, and summary for review", () => {
    const fields = extractResumeFields([
      "Jordan Lee",
      "Software Engineer",
      "Austin, TX",
      "jordan.lee@example.com",
      "PROFESSIONAL SUMMARY",
      "Engineer building reliable APIs and customer-facing products.",
      "SKILLS",
      "TypeScript, React, SQL, AWS",
      "EDUCATION",
      "Bachelor of Science in Computer Science",
      "State University, 2021",
    ].join("\n"));

    expect(fields.name).toBe("Jordan Lee");
    expect(fields.email).toBe("jordan.lee@example.com");
    expect(fields.title).toBe("Software Engineer");
    expect(fields.location).toBe("Austin, TX");
    expect(fields.skills).toEqual(expect.arrayContaining(["TypeScript", "React", "SQL", "AWS"]));
    expect(fields.education).toContain("Bachelor of Science in Computer Science");
    expect(fields.summary).toContain("reliable APIs");
  });

  it("returns no guesses when the resume text is empty", () => {
    expect(extractResumeFields("")).toEqual({ name: undefined, email: undefined, title: undefined, location: undefined, education: "", summary: undefined, skills: [] });
  });
});
