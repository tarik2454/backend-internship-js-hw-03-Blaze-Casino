# Backend API Documentation

REST API для управления пользователями и аутентификации. Проект написан на TypeScript с использованием Express.js и MongoDB.

## Технологии

- **TypeScript** - типизированный JavaScript
- **Express.js** - веб-фреймворк для Node.js
- **MongoDB** (Mongoose) - база данных
- **JWT** - токены для аутентификации
- **bcryptjs** - хеширование паролей
- **Joi** - валидация данных

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

Базовый URL: `http://localhost:3000/api/users`

### Аутентификация

#### Регистрация нового пользователя

**POST** `/register`

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

**POST** `/login`

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

**POST** `/logout`

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

### Пользователи

Все эндпоинты пользователей требуют авторизации через JWT токен.

#### Получить текущего пользователя

**GET** `/current`

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

**PATCH** `/update`

Обновляет информацию о текущем пользователе.

**Заголовки:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Тело запроса:**

```json
{
  "username": "string (2-20 символов, обязательное)",
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

Токен получается при успешной авторизации через эндпоинт `/login`. Токен действителен в течение 23 часов.

## Коды ошибок

- `400` - Bad Request - Неверный формат данных запроса
- `401` - Unauthorized - Требуется авторизация или неверные учетные данные
- `404` - Not Found - Ресурс не найден
- `409` - Conflict - Конфликт данных (например, email уже используется)
- `500` - Internal Server Error - Внутренняя ошибка сервера

## Структура проекта

```
├── controllers/        # Контроллеры (логика обработки запросов)
│   ├── auth-controller.ts
│   └── user-controller.ts
├── routes/            # Маршруты API
│   └── api/
│       ├── auth-router.ts
│       └── user-router.ts
├── models/            # Модели данных (Mongoose)
│   └── User.ts
├── schemas/           # Схемы валидации (Joi)
│   └── user-schemas.ts
├── middlewares/       # Промежуточное ПО
│   ├── authenticate.ts
│   └── isValidId.ts
├── decorators/        # Декораторы
│   ├── ctrlWrapper.ts
│   └── validateBody.ts
├── helpers/           # Вспомогательные функции
│   └── HttpError.ts
├── types/             # TypeScript типы
│   └── index.d.ts
├── app.ts             # Конфигурация Express приложения
├── index.ts           # Точка входа
└── tsconfig.json      # Конфигурация TypeScript
```

## Скрипты

- `npm run dev` - Запуск в режиме разработки с автоматической перезагрузкой
- `npm run build` - Компиляция TypeScript в JavaScript
- `npm start` - Запуск скомпилированного приложения
- `npm run lint` - Проверка кода линтером
- `npm run lint:fix` - Автоматическое исправление ошибок линтера
- `npm test` - Запуск тестов

## Лицензия

Private project
