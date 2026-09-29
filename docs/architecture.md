# Архитектура CaseArena

## Обзор

Монорепо npm-workspaces:

```
apps/api   — NestJS 12, REST API, Prisma, JWT-auth
apps/web   — Next.js 16 (App Router), React 19, Tailwind 4, Zustand
infra/     — Dockerfiles + nginx
docs/
```

В песочнице/деве фронтенд проксирует `/api/*` на API (rewrites в `next.config.ts`),
поэтому cookies работают same-origin и CORS не нужен. В проде то же самое делает nginx.

## Ключевые решения

1. **SQLite-профиль для dev/demo** (`DATABASE_URL="file:./dev.db"`), PostgreSQL — для
   прод-профиля. Схема Prisma одна; для перехода меняется `provider` + URL
   (см. docs/deployment.md). Причина: нулевые зависимости для локального запуска.
2. **Redis не используется в фазе 1.** Кэш лидерборда — 30-секундный in-memory.
   Точка расширения: `LeaderboardService.cache`.
3. **Realtime (v2)**: Socket.IO gateway `/realtime` для боёв (комнаты `battle:{id}`)
   + автоматический фолбэк на REST-поллинг на клиенте. Лента дропов — polling.
4. **Идемпотентность (v2)**: таблица `IdempotencyKey` + `IdempotencyService`;
   ключ `x-idempotency-key` опционален, но фронт шлёт его на все игровые мутации.
5. **Steam OpenID (v2)**: игроки входят только через Steam; staff — пароль +
   секретный код. `steamId @unique` в User; регистрация по email отключена.
4. **Roll-значения хранятся как TEXT** (uint32 не влезает в signed Int32 SQLite).
5. **tsx не эмитит decorator metadata** → API в dev компилируется через `tsc --watch`
   + `node --watch` (CJS), прод — `tsc`-сборка в `dist/`.

## Backend-модули

```
auth/          register/login/refresh(ротация)/logout, scrypt, rate-limit
users/         me, публичный профиль, смена ника/пароля
balance/       BalanceService: grant/spend через транзакции + Ledger (единая точка)
cases/         каталог, детали, шансы (честные %), открытие (CSPRNG + seed + roll)
inventory/     лист/избранное/продажа (30%)
upgrade/       targets по сумме, run: честный шанс × (1−fee)
contracts/     preview пула (binary-search α для точного EV=81%), run
daily/         7-дневный цикл, streak, предметные дни (COMMON/RARE/SPECIAL)
leaderboard/   xp/collection/opens/profit, кэш 30с
stats/         обзорная статистика + LiveFeed (боты играют через боевой пайплайн)
notifications/ лента + прочитано
support/       тикеты: пользователь/персонал, приоритеты
admin/         дашборд экономики, users, cases+веса, tickets, audit
health/        /api/health, /live, /ready
common/        RandomService (crypto), economy.ts (чистые функции), guards, фильтры
```

## Целостность игры

- Фронт отправляет **только намерения**. Результат всегда считает сервер.
- `RandomService` — `crypto.randomInt` (CSPRNG), без `Math.random` в игровой логике
  (допустимо только для визуального наполнения рулетки на клиенте и выбора бота в LiveFeed).
- Каждое открытие/апгрейд/контракт пишет `seed` (hex) + `roll` (uint32 строкой) →
  воспроизводимость и аудит.
- Расход баланса: `balance.updateMany({ where: { userId, amount: { gte: cost } } })`
  внутри транзакции → гонок и овердрафта нет.
- Предметы списываются через `status: CONSUMED/SOLD` (никогда не удаляются) →
  повторное использование в апгрейде невозможно (`status: 'OWNED'` в выборке).
- Повторный HTTP-запрос с теми же id предмета вернёт `ITEMS_NOT_OWNED` (идемпотентность
  на уровне состояния, а не только ключей).

## Модель данных (основное)

User, Session, Balance, Ledger (append-only), Item, Case, CaseItem (weight),
CaseOpen (seed/roll), InventoryItem (sourceType/status), Upgrade, Contract,
DailyClaim, Notification, Ticket, TicketMessage, AuditLog, Setting.

## Frontend-структура

```
app/            страница = клиентский компонент + usePoll (fetch + интервал)
components/     shell (sidebar/bottom-nav/toasts), game (карточки, лента)
lib/api.ts      обёртка fetch с refresh-ретраем 401
lib/store.ts    zustand: me, баланс, язык, тосты
lib/i18n.ts     RU/EN словари (расширяемо)
```

Анимации: рулетка (CSS transform + cubic-bezier), колесо апгрейда (conic-gradient +
поворот указателя), контракт («куб» + вспышка). Учтён `prefers-reduced-motion`.

## SEO/доступность

Метаданные/OG в layout, тёмная тема, фокус-стили браузера, крупные tap-targets,
mobile bottom-nav, легальный футер на всех страницах.
