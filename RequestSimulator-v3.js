const axios = require('axios');

// Конфигурация по умолчанию
const BASE_URL = 'http://localhost:3000';
const SERVICE_NAME = 'test-service';
let getRequestCount = 5; // Количество GET запросов за итерацию
let postRequestCount = 3; // Количество POST запросов за итерацию
let duration = 60; // Продолжительность работы (в секундах)
let interval = 1000; // Интервал между итерациями (в миллисекундах)

// Функция для отправки GET-запросов
async function sendGetRequest() {
    try {
        const response = await axios.get(BASE_URL, {
            headers: {
                'service-name': SERVICE_NAME,
            },
        });
        console.log('[GET] Ответ от сервера:', response.data);
    } catch (error) {
        console.error('[GET] Ошибка:', error.message);
    }
}

// Функция для отправки POST-запросов
async function sendPostRequest() {
    try {
        const response = await axios.post(
            BASE_URL,
            { data: 'Пример данных для POST-запроса' },
            {
                headers: {
                    'service-name': SERVICE_NAME,
                },
            }
        );
        console.log('[POST] Ответ от сервера:', response.data);
    } catch (error) {
        console.error('[POST] Ошибка:', error.message);
    }
}

// Функция для одного рабочего цикла
function startSingleCycle() {
    console.log(`Запуск цикла: Интервал ${interval / 1000} сек, Длительность ${duration} сек, GET: ${getRequestCount}, POST: ${postRequestCount}`);
    const startTime = Date.now();

    return new Promise((resolve) => {
        const timer = setInterval(() => {
            const elapsedTime = (Date.now() - startTime) / 1000;
            if (elapsedTime >= duration) {
                console.log('Цикл завершён.');
                clearInterval(timer);
                resolve(); // Завершаем текущий цикл
                return;
            }

            // Отправляем запросы
            for (let i = 0; i < getRequestCount; i++) {
                sendGetRequest();
            }
            for (let i = 0; i < postRequestCount; i++) {
                sendPostRequest();
            }
        }, interval);
    });
}

// Функция для ожидания следующей "нулевой" секунды
function waitForNextFullMinute() {
    return new Promise((resolve) => {
        const now = new Date();
        const seconds = now.getSeconds();
        const millisecondsToNextMinute = (60 - seconds) * 1000 - now.getMilliseconds();
        console.log(`Ожидание ${millisecondsToNextMinute / 1000} секунд до синхронизации с нулевой секундой...`);
        setTimeout(resolve, millisecondsToNextMinute);
    });
}

// Функция для постоянного перезапуска циклов
async function startInfiniteCycle() {
    while (true) {
        await waitForNextFullMinute(); // Синхронизируем с нулевой секундой
        await startSingleCycle(); // Выполняем рабочий цикл
    }
}

// Чтение пользовательских параметров
const args = process.argv.slice(2);
args.forEach((arg) => {
    const [key, value] = arg.split('=');
    switch (key) {
        case '--get':
            getRequestCount = parseInt(value, 10) || getRequestCount;
            break;
        case '--post':
            postRequestCount = parseInt(value, 10) || postRequestCount;
            break;
        case '--duration':
            duration = parseInt(value, 10) || duration;
            break;
        case '--interval':
            interval = (parseInt(value, 10) || interval / 1000) * 1000;
            break;
        default:
            console.log(`Неизвестный параметр: ${key}`);
    }
});

// Запуск постоянного цикла отправки запросов
startInfiniteCycle();
