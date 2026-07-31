#!/bin/bash
set -euo pipefail

deploy_root="/var/www/guamian"
source_dir="${1:-$deploy_root/source}"
release="$deploy_root/releases/$(date +%Y%m%d%H%M%S)"

command -v node >/dev/null
command -v pnpm >/dev/null

cd "$source_dir"
pnpm install --frozen-lockfile
pnpm build

install -d -m 755 "$release"
cp -a dist db package.json pnpm-lock.yaml "$release/"
cd "$release"
pnpm install --prod --frozen-lockfile

ln -sfn "$release" "$deploy_root/current.next"
mv -Tf "$deploy_root/current.next" "$deploy_root/current"
sudo systemctl restart firefly

# Keep the five newest releases for quick rollback.
find "$deploy_root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
	| sort -nr \
	| tail -n +6 \
	| cut -d' ' -f2- \
	| xargs -r rm -rf
