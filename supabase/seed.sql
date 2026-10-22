insert into public.job_sources (name, provider_key, integration_type, is_enabled)
values ('ApplyPilot sample roles', 'applypilot-demo', 'demo', true)
on conflict (provider_key) do nothing;

insert into public.jobs (source_id, external_job_id, title, company, location, remote_policy, salary_min, salary_max, salary_currency, employment_type, experience_level, description, required_skills, posted_at, original_url, application_method, normalized_url)
select s.id, j.external_id, j.title, j.company, j.location, j.remote_policy::public.remote_policy, j.salary_min, j.salary_max, 'USD', 'Full-time', 'Senior', j.description, j.skills, now() - j.posted_days * interval '1 day', j.url, 'manual', lower(regexp_replace(j.url, '/+$', ''))
from public.job_sources s cross join (values
  ('demo-linear-product-designer','Senior Product Designer','Linear','Remote · North America','remote',145000,185000,'Lead end-to-end product design, partner with product and engineering, and contribute to a thoughtful design system.','{"Product design","Figma","Design systems","Prototyping"}'::text[],2,'https://linear.app/careers'),
  ('demo-notion-growth-designer','Product Designer, Growth','Notion','New York, NY · Hybrid','hybrid',130000,165000,'Join the growth design team to improve how people discover and adopt Notion. Design, test, and refine product experiences.','{"Figma","Experimentation","Prototyping","Analytics"}'::text[],1,'https://www.notion.so/careers'),
  ('demo-vercel-ux-designer','UX Designer','Vercel','Remote · US','remote',120000,155000,'Build intuitive tools for frontend developers. Collaborate across design and engineering to make complex infrastructure approachable.','{"UX research","Figma","Design systems","Accessibility"}'::text[],3,'https://vercel.com/careers')
) as j(external_id,title,company,location,remote_policy,salary_min,salary_max,description,skills,posted_days,url)
where s.provider_key='applypilot-demo'
on conflict (source_id, external_job_id) do nothing;
