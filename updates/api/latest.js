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
  const update = await manifest.json();
  const findAsset = (test) => data.assets?.find((item) => test(item.name));
  const direct = (test) => {
    const item = findAsset(test);
    return item && { url: item.browser_download_url, name: item.name };
  };
  const apk = findAsset((name) => /\.apk$/i.test(name) && /release|universal|arm64|aarch64/i.test(name));
  const platforms = { ...(update.platforms || {}) };
  if (apk) platforms["android-arm64"] = { url: apk.browser_download_url, name: apk.name };
  const fallback = {
    "windows-x86_64": direct((name) => /\.exe$/i.test(name) && /setup|installer|nsis/i.test(name)),
    "darwin-aarch64": direct((name) => /\.dmg$/i.test(name) && /aarch64|arm64|apple-silicon/i.test(name)),
    "darwin-x86_64": direct((name) => /\.dmg$/i.test(name) && /x64|x86_64|intel/i.test(name)),
    "linux-x86_64": direct((name) => /\.appimage$/i.test(name)),
  };
  for (const [key, value] of Object.entries(fallback)) if (!platforms[key] && value) platforms[key] = value;
  update.platforms = platforms;
  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(200).send(JSON.stringify(update));
};
