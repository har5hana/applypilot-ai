export type ApplicationContent = { summary: string; cover: string; answers: string };
export type ApplicationConsent = ApplicationContent & { status: string; approvalSnapshot?: string };

/** Stable serialization binds consent to every displayed application field. */
export function contentSnapshot(content: ApplicationContent): string {
  return JSON.stringify([content.summary, content.cover, content.answers]);
}

export function canOpenEmployer(application: ApplicationConsent): boolean {
  return application.status === "Approved" && application.approvalSnapshot === contentSnapshot(application);
}

/** A transparent overlap indicator; it is not a hiring probability. */
export function skillMatchScore(profileSkills: string[], requiredSkills: string[]): number {
  if (!requiredSkills.length) return 0;
  const skills = new Set(profileSkills.map(skill => skill.trim().toLocaleLowerCase()).filter(Boolean));
  const matched = requiredSkills.filter(skill => skills.has(skill.trim().toLocaleLowerCase())).length;
  return Math.round((matched / requiredSkills.length) * 100);
}
