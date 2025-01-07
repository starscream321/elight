const {sendPacket} = require("./art-net");
const {getRandomSovietColor, hsvToRgb} = require("./utils");



const sendRainbow = async (universe, ip, length, offset) => {
    const array = [];
    for (let i = 0; i < length; i++) {
        const hue = ((i + offset) % 170) / 170 * 360;
        const color = hsvToRgb(hue, 1, 0.7);
        array.push(...color);
    }
    await sendPacket(array, universe, ip);
}
const sendGarland  = async (universe, ip, length, offset) => {
    const array = [];
    for (let i = 0; i < length; i++) {
        const hue = (((i + offset) % 50) / 50) * 360;
        const isOn = ((i + offset) % 10) < 5;
        const color = isOn ? hsvToRgb(hue, 1, 1) : [0, 0, 0];
        array.push(...color);
    }
    await sendPacket(array, universe, ip);
}


const sendComet = async (universe, ip, length, offset) => {
    const array = [];
    const cometLength = 8;
    const cometPosition = offset % length;
    const cometColor = [0, 0, 255];

    for (let i = 0; i < length; i++) {
        let color = [0, 0, 0];
        if (i >= cometPosition && i < cometPosition + cometLength) {
            const brightness = 1 - (i - cometPosition) / cometLength;
            color = cometColor.map(c => Math.round(c * brightness));
        }
        array.push(...color);
    }
    await sendPacket(array, universe, ip);
}

const sendSovietGarland = async (universe, ip, length) => {
    const array = [];

    const blinkChance = 0.2;

                for  (let i = 0; i < length; i++) {
        const isOn = Math.random() > blinkChance;
        const color = isOn ? getRandomSovietColor() : [0, 0, 0];
        array.push(...color);
    }
    await sendPacket(array, universe, ip);

};

const sendSmoothFadeEffect = async (universe, ip, length, offset, hueColor) => {
    const array = [];
    const fadeDuration = 170;
    const halfDuration = fadeDuration / 2;

    const rgbColor = hsvToRgb(hueColor, 1, 1);  // Максимальная насыщенность и яркость

    let currentIntensityR, currentIntensityG, currentIntensityB;

    if (offset % fadeDuration < halfDuration) {
        currentIntensityR = Math.min(255, Math.round(rgbColor[1] * (offset % fadeDuration) / halfDuration));
        currentIntensityG = Math.min(255, Math.round(rgbColor[0] * (offset % fadeDuration) / halfDuration));
        currentIntensityB = Math.min(255, Math.round(rgbColor[2] * (offset % fadeDuration) / halfDuration));
    } else {
        currentIntensityR = Math.max(0, Math.round(rgbColor[1] * (1 - (offset % fadeDuration - halfDuration) / halfDuration)));
        currentIntensityG = Math.max(0, Math.round(rgbColor[0] * (1 - (offset % fadeDuration - halfDuration) / halfDuration)));
        currentIntensityB = Math.max(0, Math.round(rgbColor[2] * (1 - (offset % fadeDuration - halfDuration) / halfDuration)));
    }

    for (let i = 0; i < length; i++) {
        const color = [currentIntensityG, currentIntensityR, currentIntensityB];
        array.push(...color);
    }

    await sendPacket(array, universe, ip);
};

const sendFillColor = async (universe, ip, length, offset, hueColor) => {
    const array = []
    const color = hsvToRgb(hueColor, 1, 1);
    for (let i = 0; i < length; i++) {
        array.push(...color);
    }
    await sendPacket(array, universe, ip)
}

const sendAggressiveTechnoEffect = async (universe, ip, length, offset) => {
    const array = [];
    const fadeDuration = 170; // Продолжительность одного цикла пульсации
    const halfDuration = fadeDuration / 2;

    // Случайный выбор яркости (интенсивности)
    const randomBrightness = Math.random();
    const brightness = randomBrightness > 0.7 ? 1 : 0.3 + Math.random() * 0.7; // Яркость от 30% до 100%

    // Используем случайный hue для эффекта динамичности
    const randomHue = Math.floor(Math.random() * 360); // Случайный цвет
    const rgbColor = hsvToRgb(randomHue, 1, brightness);

    // Переменные для плавной пульсации
    let currentIntensityR, currentIntensityG, currentIntensityB;

    // Пульсация: изменение яркости от 0 до 255 и обратно
    if (offset % fadeDuration < halfDuration) {
        currentIntensityR = Math.min(255, Math.round(rgbColor[0] * (offset % fadeDuration) / halfDuration));
        currentIntensityG = Math.min(255, Math.round(rgbColor[1] * (offset % fadeDuration) / halfDuration));
        currentIntensityB = Math.min(255, Math.round(rgbColor[2] * (offset % fadeDuration) / halfDuration));
    } else {
        currentIntensityR = Math.max(0, Math.round(rgbColor[0] * (1 - (offset % fadeDuration - halfDuration) / halfDuration)));
        currentIntensityG = Math.max(0, Math.round(rgbColor[1] * (1 - (offset % fadeDuration - halfDuration) / halfDuration)));
        currentIntensityB = Math.max(0, Math.round(rgbColor[2] * (1 - (offset % fadeDuration - halfDuration) / halfDuration)));
    }

    // Создаем случайные вспышки
    const randomFlash = Math.random() > 0.95; // 5% шанс для случайной вспышки
    if (randomFlash) {
        currentIntensityR = 255;
        currentIntensityG = 255;
        currentIntensityB = 255;
    }

    // Заполняем массив с цветами для всех светодиодов
    for (let i = 0; i < length; i++) {
        const color = [currentIntensityR, currentIntensityG, currentIntensityB];
        array.push(...color);
    }

    // Отправляем данные на устройства
    await sendPacket(array, universe, ip);
};

const sendStroboTechnoEffect = async (universe, ip, length) => {
    const array = [];
    const numStrobes = 70;

    let ledStates = new Array(length).fill([0, 0, 0]);

    for (let i = 0; i < numStrobes; i++) {
        const ledIndex = Math.floor(Math.random() * length);
        const randomFlash = Math.random();

        if (randomFlash > 0.5) {
            const randomHue = Math.floor(Math.random() * 360);
            const randomSaturation = 1;
            const randomBrightness = 1;
            ledStates[ledIndex] = hsvToRgb(randomHue, randomSaturation, randomBrightness);
        } else {
            ledStates[ledIndex] = [0, 0, 0];
        }
    }

    for (let i = 0; i < length; i++) {
        const ledColor = ledStates[i];

        array.push(...ledColor);
    }

    // Отправляем данные на устройства
    await sendPacket(array, universe, ip);
};



const sendOff = async (universe, ip, length) => {
    const array = new Array(length * 3).fill(0);
    await sendPacket(array, universe, ip)
}
const effects = {
    garland: sendGarland,
    rainbow: sendRainbow,
    comet: sendComet,
    soviet: sendSovietGarland,
    fade: sendSmoothFadeEffect,
    fillColor: sendFillColor,
    techno: sendAggressiveTechnoEffect,
    stroboTechno: sendStroboTechnoEffect,
    off: sendOff
}

module.exports = { effects }
