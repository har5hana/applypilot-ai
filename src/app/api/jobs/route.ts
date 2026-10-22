type RemoteJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: string;
  salary: string;
  type: string;
  posted: string;
  skills: string[];
  description: string;
  source: string;
  url: string;
  active: boolean;
};

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function string(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}

function plainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

function dateLabel(value: unknown) {
  const date = new Date(string(value));
  if (!Number.isFinite(date.getTime())) return "Recently";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} ago`;
}

function normalizeRemotive(value: unknown): RemoteJob | null {
  const job = object(value);
  const id = String(job.id ?? "");
  const url = string(job.url);
  if (!id || !url.startsWith("https://remotive.com/")) return null;
  return {
    id: `remotive-${id}`, title: string(job.title, "Untitled role"), company: string(job.company_name, "Company not listed"),
    location: string(job.candidate_required_location, "Remote"), remote: "Remote", salary: string(job.salary, "Not listed"),
    type: string(job.job_type, "Not listed").replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()),
    posted: dateLabel(job.publication_date), skills: [string(job.category)].filter(Boolean),
    description: plainText(string(job.description)), source: "Remotive", url, active: true,
  };
}

function normalizeJobicy(value: unknown): RemoteJob | null {
  const job = object(value);
  const id = String(job.id ?? "");
  const url = string(job.url);
  if (!id || !url.startsWith("https://jobicy.com/")) return null;
  const min = typeof job.salaryMin === "number" ? job.salaryMin : null;
  const max = typeof job.salaryMax === "number" ? job.salaryMax : null;
  const currency = string(job.salaryCurrency, "USD");
  const salary = min !== null && max !== null ? `${currency} ${min.toLocaleString()}–${max.toLocaleString()}` : min !== null ? `${currency} ${min.toLocaleString()}+` : "Not listed";
  const types = list(job.jobType);
  return {
    id: `jobicy-${id}`, title: string(job.jobTitle, "Untitled role"), company: string(job.companyName, "Company not listed"),
    location: string(job.jobGeo, "Remote"), remote: "Remote", salary,
    type: types.join(", ") || "Not listed", posted: dateLabel(job.pubDate),
    skills: [...list(job.jobIndustry), ...list(job.jobLevel)].slice(0, 5),
    description: plainText(string(job.jobDescription) || string(job.jobExcerpt)), source: "Jobicy", url, active: true,
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url, { next: { revalidate: 21_600 }, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function GET() {
  const providers = await Promise.allSettled([
    fetchJson("https://remotive.com/api/remote-jobs?limit=100"),
    fetchJson("https://jobicy.com/api/jobs?count=100"),
  ]);
  const jobs: RemoteJob[] = [];
  const availableSources: string[] = [];
  const errors: string[] = [];

  if (providers[0].status === "fulfilled") {
    const rows = object(providers[0].value).jobs;
    if (Array.isArray(rows)) jobs.push(...rows.map(normalizeRemotive).filter((job): job is RemoteJob => Boolean(job)));
    availableSources.push("Remotive");
  } else errors.push("Remotive");

  if (providers[1].status === "fulfilled") {
    const rows = object(providers[1].value).jobs;
    if (Array.isArray(rows)) jobs.push(...rows.map(normalizeJobicy).filter((job): job is RemoteJob => Boolean(job)));
    availableSources.push("Jobicy");
  } else errors.push("Jobicy");

  const unique = [...new Map(jobs.map(job => [job.id, job])).values()];
  return Response.json({ jobs: unique, sources: availableSources, unavailableSources: errors });
}
