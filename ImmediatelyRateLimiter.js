require('dotenv').config(); // Этот модуль позволяет загружать переменные окружения из файла .env
const express = require('express');
const { createClient } = require('@redis/client');   //Импортируем createClient из @redis/client

// Инициализация приложения Express
const app = express();

const axios = require('axios');

// Конфигурация клиента Redis
// Мы создаем клиента Redis с указанием параметров подключения (хост и порт). Эти параметры берутся из переменных среды (файл .env).
const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || '127.0.0.1', // Если REDIS_HOST не указан в .env, используется '127.0.0.1' по умолчанию.
        port: process.env.REDIS_PORT || 6379        // Если REDIS_PORT не указан в .env, используется 6379 по умолчанию.
    }
});

// Подключение к Redis
// Здесь используется самовызывающаяся асинхронная функция для выполнения асинхронного подключения.
// Мы используем try/catch для обработки ошибок, чтобы гарантировать, что программа корректно завершится, если Redis недоступен.
(async () => {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.error('Error connecting to Redis:', err);
        process.exit(1); // Завершаем процесс, если Redis недоступен
    }
})();

// Настройки ограничения запросов (берутся из .env или задаются по умолчанию)
// Конфигурация политики ограничения (в будущем будет приходить из RP Service)
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT) || 5;
const BUCKET_SIZE = parseInt(process.env.BUCKET_SIZE) || 5; // Размер bucket
const REFILL_RATE = parseInt(process.env.REFILL_RATE) || 1;  // Количество токенов в секунду
const TIME_WINDOW = parseInt(process.env.TIME_WINDOW) || 60; // Окно времени в секундах

const rlrEndpoints = [
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
];

// Отправка данных на RLR
async function sendToRLR(data) {
    for (const endpoint of rlrEndpoints) {
        try {
            await axios.post(`${endpoint}/sync`, data);
            console.log(`Data sent to ${endpoint}`);
        } catch (error) {
            console.error(`Failed to send data to ${endpoint}:`, error.message);
        }
    }
}

async function fetchPolicies() {
    try {
        const response = await axios.get('http://localhost:5000/policies');
        const policies = response.data;

        console.log('Обновлённые политики:', policies);
        // Сохраните их локально или используйте для обновления логики ограничения
    } catch (error) {
        console.error('Ошибка при получении политик:', error.message);
    }
}

// Опрос RP Service каждые 30 секунд
setInterval(fetchPolicies, 30000);

async function syncWithRLR(ip, count) {
    try {
        const response = await axios.post('http://localhost:4000/sync', {
            ip,
            bucket,
        });
        console.log('Синхронизация с RLR успешна:', response.data);
    } catch (error) {
        console.error('Ошибка синхронизации с RLR:', error.message);
    }
}

// Middleware для ограничения запросов
async function rateLimiter(req, res, next) {
    const ip = req.ip; // Получаем IP-адрес клиента
    const key = `rate_limit:${ip}`; // Генерируем уникальный ключ для хранения информации о запросах этого IP

    try {
        // Проверяем текущее количество запросов от данного IP
        const currentBucket  = await redisClient.get(key); // Получаем значение счетчика запросов из Redis
        // Если текущее количество запросов превышает лимит, блокируем пользователя
        if (currentBucket && parseInt(currentBucket) >= RATE_LIMIT) {

            console.log('Слишком много запросов. Bucket:', parseInt(currentBucket)); // Почему-то не выводится

            return res.status(429).json({ // Статус 429 — "Too Many Requests"
                message: 'Слишком много запросов. Пожалуйста, попробуйте позже.'
            });
        }

        const now = Date.now() / 1000; // Текущее время в секундах
        console.log('Время:', new Date(now * 1000).toLocaleString());

        let tokens = BUCKET_SIZE;
        let lastRequest = now;

        let bucket = { tokens: BUCKET_SIZE, lastRequest: now }; // Инициализация по умолчанию

        if (currentBucket) {
            bucket = JSON.parse(currentBucket);
            const timeDelta = now - bucket.lastRequest;

            tokens = Math.min(BUCKET_SIZE, bucket.tokens + timeDelta * REFILL_RATE);// Обновление токенов на основе времени
            bucket.lastRequest = now;
        }

        // Проверка на наличие токенов
        if (bucket.tokens < 1) { // Если токены закончились, возвращается ошибка 429
            return res.status(429).json({
                message: 'Слишком много запросов. Пожалуйста, попробуйте позже.',
            });
        }

        // Обновляем bucket (уменьшаем токены и сохраняем состояние)
        bucket.tokens -= 1;
        await redisClient.set(key, JSON.stringify(bucket));

        next(); // Продолжаем обработку запроса, если лимит не превышен
    } catch (error) {
        console.error('Ошибка в middleware rateLimiter:', error);
        res.status(500).json({
            message: 'Внутренняя ошибка сервера'
        });
    }
}

// Используем middleware для ограничения запросов
app.use(rateLimiter);

// Тестовый маршрут
// Этот маршрут обрабатывает запросы к корневому адресу `/`.
// Когда пользователь отправляет GET-запрос, сервер возвращает JSON-объект с сообщением.
app.get('/', (req, res) => {
    res.status(200).json({
        message : "Token Bucket Rate Limiter Active"
    });
});

// Запуск сервера
// Читаем порт из переменной окружения PORT, если не указано, используем 3000.
const PORT = process.env.PORT || 3000;
console.log(`.env.PORT`, process.env.PORT);
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
