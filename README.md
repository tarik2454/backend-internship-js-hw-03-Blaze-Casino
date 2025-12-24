# Backend API Documentation

REST API для управления пользователями, аутентификации и работы с кейсами (lootbox система). Проект написан на TypeScript с использованием Express.js и MongoDB.

## Технологии

- **TypeScript** - типизированный JavaScript
- **Express.js** - веб-фреймворк для Node.js
- **MongoDB** (Mongoose) - база данных
- **JWT** - токены для аутентификации
- **bcryptjs** - хеширование паролей
- **Zod** - валидация данных

## Установка и запуск

### Требования

- Node.js 24.x
- MongoDB

### Установка зависимостей

```bash
npm install
```

### Настройка окружения

Создайте файл `.env` в корне проекта:

```env
PORT=3000
DB_HOST=mongodb://localhost:27017/your_database_name
JWT_SECRET=your_secret_key
NODE_ENV=development
```

### Запуск проекта

**Режим разработки:**

```bash
npm run dev
```

**Сборка проекта:**

```bash
npm run build
```

**Продакшн:**

```bash
npm start
```

## API Endpoints

Базовый URL: `http://localhost:3000/api`

Все эндпоинты (кроме регистрации и входа) требуют авторизации через JWT токен в заголовке `Authorization: Bearer <token>`.

### Аутентификация

Базовый путь: `/auth`

#### Регистрация нового пользователя

**POST** `/auth/register`

Создает нового пользователя в системе.

**Заголовки:**

```
Content-Type: application/json
```

**Тело запроса:**

```json
{
  "username": "string (2-20 символов, обязательное)",
  "email": "string (валидный email, обязательное)",
  "password": "string (минимум 6 символов, обязательное)"
}
```

**Пример запроса:**

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Успешный ответ (201):**

```json
{
  "username": "john_doe",
  "email": "john@example.com"
}
```

**Ошибки:**

- `400` - Неверный формат данных
- `409` - Email уже используется

---

#### Вход в систему

**POST** `/auth/login`

Авторизует пользователя и возвращает JWT токен.

**Заголовки:**

```
Content-Type: application/json
```

**Тело запроса:**

```json
{
  "email": "string (валидный email, обязательное)",
  "password": "string (минимум 6 символов, обязательное)"
}
```

**Пример запроса:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Успешный ответ (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Ошибки:**

- `400` - Неверный формат данных
- `401` - Неверный email или пароль

---

#### Выход из системы

**POST** `/auth/logout`

Выходит из системы, очищая токен пользователя.

**Заголовки:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Тело запроса:** отсутствует

**Успешный ответ (200):**

```json
{
  "message": "Logout success"
}
```

**Ошибки:**

- `401` - Не авторизован (отсутствует или неверный токен)

---

### Кейсы (Cases)

Базовый путь: `/cases`

Модуль для работы с кейсами (lootbox-системой). Все эндпоинты требуют авторизации.

#### Получить список всех кейсов

**GET** `/cases`

Возвращает список всех доступных кейсов в системе.

**Заголовки:**

```
Authorization: Bearer <token>
```

**Тело запроса:** отсутствует

**Успешный ответ (200):**

```json
{
  "cases": [
    {
      "id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Starter Case",
      "price": 100,
      "image": "https://example.com/case-image.jpg",
      "items": []
    },
    {
      "id": "65a1b2c3d4e5f6g7h8i9j0k2",
      "name": "Premium Case",
      "price": 500,
      "image": "https://example.com/premium-case.jpg",
      "items": []
    }
  ]
}
```

**Ошибки:**

- `401` - Не авторизован

---

#### Получить детальную информацию о кейсе

**GET** `/cases/:id`

Возвращает детальную информацию о конкретном кейсе, включая список всех предметов, которые могут выпасть, с их шансами выпадения.

**Заголовки:**

```
Authorization: Bearer <token>
```

**Параметры URL:**

- `id` - ID кейса (MongoDB ObjectId)

**Тело запроса:** отсутствует

**Успешный ответ (200):**

```json
{
  "id": "65a1b2c3d4e5f6g7h8i9j0k1",
  "name": "Starter Case",
  "price": 100,
  "items": [
    {
      "id": "65a1b2c3d4e5f6g7h8i9j0a1",
      "name": "AK-47 Redline",
      "rarity": "Rare",
      "value": 50,
      "chance": 15.5
    },
    {
      "id": "65a1b2c3d4e5f6g7h8i9j0a2",
      "name": "Knife Butterfly",
      "rarity": "Legendary",
      "value": 500,
      "chance": 0.5
    }
  ]
}
```

**Ошибки:**

- `401` - Не авторизован
- `404` - Кейс не найден или неверный формат ID

---

#### Открыть кейс

**POST** `/cases/:id/open`

Открывает кейс для текущего авторизованного пользователя. Использует Provably Fair алгоритм для определения выпавшего предмета. Списывает стоимость кейса с баланса пользователя.

**Заголовки:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Параметры URL:**

- `id` - ID кейса для открытия (MongoDB ObjectId)

**Тело запроса (опционально):**

```json
{
  "clientSeed": "my_custom_seed_string"
}
```

Если `clientSeed` не указан, он будет сгенерирован автоматически.

**Пример запроса:**

```json
{
  "clientSeed": "my_seed_123"
}
```

**Успешный ответ (200):**

```json
{
  "openingId": "65a1b2c3d4e5f6g7h8i9j0o1",
  "item": {
    "id": "65a1b2c3d4e5f6g7h8i9j0a1",
    "name": "AK-47 Redline",
    "rarity": "Rare",
    "image": "https://example.com/ak47-redline.jpg",
    "value": 50
  },
  "serverSeed": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "clientSeed": "my_seed_123",
  "nonce": 25,
      "roll": 0.723456789,
      "newBalance": 950,
      "casePrice": 100,
      "itemValue": 50
}
```

**Поля ответа:**

- `openingId` - ID записи об открытии (можно использовать для проверки или просмотра истории)
- `item` - Информация о выпавшем предмете
- `serverSeed` - Server seed, использованный для генерации результата (для Provably Fair проверки)
- `clientSeed` - Client seed, использованный для генерации результата
- `nonce` - Номер игры пользователя (использовался как nonce)
- `roll` - Сгенерированное значение (от 0 до 1), которое определило выигрышный предмет

**Provably Fair (Доказуемо честный алгоритм):**

Результат открытия кейса можно проверить на честность. Все данные для проверки возвращаются в ответе. Алгоритм использует комбинацию `serverSeed`, `clientSeed` и `nonce` для генерации случайного числа, которое определяет выпавший предмет.

**Ошибки:**

- `400` - Недостаточно баланса для открытия кейса, кейс пустой или неверный формат данных
- `401` - Не авторизован
- `404` - Кейс не найден или неверный формат ID

**Примечание:** После успешного открытия кейса:

- С баланса пользователя списывается стоимость кейса
- Обновляется статистика: `totalWagered`, `gamesPlayed`, `totalWon`
- Создается запись в истории открытий

---

### Мины (Mines)

Базовый путь: `/mines`

Модуль для игры "Mines" (аналог сапера). Все эндпоинты требуют авторизации.

#### Начать новую игру

**POST** `/mines/start`

Создает новую сессию игры Mines. Списывает ставку с баланса.

**Тело запроса:**

```json
{
  "amount": 10,
  "minesCount": 3,
  "clientSeed": "optional_client_seed"
}
```

- `amount`: Сумма ставки (0.10 - 10000)
- `minesCount`: Количество мин (1-24)

**Успешный ответ (201):**

```json
{
  "gameId": "65b...",
  "amount": 10,
  "minesCount": 3,
  "serverSeedHash": "hash...",
  "multipliers": [1.03, 1.08, ...]
}
```

---

#### Открыть ячейку

**POST** `/mines/reveal`

Открывает выбранную ячейку.

**Тело запроса:**

```json
{
  "gameId": "65b...",
  "position": 5
}
```

- `position`: Номер ячейки (0-24)

**Успешный ответ (200):**

```json
{
  "position": 5,
  "isMine": false,
  "currentMultiplier": 1.03,
  "currentValue": 10.30,
  "revealedTiles": [5],
  "safeTilesLeft": 21
}
```

Если попали на мину, `isMine` будет `true`, и игра завершится.

---

#### Забрать выигрыш (Cashout)

**POST** `/mines/cashout`

Завершает игру и зачисляет выигрыш на баланс.

**Тело запроса:**

```json
{
  "gameId": "65b..."
}
```

**Успешный ответ (200):**

```json
{
  "winAmount": 15.50,
  "multiplier": 1.55,
  "serverSeed": "original_server_seed",
  "minePositions": [0, 12, 24]
}
```

---

#### Получить активную игру

**GET** `/mines/active`

Возвращает текущую активную игру пользователя, если она есть.

**Успешный ответ (200):**

```json
{
  "game": { ... } // или null
}
```

---

#### История игр

**GET** `/mines/history`

Возвращает историю игр пользователя.

**Query параметры:**
- `limit`: Максимальное количество записей (default: 10)
- `offset`: Смещение (default: 0)

---

### Plinko

Базовый путь: `/plinko`

Модуль для игры Plinko. Все эндпоинты требуют авторизации.

#### Запустить игру (Drop)

**POST** `/plinko/drop`

Запускает игру Plinko с указанными параметрами. Списывает общую ставку (amount × balls) с баланса и возвращает результаты для всех шариков.

**Тело запроса:**

```json
{
  "amount": 1.0,
  "balls": 1,
  "risk": "medium",
  "lines": 16
}
```

- `amount`: Ставка за одну кульку (0.10 - 100)
- `balls`: Количество кульок (1, 2, 5, 10)
- `risk`: Уровень риска ("low", "medium", "high")
- `lines`: Количество рядов кілочків (8-16)

**Успешный ответ (200):**

```json
{
  "drops": [
    {
      "dropId": "65b...",
      "path": [0, 1, 1, 0, 1, 0, 0, 1, ...],
      "slotIndex": 8,
      "multiplier": 1.5,
      "winAmount": 1.5,
      "serverSeed": "seed...",
      "clientSeed": "seed...",
      "nonce": 25
    }
  ],
  "totalBet": 1.0,
  "totalWin": 1.5,
  "newBalance": 1000.5
}
```

**Ошибки:**

- `400` - Недостаточно баланса или неверные параметры
- `401` - Не авторизован

---

#### Получить множители

**GET** `/plinko/multipliers?risk=medium&lines=16`

Возвращает массив множителей для указанной конфигурации.

**Query параметры:**

- `risk`: Уровень риска ("low", "medium", "high") - обязательное
- `lines`: Количество рядов (8-16) - обязательное

**Успешный ответ (200):**

```json
{
  "multipliers": [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110]
}
```

**Ошибки:**

- `400` - Неверные параметры запроса
- `401` - Не авторизован

---

#### История игр

**GET** `/plinko/history?limit=10&offset=0`

Возвращает историю игр пользователя.

**Query параметры:**

- `limit`: Максимальное количество записей (default: 10, max: 50)
- `offset`: Смещение (default: 0)

**Успешный ответ (200):**

```json
{
  "drops": [
    {
      "_id": "65b...",
      "betAmount": 1.0,
      "ballsCount": 1,
      "riskLevel": "medium",
      "linesCount": 16,
      "totalWin": 1.5,
      "avgMultiplier": "1.50",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### Последние игры всех игроков

**GET** `/plinko/recent`

Возвращает последние 20 игр всех игроков (для live feed).

**Успешный ответ (200):**

```json
{
  "drops": [
    {
      "_id": "65b...",
      "userId": {
        "_id": "65a...",
        "username": "player1"
      },
      "betAmount": 1.0,
      "ballsCount": 1,
      "riskLevel": "medium",
      "linesCount": 16,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Бонусы (Bonus)

Базовый путь: `/bonus`

Модуль для работы с ежеминутными бонусами. Все эндпоинты требуют авторизации.

#### Получить статус бонуса

**GET** `/bonus/status`

Возвращает информацию о доступном бонусе и времени следующего получения.

**Заголовки:**

```
Authorization: Bearer <token>
```

**Тело запроса:** отсутствует

**Успешный ответ (200):**

```json
{
  "nextClaimAt": "2024-01-15T12:00:00Z",
  "amount": 10,
  "baseAmount": 10,
  "wagerBonus": 0,
  "gamesBonus": 0
}
```

**Поля ответа:**

- `nextClaimAt` - Время, когда можно будет забрать следующий бонус (ISO 8601)
- `amount` - Общая сумма доступного бонуса
- `baseAmount` - Базовая сумма бонуса
- `wagerBonus` - Бонус за вагер (в текущей реализации всегда 0)
- `gamesBonus` - Бонус за игры (в текущей реализации всегда 0)

**Ошибки:**

- `401` - Не авторизован

---

#### Забрать бонус

**POST** `/bonus/claim`

Забирает ежеминутный бонус. Начисляет 10 долларов на баланс пользователя. Следующий бонус можно забрать через 60 секунд после предыдущего.

**Заголовки:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Тело запроса:** отсутствует

**Успешный ответ (200):**

```json
{
  "amount": 10,
  "balance": 1007.34,
  "nextClaimAt": "2024-01-15T12:01:00Z"
}
```

**Поля ответа:**

- `amount` - Сумма полученного бонуса (всегда 10)
- `balance` - Новый баланс пользователя после начисления бонуса
- `nextClaimAt` - Время, когда можно будет забрать следующий бонус (через 60 секунд)

**Ошибки:**

- `401` - Не авторизован
- `429` - Слишком рано для получения следующего бонуса (сообщение содержит оставшееся время в секундах)

**Примечание:** После успешного получения бонуса:

- На баланс пользователя начисляется 10 долларов
- Создается запись в истории выдачи бонусов (`BonusClaim`)
- Следующий бонус можно забрать через 60 секунд

---

### Пользователи

Базовый путь: `/users`

Все эндпоинты требуют авторизации через JWT токен.

#### Получить текущего пользователя

**GET** `/users/current`

Возвращает информацию о текущем авторизованном пользователе.

**Заголовки:**

```
Authorization: Bearer <token>
```

**Тело запроса:** отсутствует

**Успешный ответ (200):**

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "balance": 1000,
  "totalWagered": 500,
  "gamesPlayed": 25,
  "totalWon": 300
}
```

**Ошибки:**

- `401` - Не авторизован

---

#### Получить всех пользователей

**GET** `/users`

Возвращает список всех пользователей с их базовой информацией.

**Заголовки:**

```
Authorization: Bearer <token>
```

**Тело запроса:** отсутствует

**Успешный ответ (200):**

```json
[
  {
    "username": "john_doe",
    "gamesPlayed": 25,
    "balance": 1000
  },
  {
    "username": "jane_doe",
    "gamesPlayed": 15,
    "balance": 750
  }
]
```

**Ошибки:**

- `401` - Не авторизован

---

#### Обновить данные пользователя

**PATCH** `/users/update`

Обновляет информацию о текущем пользователе.

**Заголовки:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Тело запроса:**

Все поля опциональны. Можно обновить только те поля, которые нужно изменить.

```json
{
  "username": "string (2-20 символов, опционально)",
  "balance": "number (опционально)",
  "totalWagered": "number (опционально)",
  "gamesPlayed": "number (целое число, опционально)",
  "totalWon": "number (опционально)"
}
```

**Пример запроса:**

```json
{
  "username": "john_updated",
  "balance": 1500,
  "gamesPlayed": 30
}
```

**Успешный ответ (200):**

```json
{
  "username": "john_updated",
  "email": "john@example.com",
  "balance": 1500,
  "totalWagered": 500,
  "gamesPlayed": 30,
  "totalWon": 300
}
```

**Ошибки:**

- `400` - Неверный формат данных
- `401` - Не авторизован
- `404` - Пользователь не найден

---

## Авторизация

Большинство эндпоинтов требуют JWT токен для доступа. Токен должен быть передан в заголовке `Authorization` в следующем формате:

```
Authorization: Bearer <your_jwt_token>
```

Токен получается при успешной авторизации через эндпоинт `/api/auth/login`. Токен действителен в течение 23 часов.

### Эндпоинты, не требующие авторизации:

- `POST /api/auth/register` - Регистрация нового пользователя
- `POST /api/auth/login` - Вход в систему

### Эндпоинты, требующие авторизации:

- Все эндпоинты `/api/users/*`
- Все эндпоинты `/api/cases/*`
- Все эндпоинты `/api/mines/*`
- Все эндпоинты `/api/plinko/*`
- Все эндпоинты `/api/bonus/*`
- `POST /api/auth/logout` - Выход из системы

## Коды ошибок

- `400` - Bad Request - Неверный формат данных запроса
- `401` - Unauthorized - Требуется авторизация или неверные учетные данные
- `404` - Not Found - Ресурс не найден
- `409` - Conflict - Конфликт данных (например, email уже используется)
- `500` - Internal Server Error - Внутренняя ошибка сервера

## Структура проекта

Проект использует модульную архитектуру, где каждый модуль содержит всю логику для определенной функциональности.

```
src/
├── modules/           # Модули приложения (feature-based архитектура)
│   ├── auth/         # Модуль аутентификации
│   │   ├── auth.controller.ts
│   │   ├── auth.router.ts
│   │   └── ...
│   ├── users/        # Модуль пользователей
│   │   ├── users.controller.ts
│   │   ├── users.router.ts
│   │   ├── users.schema.ts
│   │   ├── models/
│   │   │   ├── users.model.ts
│   │   │   └── users.types.ts
│   ├── cases/        # Модуль кейсов (lootbox система)
│   │   ├── cases.controller.ts
│   │   ├── cases.router.ts
│   │   ├── cases.service.ts
│   │   ├── cases.utils.ts
│   │   ├── cases.schema.ts
│   │   ├── cases.types.ts
│   │   └── models/
│   │       ├── cases/
│   │       │   ├── cases.model.ts
│   │       │   └── cases.types.ts
│   │       ├── items/
│   │       │   ├── items.model.ts
│   │       │   └── items.types.ts
│   │       ├── rarities/
│   │       │   ├── rarities.model.ts
│   │       │   └── rarities.types.ts
│   │       ├── case-items/
│   │       │   ├── case-items.model.ts
│   │       │   └── case-items.types.ts
│   │       └── case-openings/
│   │           ├── case-openings.model.ts
│   │           └── case-openings.types.ts
│   ├── mines/        # Модуль игры Mines
│   │   ├── mines.controller.ts
│   │   ├── mines.router.ts
│   │   ├── mines.service.ts
│   │   ├── mines.utils.ts
│   │   ├── mines.schema.ts
│   │   └── models/
│   │       ├── mines.model.ts
│   │       └── mines.types.ts
│   └── plinko/       # Модуль игры Plinko
│       ├── plinco.controller.ts
│       ├── plinco.router.ts
│       ├── plinko.service.ts
│       ├── plinko.schema.ts
│       └── models/
│           ├── plinko-drops/
│           │   ├── plinko-drops.model.ts
│           │   └── plinko-drops.types.ts
│           ├── plinko-results/
│           │   ├── plinko-results.model.ts
│           │   └── plinko-results.types.ts
│           └── plinko-multipliers/
│               ├── plinko-multipliers.model.ts
│               └── plinko-multipliers.types.ts
│   └── bonus/        # Модуль бонусов
│       ├── bonus.controller.ts
│       ├── bonus.router.ts
│       ├── bonus.service.ts
│       ├── bonus.types.ts
│       └── models/
│           ├── bonus-claims/
│           │   ├── bonus-claims.model.ts
│           │   └── bonus-claims.types.ts
│           └── bonus-settings/
│               ├── bonus-settings.model.ts
│               └── bonus-settings.types.ts
├── middlewares/      # Промежуточное ПО (общее для всех модулей)
│   ├── authenticate.ts
│   └── isValidId.ts
├── decorators/       # Декораторы для контроллеров
│   ├── ctrlWrapper.ts
│   └── validateBody.ts
├── helpers/          # Вспомогательные функции
│   ├── HttpError.ts
│   └── mongooseHooks.ts
├── types/            # Глобальные TypeScript типы
│   └── index.ts
├── scripts/          # Скрипты для работы с БД
│   ├── seed-rarities.ts
│   └── seed-complete.ts
├── app.ts            # Конфигурация Express приложения
├── index.ts          # Точка входа
└── tsconfig.json     # Конфигурация TypeScript
```

## Скрипты

- `npm run dev` - Запуск в режиме разработки с автоматической перезагрузкой
- `npm run build` - Компиляция TypeScript в JavaScript
- `npm start` - Запуск скомпилированного приложения
- `npm run lint` - Проверка кода линтером
- `npm run lint:fix` - Автоматическое исправление ошибок линтера
- `npm test` - Запуск тестов
- `npm run seed:rarities` - Заполнение базы данных базовыми редкостями (Common, Rare, Epic, Legendary, etc.)
- `npm run seed:complete` - Полное заполнение базы данных (редкости, предметы, кейсы)

## Лицензия

Private project
