require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Подключение к MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rate-limiter';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Подключено к MongoDB'))
    .catch((err) => console.error('Ошибка подключения к MongoDB:', err));

// Создание схемы для политики ограничения
const ratePolicySchema = new mongoose.Schema({
    service: { type: String, required: true },  // Название сервиса
    limit: { type: Number, required: true },    // Лимит запросов
    window: { type: Number, required: true },   // Временное окно (в секундах)
});

const RatePolicy = mongoose.model('RatePolicy', ratePolicySchema);

// Создание новой политики
app.post('/policy', async (req, res) => {
    const { service, limit, window } = req.body;

    if (!service || !limit || !window) {
        return res.status(400).json({ message: 'Все поля (service, limit, window) обязательны.' });
    }

    try {
        const newPolicy = new RatePolicy({ service, limit, window });
        await newPolicy.save();
        res.status(201).json({ message: 'Политика создана успешно', policy: newPolicy });
    } catch (error) {
        console.error('Ошибка создания политики:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// Получение всех политик
app.get('/policies', async (req, res) => {
    try {
        const policies = await RatePolicy.find();
        res.status(200).json(policies);
    } catch (error) {
        console.error('Ошибка получения политик:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// Обновление политики
app.put('/policy/:id', async (req, res) => {
    const { id } = req.params;
    const { limit, window } = req.body;

    try {
        const updatedPolicy = await RatePolicy.findByIdAndUpdate(
            id,
            { limit, window },
            { new: true }
        );

        if (!updatedPolicy) {
            return res.status(404).json({ message: 'Политика не найдена' });
        }

        res.status(200).json({ message: 'Политика обновлена успешно', policy: updatedPolicy });
    } catch (error) {
        console.error('Ошибка обновления политики:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// Удаление политики
app.delete('/policy/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const deletedPolicy = await RatePolicy.findByIdAndDelete(id);

        if (!deletedPolicy) {
            return res.status(404).json({ message: 'Политика не найдена' });
        }

        res.status(200).json({ message: 'Политика удалена успешно' });
    } catch (error) {
        console.error('Ошибка удаления политики:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// Запуск сервера
const PORT = process.env.RP_SERVICE_PORT || 5000;
app.listen(PORT, () => {
    console.log(`RP Service запущен на порту ${PORT}`);
});
