# CaseArena API

Интерактивная документация: **`GET http://localhost:4000/docs`** (Swagger).

Формат ответов:

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "BALANCE_NOT_ENOUGH", "message": "...", "requestId": "uuid" } }
```

Аутентификация: HTTP-only cookies `ca_at` (access, 15 мин) + `ca_rt` (refresh, 30 дней,
ротация при каждом refresh). Также принимается `Authorization: Bearer <access>`.

## Эндпоинты

### auth
- `POST /api/auth/register` {email, username, password} → куки + welcome 2500 AP
- `POST /api/auth/login` {email, password}
- `POST /api/auth/refresh` — ротация сессии
- `POST /api/auth/logout`

### users
- `GET /api/users/me` — профиль + баланс + level
- `PATCH /api/users/me` {username?} | {password:{current,next}}
- `GET /api/users/:username` — публичный профиль

### cases
- `GET /api/cases?q=&category=&sort=` — каталог
- `GET /api/cases/:slug` — детали + предметы
- `GET /api/cases/:slug/odds` — честные шансы (%), EV, RTP
- `POST /api/cases/:slug/open` {count: 1..5} — авторизовано; списывает AP, создаёт предметы
- `GET /api/drops?limit=` — последние дропы (в т.ч. боты)

### inventory
- `GET /api/inventory?rarity=&source=&search=&favorite=&sort=`
- `PATCH /api/inventory/:id/favorite` {isFavorite}
- `POST /api/inventory/sell` {ids: uuid[]} — выкуп 30%

### upgrade
- `GET /api/upgrade/targets?sum=N` — доступные цели + честный шанс (bp)
- `POST /api/upgrade/run` {inventoryIds[1..5], targetItemId}
- `GET /api/upgrade/recent` — успешные апгрейды

### contracts
- `POST /api/contracts/preview` {inputCost} — пул исходов + шансы
- `POST /api/contracts/run` {inventoryIds[3..5]}

### daily
- `GET /api/daily` — статус, серия, таблица 7 дней
- `POST /api/daily/claim`

### прочее
- `GET /api/leaderboard?tab=xp|collection|opens|profit`
- `GET /api/stats/overview`
- `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`
- `POST /api/support/tickets`, `GET /api/support/tickets`, `POST /api/support/tickets/:id/messages`,
  `POST /api/support/tickets/:id/close`
- `GET /api/health`, `/api/health/live`, `/api/health/ready`

### admin (роль ADMIN/SUPER_ADMIN)
- `GET /api/admin/stats` — экономика: 14 дней burned/granted/net + totals
- `GET /api/admin/users?q=&page=`, `PATCH /api/admin/users/:id` {role?, isBot?, adjust?}
- `GET /api/admin/cases`, `PATCH /api/admin/cases/:id`, `PUT /api/admin/cases/:id/weights`
- `GET /api/admin/items`, `GET /api/admin/audit`
- `GET /api/admin/tickets`, `POST /api/admin/tickets/:id/messages`, `PATCH /api/admin/tickets/:id`

## Коды ошибок

`VALIDATION`, `UNAUTHORIZED`, `TOKEN_INVALID`, `BAD_CREDENTIALS`, `RATE_LIMITED`,
`EMAIL_TAKEN`, `USERNAME_TAKEN`, `BALANCE_NOT_ENOUGH`, `CASE_NOT_FOUND`, `CASE_EMPTY`,
`ITEMS_NOT_OWNED`, `TARGET_TOO_EXPENSIVE`, `TICKET_CLOSED`, `FORBIDDEN`, `NOT_FOUND`.
