export const JOB_CATEGORIES = [
  "Full-stack",
  "Frontend",
  "Backend",
  "Python",
  "JavaScript / TypeScript",
  "Node.js",
  "Java",
  ".NET",
  "PHP",
  "Mobile",
  "DevOps / Cloud",
  "Data / AI",
  "QA / Test",
  "Security",
] as const

export type JobCategory = (typeof JOB_CATEGORIES)[number]

const RULES: Array<[JobCategory, RegExp]> = [
  ["Full-stack", /\bfull[\s-]?stack\b/i],
  ["Frontend", /\bfront[\s-]?end\b|\breact(?:\.?js)?\b|\bangular\b|\bvue(?:\.?js)?\b|\bui developer\b/i],
  ["Backend", /\bback[\s-]?end\b|\bserver[\s-]?side\b|\bapi(?:s)?\b|\bmicroservices?\b|\bdjango\b|\bfastapi\b|\bflask\b|\bspring(?:\s+boot)?\b|\bnode(?:\.?js)?\b|\bexpress(?:\.?js)?\b|\bnest(?:\.?js)?\b|\blaravel\b/i],
  ["Python", /\bpython\b|\bdjango\b|\bflask\b|\bfastapi\b/i],
  ["JavaScript / TypeScript", /\bjavascript\b|\btypescript\b|\bnext\.?js\b|\breact\.?js\b/i],
  ["Node.js", /\bnode(?:\.?js)?\b|\bexpress(?:\.?js)?\b|\bnest(?:\.?js)?\b/i],
  ["Java", /\bjava\b|\bspring(?:\s+boot)?\b/i],
  [".NET", /\b\.net\b|\bc#\b|\basp\.?net\b/i],
  ["PHP", /\bphp\b|\blaravel\b|\bsymfony\b/i],
  ["Mobile", /\bmobile\b|\bandroid\b|\bios\b|\bflutter\b|\breact native\b|\bswift\b|\bkotlin\b/i],
  ["DevOps / Cloud", /\bdevops\b|\bsre\b|\bcloud\b|\baws\b|\bazure\b|\bgcp\b|\bkubernetes\b|\bdocker\b|\bterraform\b|\bci\/cd\b/i],
  ["Data / AI", /\bdata engineer\b|\bmachine learning\b|\bml engineer\b|\bai engineer\b|\bdata scientist\b|\bllm\b|\bpytorch\b|\btensorflow\b/i],
  ["QA / Test", /\bqa\b|\bquality assurance\b|\btest automation\b|\bsdet\b|\bselenium\b|\bplaywright\b/i],
  ["Security", /\bsecurity\b|\bcybersecurity\b|\bappsec\b|\bpenetration test\b|\bsoc analyst\b/i],
]

export function extractJobCategories(text: string): JobCategory[] {
  const categories = RULES.filter(([, pattern]) => pattern.test(text)).map(([category]) => category)
  return [...new Set(categories)].slice(0, 6)
}
