const fs = require("fs");
const path = require("path");

const USERNAME = "DhanviND360";
const TOKEN = process.env.GITHUB_TOKEN;
const SVG_PATH = path.join(__dirname, "..", "assets", "profile-card.svg");

async function gql(query) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

async function main() {
  if (!TOKEN) {
    console.log("No GITHUB_TOKEN provided in environment; skipping dynamic stats update.");
    return;
  }
  // total stars across owned repos
  const repoData = await gql(`{
    user(login: "${USERNAME}") {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        nodes { stargazerCount }
      }
    }
  }`);
  const totalStars = repoData.user.repositories.nodes.reduce(
    (sum, r) => sum + r.stargazerCount, 0
  );

  // lifetime contribution totals (loop each year of account history)
  const userData = await gql(`{
    user(login: "${USERNAME}") { createdAt }
  }`);
  const startYear = new Date(userData.user.createdAt).getFullYear();
  const thisYear = new Date().getFullYear();

  let totalCommits = 0, totalPRs = 0, totalIssues = 0;
  for (let y = startYear; y <= thisYear; y++) {
    const from = `${y}-01-01T00:00:00Z`;
    const to = `${y}-12-31T23:59:59Z`;
    const data = await gql(`{
      user(login: "${USERNAME}") {
        contributionsCollection(from: "${from}", to: "${to}") {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
        }
      }
    }`);
    const c = data.user.contributionsCollection;
    totalCommits += c.totalCommitContributions;
    totalPRs += c.totalPullRequestContributions;
    totalIssues += c.totalIssueContributions;
  }

  let svg = fs.readFileSync(SVG_PATH, "utf8");
  svg = svg.replace(/(id="stat-stars"[^>]*>)[^<]*/, `$1${fmt(totalStars)}`);
  svg = svg.replace(/(id="stat-commits"[^>]*>)[^<]*/, `$1${fmt(totalCommits)}`);
  svg = svg.replace(/(id="stat-prs"[^>]*>)[^<]*/, `$1${fmt(totalPRs)}`);
  svg = svg.replace(/(id="stat-issues"[^>]*>)[^<]*/, `$1${fmt(totalIssues)}`);
  fs.writeFileSync(SVG_PATH, svg);

  console.log({ totalStars, totalCommits, totalPRs, totalIssues });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
