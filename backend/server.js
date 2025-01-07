const express = require('express');
const { effects } = require('./effects');
const cors = require('cors');


const app = express();
const PORT = 3001;
app.use(express.json(), cors());
let currentEffect = '';

const IP = ['192.168.6.11', '192.168.6.12'];
let FPS = 30;
let offset = 0
let animationFrame

const startInterval = async (hueColor) => {
    if (currentEffect) {
        switch (currentEffect) {
            case "garland":
                FPS = 15;
                break;
            case "soviet":
                FPS = 5;
                break;
            default: FPS = 30
        }
        const handleEffect = async () => {
            offset = (offset + 1) % 170; // Обновляем offset

            for (let ip of IP) {
                for (let universe = 0; universe <= 16; universe++) {
                    await effects[currentEffect](universe, ip, offset, hueColor);
                }
            }

            // Запускаем следующий цикл с задержкой (FPS)
            animationFrame = setTimeout(handleEffect, 1000 / FPS);
        };

        // Запуск первого цикла
        await handleEffect();
    }
};


app.post('/set-effect', async (req, res) => {
    const { effect, hueColor } = req.body;
    if (effects[effect]) {
        clearTimeout(animationFrame);
        offset = 0
        currentEffect = effect;
        res.send(`Effect changed to: ${effect}`);
        await startInterval(hueColor)
    } else {
        console.log('Effect not found:', effect);
        res.status(400).send('Invalid effect name');
    }
});


app.get('/off-led', (req, res) => {
        currentEffect = 'off'
        startInterval(currentEffect)
        setTimeout(() => {
            clearInterval(animationFrame)
        }, 1000)
        res.send(`Led off`);
});

// Запустить сервер
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

module.exports = { currentEffect, offset };
