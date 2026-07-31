# 腾讯云服务器部署

网站由 GitHub Actions 构建，通过 SSH 发布到 `/var/www/guamian/current`。Astro Node 服务
监听本机 4321 端口，Nginx/EdgeOne 对外提供 HTTPS，PostgreSQL 只允许本机连接。

## 初始化服务器

以下以 Ubuntu/Debian 和 `deploy` 用户为例：

```sh
sudo apt update
sudo apt install -y nginx postgresql nodejs
sudo corepack enable
sudo corepack prepare pnpm@9.14.4 --activate
sudo -u postgres createuser --pwprompt firefly
sudo -u postgres createdb --owner=firefly firefly
sudo install -d -o deploy -g deploy -m 755 /var/www/guamian/releases
sudo install -m 755 deploy/deploy-guamian /usr/local/bin/deploy-guamian
sudo install -m 644 deploy/firefly.service /etc/systemd/system/firefly.service
sudo install -m 644 deploy/nginx-guamian.conf /etc/nginx/sites-available/guamian
sudo ln -s /etc/nginx/sites-available/guamian /etc/nginx/sites-enabled/guamian
sudo nginx -t
```

创建只允许 root 读取的 `/etc/firefly.env`：

```dotenv
DATABASE_URL=postgresql://firefly:数据库密码@127.0.0.1:5432/firefly
ADMIN_EMAIL=站长邮箱
```

```sh
sudo chown root:root /etc/firefly.env
sudo chmod 600 /etc/firefly.env
sudo systemctl daemon-reload
sudo systemctl enable firefly nginx
```

允许部署用户只重启该服务：运行 `sudo visudo -f /etc/sudoers.d/firefly-deploy`，写入：

```text
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart firefly
```

## GitHub Actions secrets

在仓库 Settings → Secrets and variables → Actions 添加：

- `SERVER_HOST`：服务器公网 IP。
- `SERVER_PORT`：SSH 端口，通常为 `22`。
- `SERVER_USER`：部署用户。
- `SERVER_SSH_KEY`：部署私钥完整内容。
- `SERVER_HOST_KEY`：`ssh-keyscan -p 22 <服务器IP>` 的输出。

不要把数据库密码、SSH 私钥或 `/etc/firefly.env` 提交到仓库。

## 发布和检查

推送到 `master` 或手动运行 `Deploy to Tencent Cloud`。首次成功后执行：

```sh
sudo systemctl status firefly
curl -I http://127.0.0.1:4321
sudo nginx -t
sudo systemctl reload nginx
```

数据库表会在首次访问注册或社区页面时自动创建。然后使用 `ADMIN_EMAIL` 对应邮箱注册，
即可进入 `/admin/`。服务器保留最近五个版本，代码回滚不会删除数据库数据。
