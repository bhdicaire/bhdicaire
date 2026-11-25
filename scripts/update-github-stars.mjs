// Writes data/github-stars.yml: the star count of every public repository
// of the owners below, keyed by lower-case "owner/repository".
// bhdicaire.com reads the file when it builds. YAML, not JSON: the site maps
// the json suffix to its feed format, so Hugo cannot fetch a remote .json.
import { mkdir, writeFile } from "node:fs/promises";

const owners = ["bhdicaire", "vanityURLs", "wgo-audit"];
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "bhdicaire-github-stars",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function publicRepositories(owner) {
  const found = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `https://api.github.com/users/${owner}/repos?type=owner&per_page=100&page=${page}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status} for ${owner}`);
    }
    const batch = await response.json();
    found.push(...batch.filter((repo) => !repo.private && !repo.fork));
    if (batch.length < 100) break;
  }
  return found;
}

const repositories = {};
for (const owner of owners) {
  for (const repo of await publicRepositories(owner)) {
    repositories[repo.full_name.toLowerCase()] = Number(repo.stargazers_count ?? 0);
  }
}

const sorted = Object.fromEntries(Object.entries(repositories).sort(([a], [b]) => a.localeCompare(b)));
if (Object.keys(sorted).length === 0) {
  throw new Error("No public repository found; the file is left unchanged");
}

await mkdir("data", { recursive: true });
const lines = Object.entries(sorted).map(([repo, stars]) => `  "${repo}": ${stars}`);
await writeFile("data/github-stars.yml", ["repositories:", ...lines, ""].join("\n"));
console.log(`${Object.keys(sorted).length} repositories written`);
