const express = require('express');
const RateLimiterRoot  = require('./RateLimiterRoot');

const app = express();
app.use(express.json());

const RLR = new RateLimiterRoot (1, 100); // refillRate = 1 токен/сек, bucketSize = 100

// Маршрут для синхронизации с другими RLR
app.post('/sync', (req, res) => {
    const syncData = req.body;
    RLR.processSyncData(syncData); // Обрабатываем данные от других RLR
    res.status(200).json({ message: 'Sync data processed successfully' });
});

// Тестовый маршрут для локального использования токенов
app.post('/consume', (req, res) => {
    const { count } = req.body;
    const success = RLR.consumeTokens(count);

    if (success) {
        res.status(200).json({ message: 'Tokens consumed successfully' });
    } else {
        res.status(429).json({ message: 'Not enough tokens' });
    }
});

// Периодическая синхронизация с другими RLR
const peers = ['http://localhost:3001', 'http://localhost:3002']; // Пример списка соседей
setInterval(() => {
    RLR.syncWithPeers(peers);
}, 5000); // Синхронизация каждые 5 секунд

// Запуск сервера
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`RLR running on port ${PORT}`);
});
