# 腾讯云部署说明

## 服务器目录

当前线上部署目录：

```text
/opt/pangpang-reward-app/current
```

## 服务组成

使用 Docker Compose 启动两个容器：

- `current-app-1`：Next.js 应用
- `current-postgres-1`：PostgreSQL 数据库

应用只监听宿主机本地端口：

```text
127.0.0.1:3100 -> container:3000
```

这样不会占用已有的 `hub.herotop.cn` / Halo 服务端口。

## 启动与更新

```bash
cd /opt/pangpang-reward-app/current
docker compose -f docker-compose.prod.yml up -d --build
```

容器启动时会自动执行：

```bash
npx prisma migrate deploy
npm run seed
npm run start
```

## 域名与 HTTPS

域名：

```text
pp.herotop.cn
```

OpenResty 反向代理配置：

```text
/opt/1panel/www/conf.d/pp.herotop.cn.conf
```

证书由 Let's Encrypt / certbot 管理，证书续期后会通过 deploy hook 复制到 OpenResty 证书目录并 reload：

```text
/etc/letsencrypt/renewal-hooks/deploy/pp-openresty.sh
```

## 备份

建议定期备份 PostgreSQL：

```bash
cd /opt/pangpang-reward-app/current
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U pangpang pangpang_reward > pangpang_reward.sql
```

恢复时可使用：

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U pangpang -d pangpang_reward < pangpang_reward.sql
```
