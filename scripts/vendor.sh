#!/bin/sh
# Copies every Rust dependency into src-tauri/vendor so `tauri build` works with no network.
# (JS deps are already bundled into the app by Vite; run `npm install` once while online.)
set -e
cd "$(dirname "$0")/../src-tauri"
cargo vendor vendor > /dev/null
mkdir -p .cargo
cat > .cargo/config.toml <<'EOT'
[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "vendor"
EOT
echo "Rust dependencies vendored into src-tauri/vendor"
