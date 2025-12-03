const express = require('express');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔒 Токен хранится в .env файле (GITHUB_TOKEN=ваш_токен)
const octokit = new Octokit({ 
    auth: process.env.GITHUB_TOKEN 
});

const REPO_CONFIG = {
    owner: 'ВАШ_USERNAME',
    repo: 'ВАШ_REPO_NAME',
    path: 'users.json'
};

// 📥 Получить данные из users.json
app.get('/api/users', async (req, res) => {
    try {
        const { data } = await octokit.repos.getContent(REPO_CONFIG);
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        res.json({
            success: true,
            data: JSON.parse(content),
            sha: data.sha // важно для последующего обновления
        });
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 💾 Обновить данные users.json
app.put('/api/users', async (req, res) => {
    try {
        const { users, commitMessage = 'Обновление балансов', sha } = req.body;
        
        const response = await octokit.repos.createOrUpdateFileContents({
            ...REPO_CONFIG,
            message: commitMessage,
            content: Buffer.from(JSON.stringify(users, null, 2)).toString('base64'),
            sha: sha // если есть - обновит, если нет - создаст новый
        });

        res.json({
            success: true,
            message: 'Данные обновлены!',
            commit: response.data.commit
        });
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔄 Обновить баланс конкретного пользователя
app.patch('/api/users/:id/balance', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { newBalance } = req.body;
        
        // 1. Получаем текущие данные
        const fileData = await octokit.repos.getContent(REPO_CONFIG);
        const content = Buffer.from(fileData.data.content, 'base64').toString('utf8');
        const users = JSON.parse(content);
        const fileSha = fileData.data.sha;
        
        // 2. Находим и обновляем пользователя
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ success: false, error: 'Пользователь не найден' });
        }
        
        users[userIndex].balance = newBalance;
        users[userIndex].updated_at = new Date().toISOString();
        
        // 3. Сохраняем обратно
        await octokit.repos.createOrUpdateFileContents({
            ...REPO_CONFIG,
            message: `Обновлен баланс пользователя ${userId}: ${newBalance}`,
            content: Buffer.from(JSON.stringify(users, null, 2)).toString('base64'),
            sha: fileSha
        });
        
        res.json({ 
            success: true, 
            message: `Баланс пользователя ${userId} обновлен на ${newBalance}` 
        });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
