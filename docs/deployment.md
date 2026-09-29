# Деплой

## Профили БД

Схема Prisma одна (`apps/api/prisma/schema.prisma`). Переключение:

```bash
# dev/demo (SQLite)
DATABASE_URL="file:./dev.db" provider = "sqlite"

# production (PostgreSQL): в schema.prisma заменить
#   provider = "sqlite"  →  provider = "postgresql"
# затем
DATABASE_URL="postgresql://..." npx prisma db push && npx prisma generate
```

Docker-образ API автоматически выполняет `prisma db push` при старте.

## Docker Compose

```bash
cp .env.example .env
# обязательно: JWT_SECRET, ADMIN_PASSWORD (не оставляйте дефолты!)
docker compose up -d --build
docker compose --profile nginx up -d   # опционально: единый вход на :80
```

Сервисы: `postgres:16`, `api` (:4000), `web` (:3000), `nginx` (:80, профиль nginx).

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | SQLite-файл или PostgreSQL DSN |
| `JWT_SECRET` | секрет подписи токенов (обязателен в проде) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | сид админа; в проде сменить пароль после первого входа |
| `WEB_ORIGIN` | CORS-источник фронтенда |
| `PORT` | порт API (4000) |
| `LIVEFEED_ENABLED` / `LIVEFEED_INTERVAL_MS` | фоновая активность ботов |

## Чек-лист прода

- [ ] Уникальный `JWT_SECRET`
- [ ] Сменённый пароль админа
- [ ] PostgreSQL + регулярные бэкапы volume `pgdata`
- [ ] HTTPS перед nginx (cookies `secure` включаются `NODE_ENV=production`)
- [ ] Логирование собирается (`[api]` structured lines), алерты на `/api/health/ready`

## Troubleshooting

- **`Nest can't resolve dependencies`** — модуль не импортирует модуль-провайдер
  (см. `StatsModule` → `CasesModule`).
- **`Value does not fit in an INT column`** — roll хранится строкой; не менять обратно на Int.
- **Prisma «already in sync», но сид не прошёл** — сид запускается вручную: `npm run db:seed -w api`.
