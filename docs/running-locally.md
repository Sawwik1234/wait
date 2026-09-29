# Запуск CaseArena локально (VS Code)

## Что нужно

- **Node.js 20+** (`node -v`) — https://nodejs.org
- **Git** и **VS Code**
- Docker НЕ обязателен (dev-профиль использует SQLite-файл)
- Для Steam-входа локально ничего не нужно: OpenID-редирект работает и с `localhost`

## 1. Клонировать репозиторий

Приватный репо — нужна аутентификация (один раз):

```bash
# вариант A: GitHub CLI
gh auth login
gh repo clone Sawwik1234/wait

# вариант B: git + токен (PAT со scope repo)
git clone https://<ТОКЕН>@github.com/Sawwik1234/wait.git
```

## 2. Открыть в VS Code

```bash
cd wait
code .
```

VS Code предложит установить рекомендованные расширения (Prisma, Tailwind, ESLint) — согласись.

## 3. (Опционально) Файлы окружения

**Проект работает вообще без `.env`**: SQLite-дефолт, код админа `ARENA-777-KEY`
и все прочие значения уже встроены. Просто пропусти этот шаг.

Если хочешь переопределить (свой порт, пароль админа и т.п.):

```bash
cp .env.example .env        # Git Bash / macOS / Linux
# PowerShell: Copy-Item .env.example .env
```

В проде обязательно смени `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SECRET_CODE`.

> Раньше создавал `apps/api/.env` по старой инструкции? Удали его — теперь
> единственный источник — `apps/api/prisma/.env` (уже в репо). Два файла с
> `DATABASE_URL` конфликтуют: `Error: conflict between env var in .env and prisma\.env`.

## 4. Установка и БД

```bash
npm install
npm run setup        # = install + prisma db push + seed (SQLite)
```

> **npm предупреждает про install-scripts (allowScripts)?** Это новая защита npm.
> Скрипты Prisma/esbuild можно безопасно разрешить:
> `npm install-scripts approve @prisma/client @prisma/engines prisma esbuild @scarf/scarf`
> — либо просто проигнорируй: нужный клиент сгенерируется на шаге `db push` сам.

### Windows: ошибка PowerShell «выполнение сценариев отключено»

Это политика выполнения Windows, блокирующая `npm.ps1`. Лечение любое из:

1. Один раз в PowerShell (можно прямо в терминале VS Code):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```
   затем перезапусти терминал;
2. либо используй терминал **Git Bash** или **cmd** вместо PowerShell
   (в VS Code: `Ctrl+Shift+P` → «Terminal: Select Default Profile»);
3. Задачи VS Code (`Ctrl+Shift+B`) уже настроены на cmd.exe — работают без правок.

## 5. Запуск

**Вариант А — одной задачей:** `Terminal → Run Task… → ▶ CaseArena: full stack`
(или `Ctrl+Shift+B`).

**Вариант Б — отладка с брейкпоинтами:** `Run and Debug (F5) → ▶ Debug: API + Web`.

**Вариант В — два терминала:**

```bash
npm run dev:api   # терминал 1 → http://localhost:4000 (Swagger: /docs)
npm run dev:web   # терминал 2 → http://localhost:3000
```

Открой **http://localhost:3000**.

## Вход

| Кто | Как |
|---|---|
| Игрок | Кнопка «Войти через Steam» (OpenID; аккаунт создастся сам, +2500 AP) |
| Админ | `admin@casearena.local` / `Admin#12345` / секретный код `ARENA-777-KEY` |

## Полезное

```bash
npm run test -w api     # юнит-тесты (экономика + бои)
npm run db:seed -w api  # пересидеть базу (сбросит игроков/предметы)
```

Прод-профиль (PostgreSQL + Docker): см. README, раздел «Прод (Docker)» —
в `docker-compose.yml` уже есть postgres/api/web/nginx.

## Частые проблемы

| Симптом | Причина/решение |
|---|---|
| `PrismaClient did not initialize` | нет `DATABASE_URL` — см. шаг 3 |
| 401 на всех запросах | не сидирована база или устаревший токен — перелогинься |
| Порт занят | `PORT=4001` в корневом `.env` для API; веб: `npm run dev:web -- -p 3001` |
| Steam-вход не возвращает | проверь, что открыт именно `localhost:3000`, а не IP/127.0.0.1 |
