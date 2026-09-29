# CaseArena 🎁⚡📜

Социальная коллекционная игровая платформа: **виртуальные кейсы, апгрейды и контракты**.

> ⚠️ **Важно:** это игровой симулятор, НЕ азартная платформа. Внутренняя валюта
> **Arena Points (AP)** не покупается за реальные деньги, не выводится и не имеет
> денежной стоимости. Все предметы — цифровые коллекционные предметы внутри
> приложения. Никаких платежей, депозитов, ставок и вывода средств в проекте нет.

---

## Что внутри

| Режим | Описание |
|---|---|
| 🎁 **Кейсы** | 8 кейсов, 38 вымышленных предметов, рулетка-анимация, честные шансы |
| ⚡ **Апгрейд** | Обмен 1–5 предметов на более дорогой: честный шанс × 0.95 (комиссия 5%) |
| 📜 **Контракты** | 3–5 предметов → один случайный из пула с EV = 81% от вложенного |
| 🎒 **Инвентарь** | Фильтры, избранное, продажа системе за 30% ценности |
| 📅 **Ежедневный бонус** | 7-дневный цикл с предметами и серией (streak) |
| 🏆 **Лидерборд** | XP / коллекция / открытия / рекорды |
| 👤 **Профили** | Публичные профили, уровни и XP |
| 🔔 **Уведомления** | Награды, успешные апгрейды, редкие дропы |
| 🎧 **Поддержка** | Тикет-система с ответами персонала |
| 🛠 **Админ-панель** | Дашборд экономики, пользователи, веса кейсов, тикеты, аудит |

**Бои (Case Battles) осознанно отложены** — по требованию заказчика механика битв
не реализована в этой фазе. План возврата: `docs/roadmap-battles.md`.

## Стек

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS 4, Zustand
- **Backend:** NestJS 12, TypeScript, REST, JWT (access+refresh с ротацией, HTTP-only cookies), Swagger (`/docs`)
- **БД:** Prisma ORM — SQLite (dev-профиль) / PostgreSQL (прод, docker-compose)
- **Инфраструктура:** Docker Compose (postgres + api + web + nginx)

## Быстрый старт (dev, без Docker)

```bash
npm install

# схема БД + сид (SQLite, файл apps/api/prisma/dev.db)
npm run db:push -w api
DATABASE_URL="file:./dev.db" npm run db:seed -w api

# терминал 1 — API :4000
npm run dev:api

# терминал 2 — Web :3000 (проксирует /api на API)
npm run dev:web
```

Открыть **http://localhost:3000**

Тестовые аккаунты (создаются сидом):

| Кто | Логин | Пароль |
|---|---|---|
| Демо-игрок | `demo@casearena.local` | `demo1234` |
| Админ | `admin@casearena.local` | `Admin#12345` (env) |

## Прод (Docker)

```bash
cp .env.example .env   # задать JWT_SECRET, ADMIN_PASSWORD
docker compose up -d --build
# опционально реверс-прокси на :80
docker compose --profile nginx up -d
```

Compose поднимает PostgreSQL 16, API (自动-migrate через `prisma db push`) и Next standalone.

## Тесты

```bash
npm run test -w api     # unit-тесты экономики (RTP кейсов, EV апгрейда/контрактов, XP)
```

## API

- Swagger UI: **http://localhost:4000/docs**
- Формат ответа: `{ "success": true, "data": ... }` / `{ "success": false, "error": { code, message, requestId } }`
- Основное: `POST /api/auth/*`, `GET /api/users/me`, `GET /api/cases`, `POST /api/cases/:slug/open`,
  `GET /api/inventory`, `POST /api/inventory/sell`, `GET/POST /api/upgrade/*`,
  `POST /api/contracts/preview|run`, `GET/POST /api/daily/*`, `GET /api/leaderboard`,
  `GET /api/drops`, `GET /api/stats/overview`, `* /api/support/tickets*`, `* /api/admin/*`

## Экономика («контора всегда в плюсе»)

Платформа структурально прибыльна **без обмана игроков** — все проценты честные:

| Механика | Математика | Маржа |
|---|---|---|
| Кейс | EV кейса = `price × RTP`, RTP настраивается (87–93%) | 7–13% |
| Апгрейд | `chance = (input/target) × 0.95` | 5% от оборота |
| Контракт | EV выдачи = 81% от суммы входа | 19% |
| Продажа | система выкупает предмет за 30% ценности | 70% |

Каждое движение AP фиксируется в неизменяемом `Ledger`. Админ-дашборд показывает
сожжённые/выданные очки и нетто-прибыль по дням. Подробности: `docs/economy.md`.

## Структура

```
apps/
  api/        NestJS: модули auth/users/cases/inventory/upgrade/contracts/daily/
              leaderboard/stats/notifications/support/admin/health + Prisma
  web/        Next.js: app/, components/, lib/ (api, store, i18n RU/EN)
infra/
  docker/     Dockerfile.api, Dockerfile.web
  nginx/      reverse-proxy конфиг
docs/         архитектура, экономика, API, деплой, roadmap боёв
```

## Безопасность и честность

- Сервер — единственный источник истины: фронт отправляет только намерение («открыть кейс X»)
- Все RNG — `crypto.randomInt` (CSPRNG); каждый результат сохраняет seed + roll для аудита
- Баланс меняется только через `BalanceService` (транзакции, атомарный списание с проверкой)
- Argon2-подобное хэширование паролей (scrypt), refresh-токены с ротацией, HTTP-only cookies
- Rate-limit на логин, Zod-валидация DTO, Helmet, CORS, единый error-envelope
- RBAC: USER / MODERATOR / ADMIN / SUPER_ADMIN; админ-действия пишутся в AuditLog

## Документация

- `docs/architecture.md` — архитектура и решения
- `docs/economy.md` — математика экономики
- `docs/api.md` — контракт API
- `docs/deployment.md` — деплой и переменные окружения
- `docs/roadmap-battles.md` — план возвращения механики боёв
