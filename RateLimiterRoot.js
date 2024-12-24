const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

class RateLimiterRoot {
    constructor(refillRate, bucketSize) {
        this.irlId = uuidv4(); // Уникальный идентификатор
        this.refillRate = refillRate; // Скорость пополнения токенов
        this.bucketSize = bucketSize; // Максимальное количество токенов
        this.tokensAvailable = bucketSize; // Текущее количество токенов
        this.refillTs = Date.now(); // Время последнего пополнения
        this.CRDT = {}; // CRDT-счетчик для синхронизации
        this.localTokensConsumed = 0; // Локально использованные токены
    }

    // Пополнение токенов
    refillTokens() {
        const now = Date.now();
        const timeDelta = (now - this.refillTs) / 1000; // В секундах
        const newTokens = Math.floor(timeDelta * this.refillRate);
        this.tokensAvailable = Math.min(this.bucketSize, this.tokensAvailable + newTokens);
        this.refillTs = now;
    }

    // Локальное потребление токенов
    consumeTokens(count) {
        this.refillTokens(); // Пополняем перед потреблением
        if (this.tokensAvailable >= count) {
            this.tokensAvailable -= count;
            this.localTokensConsumed += count;
            return true;
        }
        return false; // Недостаточно токенов
    }

    // Синхронизация с другим RLR
    async syncWithPeers(peers) {
        this.refillTokens(); // Пополняем перед синхронизацией

        // Собираем данные для отправки
        const syncData = {
            irlId: this.irlId,
            localTokensConsumed: this.localTokensConsumed,
            tokensAvailable: this.tokensAvailable,
            refillTs: this.refillTs,
        };

        // Отправляем данные всем другим RLR
        for (const peer of peers) {
            try {
                await axios.post(`${peer}/sync`, syncData);
            } catch (error) {
                console.error(`Ошибка синхронизации с узлом ${peer}:`, error.message);
            }
        }
    }

    // Обработка входящих данных от другого RLR
    processSyncData(syncData) {
        const { irlId, localTokensConsumed, tokensAvailable, refillTs } = syncData;

        // Если узел уже есть в CRDT, обновляем данные
        if (this.CRDT[irlId]) {
            const existingData = this.CRDT[irlId];
            this.CRDT[irlId] = {
                localTokensConsumed: Math.max(existingData.localTokensConsumed, localTokensConsumed),
                tokensAvailable: Math.max(existingData.tokensAvailable, tokensAvailable),
                refillTs: Math.max(existingData.refillTs, refillTs),
            };
        } else {
            // Если узел новый, добавляем его в CRDT
            this.CRDT[irlId] = { localTokensConsumed, tokensAvailable, refillTs };
        }

        // Пересчитываем локальные токены на основе CRDT
        this.recalculateTokens();
    }

    // Перерасчет токенов на основе CRDT
    recalculateTokens() {
        this.tokensAvailable = this.bucketSize; // Сбрасываем локальные токены

        for (const key in this.CRDT) {
            const data = this.CRDT[key];
            this.tokensAvailable -= data.localTokensConsumed; // Учитываем потребленные токены
        }

        this.tokensAvailable = Math.max(0, this.tokensAvailable); // Токены не могут быть отрицательными
    }
}

module.exports = RateLimiterRoot;
