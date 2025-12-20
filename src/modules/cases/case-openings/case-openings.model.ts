import { Schema, model } from "mongoose";
import { ICaseOpening } from "./case-openings.types";

/**
 * Mongoose схема для модели CaseOpening (История открытий кейсов)
 *
 * Эта модель хранит полную историю всех открытий кейсов в системе.
 * Каждая запись содержит информацию о том, кто открыл кейс, какой кейс был открыт,
 * какой предмет выпал, и все данные для проверки честности результата (Provably Fair).
 *
 * Основные цели:
 * 1. Аудит - можно отследить все открытия кейсов
 * 2. Provably Fair - пользователь может проверить честность результата, используя seeds
 * 3. Статистика - можно анализировать выпадения предметов
 * 4. Восстановление истории - если нужно показать пользователю его предыдущие открытия
 */
const caseOpeningSchema = new Schema<ICaseOpening>(
  {
    // ID кейса, который был открыт
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },

    // ID пользователя, который открыл кейс
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // ID предмета, который выпал при открытии
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },

    // Сгенерированное значение roll (от 0 до 1), которое определило выигрышный предмет
    // Это значение было вычислено функцией generateRoll на основе seeds и nonce
    rollValue: { type: Number, required: true },

    // Server seed, который использовался для генерации rollValue
    // Этот seed был известен только серверу на момент генерации,
    // но после открытия может быть раскрыт пользователю для проверки
    serverSeed: { type: String, required: true },

    // Client seed, который использовался для генерации rollValue
    // Может быть установлен пользователем или сгенерирован автоматически
    clientSeed: { type: String, required: true },

    // Номер игры пользователя (nonce), который использовался для генерации
    // Уникален для каждой игры конкретного пользователя
    nonce: { type: Number, required: true },

    // Дата и время открытия кейса
    createdAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false, // Отключаем поле __v, так как записи истории не изменяются
    timestamps: false, // Используем ручное управление createdAt
  }
);

/**
 * Создаем составной индекс по userId и createdAt (в порядке убывания)
 *
 * Этот индекс оптимизирует запросы вида:
 * - "Найти все открытия конкретного пользователя"
 * - "Найти последние N открытий пользователя" (отсортированные по дате)
 *
 * Порядок: userId: 1 (по возрастанию), createdAt: -1 (по убыванию)
 * Это позволяет быстро получать историю открытий пользователя, отсортированную от новых к старым
 */
caseOpeningSchema.index({ userId: 1, createdAt: -1 });

/**
 * Модель CaseOpening для работы с коллекцией "caseopenings" в MongoDB
 * Используется для хранения истории всех открытий кейсов
 */
export const CaseOpening = model<ICaseOpening>(
  "CaseOpening",
  caseOpeningSchema
);
