export type ResumeFields = {
  name?: string;
  email?: string;
  title?: string;
  location?: string;
  education?: string;
  summary?: string;
  skills: string[];
};

const skillTerms = [
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "Go", "Ruby", "PHP", "Swift", "Kotlin", "SQL", "HTML", "CSS",
  "React", "Next.js", "Node.js", "Express", "Angular", "Vue", "Svelte", "Django", "Flask", "Spring", ".NET", "GraphQL", "REST APIs",
  "AWS", "Azure", "Google Cloud", "GCP", "Docker", "Kubernetes", "Terraform", "Git", "Linux", "CI/CD", "Jenkins",
  "Figma", "Sketch", "Adobe Photoshop", "Adobe Illustrator", "Product design", "UX design", "UI design", "UX research", "Usability testing", "Wireframing", "Prototyping", "Design systems", "Accessibility",
  "Product management", "Project management", "Agile", "Scrum", "Jira", "Analytics", "Data analysis", "Tableau", "Power BI", "Excel", "Machine learning", "Data science", "Statistics",
  "Salesforce", "SEO", "Digital marketing", "Content strategy", "Copywriting", "Leadership", "Communication", "Customer success", "Public speaking", "Financial analysis", "Accounting", "Operations",
];

function hasTerm(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(text);
}

export function extractResumeFields(text: string): ResumeFields {
  const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const email = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
  const sectionStart = lines.findIndex(line => /^(education|academic background)\b/i.test(line));
  const summaryStart = lines.findIndex(line => /^(professional summary|summary|profile|objective)\b/i.test(line));
  const summary = summaryStart >= 0 ? lines.slice(summaryStart + 1, summaryStart + 5).filter(line => !/^(experience|work history|education|skills|projects)\b/i.test(line)).join(" ").slice(0, 1200) : undefined;
  const educationLines = lines.filter(line => /\b(bachelor|master|ph\.?d|doctorate|associate|diploma|degree|university|college|institute|school of)\b/i.test(line));
  const education = [...new Set((sectionStart >= 0 ? [...lines.slice(sectionStart + 1, sectionStart + 7), ...educationLines] : educationLines).filter(line => !/^(education|academic background)$/i.test(line)))].slice(0, 5).join("\n");
  const titleLine = lines.slice(0, 12).find(line => /\b(engineer|developer|designer|analyst|manager|researcher|consultant|scientist|architect|specialist|coordinator|director|writer|marketer|accountant|nurse|teacher|recruiter|administrator)\b/i.test(line) && line.length < 100);
  const name = lines.slice(0, 8).find(line => /^[\p{L}][\p{L} .'-]{1,58}$/u.test(line) && !/@/.test(line) && !/\b(resume|curriculum vitae|portfolio|linkedin|github)\b/i.test(line) && !/\b(engineer|developer|designer|analyst|manager|researcher|consultant|scientist|architect|specialist|coordinator|director|writer|marketer)\b/i.test(line));
  const location = lines.slice(0, 12).find(line => /\b[A-Z][a-z]+(?:[ ,]+[A-Z]{2})\b/.test(line) && !/@/.test(line));
  const skills = skillTerms.filter(skill => hasTerm(text, skill));
  return { name, email, title: titleLine, location, education, summary, skills };
}
