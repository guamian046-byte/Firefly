#!/bin/bash
set -euo pipefail

admin_email="${ADMIN_EMAIL_VALUE:?ADMIN_EMAIL_VALUE is required}"
deploy_user="${DEPLOY_USER:-ubuntu}"
database_password="$(openssl rand -hex 32)"

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='firefly'" | grep -q 1; then
	sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE firefly WITH LOGIN PASSWORD '${database_password}'"
else
	sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE firefly WITH LOGIN PASSWORD '${database_password}'"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='firefly'" | grep -q 1; then
	sudo -u postgres createdb --owner=firefly firefly
fi

sudo install -d -o "$deploy_user" -g "$deploy_user" -m 755 /var/www/guamian/releases
sudo chown "$deploy_user:$deploy_user" /var/www/guamian
sudo install -m 755 deploy-guamian /usr/local/bin/deploy-guamian
sed -e "s/^User=.*/User=${deploy_user}/" -e "s/^Group=.*/Group=${deploy_user}/" firefly.service \
	| sudo tee /etc/systemd/system/firefly.service >/dev/null
sudo chmod 644 /etc/systemd/system/firefly.service
sudo install -m 644 nginx-guamian.conf /etc/nginx/sites-available/guamian
sudo ln -sfn /etc/nginx/sites-available/guamian /etc/nginx/sites-enabled/guamian

printf 'DATABASE_URL=postgresql://firefly:%s@127.0.0.1:5432/firefly\nADMIN_EMAIL=%s\n' \
	"$database_password" "$admin_email" | sudo tee /etc/firefly.env >/dev/null
sudo chown root:root /etc/firefly.env
sudo chmod 600 /etc/firefly.env

printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart firefly\n' "$deploy_user" \
	| sudo tee /etc/sudoers.d/firefly-deploy >/dev/null
sudo chmod 440 /etc/sudoers.d/firefly-deploy
sudo visudo -cf /etc/sudoers.d/firefly-deploy
sudo systemctl daemon-reload
sudo systemctl enable firefly nginx postgresql
sudo nginx -t
