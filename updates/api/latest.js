module.exports = async function handler(request, response) {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    return response.status(503).json({ error: "Set GITHUB_REPOSITORY to owner/repository in Vercel." });
  }

  const release = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "itsd-update-proxy" },
  });
  if (!release.ok) return response.status(release.status).send("GitHub release lookup failed.");

  const data = await release.json();
  const asset = data.assets?.find((item) => item.name === "latest.json");
  if (!asset) return response.status(404).send("No latest.json asset in the latest release.");

  const manifest = await fetch(asset.browser_download_url);
  if (!manifest.ok) return response.status(manifest.status).send("Release manifest download failed.");
  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(200).send(await manifest.text());
};
