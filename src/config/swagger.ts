import swaggerJsdoc from "swagger-jsdoc";

const getServerUrl = () => {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "localhost";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  
  return `${protocol}://${host}:${port}/api`;
};

const servers = [
  {
    url: getServerUrl(),
    description:
      process.env.NODE_ENV === "production"
        ? "Production server"
        : "Development server",
  },
];

if (process.env.NODE_ENV === "production" && process.env.BASE_URL) {
  servers.push({
    url: "http://localhost:3000/api",
    description: "Local development server",
  });
}

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "SkyRush API",
    version: "1.0.0",
    description: "REST API для управления пользователями, аутентификации и работы с играми (Cases, Mines, Plinko, Bonus)",
    contact: {
      name: "API Support",
    },
  },
  servers,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT токен для авторизации",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Сообщение об ошибке",
          },
        },
      },
      User: {
        type: "object",
        properties: {
          username: {
            type: "string",
            example: "john_doe",
          },
          email: {
            type: "string",
            format: "email",
            example: "john@example.com",
          },
          balance: {
            type: "number",
            example: 1000,
          },
          totalWagered: {
            type: "number",
            example: 500,
          },
          gamesPlayed: {
            type: "number",
            example: 25,
          },
          totalWon: {
            type: "number",
            example: 300,
          },
        },
      },
      BonusStatusResponse: {
        type: "object",
        properties: {
          nextClaimAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T12:00:00Z",
          },
          amount: {
            type: "number",
            example: 10,
          },
          baseAmount: {
            type: "number",
            example: 10,
          },
          wagerBonus: {
            type: "number",
            example: 0,
          },
          gamesBonus: {
            type: "number",
            example: 0,
          },
        },
      },
      ClaimBonusResponse: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            example: 10,
          },
          balance: {
            type: "number",
            example: 1007.34,
          },
          nextClaimAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T12:01:00Z",
          },
        },
      },
    },
  },
  tags: [
    {
      name: "Auth",
      description: "Эндпоинты для аутентификации",
    },
    {
      name: "Users",
      description: "Эндпоинты для работы с пользователями",
    },
    {
      name: "Cases",
      description: "Эндпоинты для работы с кейсами (lootbox система)",
    },
    {
      name: "Mines",
      description: "Эндпоинты для игры Mines",
    },
    {
      name: "Plinko",
      description: "Эндпоинты для игры Plinko",
    },
    {
      name: "Bonus",
      description: "Эндпоинты для работы с бонусами",
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: [
    "./dist/modules/**/*.router.js",
    "./src/modules/**/*.router.ts",
    "./dist/modules/**/*.controller.js",
    "./src/modules/**/*.controller.ts",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

