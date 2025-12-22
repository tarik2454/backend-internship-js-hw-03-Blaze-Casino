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
  "roll": 0.723456789
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
│   │   ├── users.model.ts
│   │   ├── users.schema.ts
│   │   ├── users.types.ts
│   │   └── ...
│   ├── cases/        # Модуль кейсов (lootbox система)
│   │   ├── cases.controller.ts
│   │   ├── cases.router.ts
│   │   ├── cases.service.ts
│   │   ├── cases.utils.ts
│   │   ├── cases.schema.ts
│   │   ├── cases.model.ts
│   │   ├── cases.types.ts
│   │   ├── case-items/       # Подмодуль связи кейс-предмет
│   │   │   ├── case-items.model.ts
│   │   │   └── case-items.types.ts
│   │   ├── case-openings/    # Подмодуль истории открытий
│   │   │   ├── case-openings.model.ts
│   │   │   └── case-openings.types.ts
│   │   ├── items/            # Подмодуль предметов
│   │   │   ├── items.model.ts
│   │   │   └── items.types.ts
│   │   └── rarities/         # Подмодуль редкостей
│   │       ├── rarities.model.ts
│   │       └── rarities.types.ts
│   └── mines/        # Модуль игры Mines
│       ├── mines.controller.ts
│       ├── mines.router.ts
│       ├── mines.service.ts
│       ├── mines.utils.ts
│       ├── mines.schema.ts
│       ├── mines.model.ts
│       └── mines.types.ts
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
