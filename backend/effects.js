const { sendPacket } = require("./art-net");
const { getRandomSovietColor, hsvToRgb, createColorArray } = require("./utils");


const sendRainbow = async (universe, ip, length, offset) => {
    const array = createColorArray(length, i => {
        const hue = ((i + offset) % length) / length * 360;
        return hsvToRgb(hue, 1, 0.5);
    });
    await sendPacket(array, universe, ip);
};

const sendGarland = async (universe, ip, length, offset) => {
    const array = createColorArray(length, i => {
        const hue = (((i + offset) % 50) / 50) * 360;
        const isOn = ((i + offset) % 10) < 5;
        return isOn ? hsvToRgb(hue, 1, 1) : [0, 0, 0];
    });
    await sendPacket(array, universe, ip);
};

const sendComet = async (universe, ip, length, offset) => {
    const cometLength = 8;
    const cometPosition = offset % length;
    const cometColor = [0, 0, 255];
    const array = createColorArray(length, i => {
        if (i >= cometPosition && i < cometPosition + cometLength) {
            const brightness = 1 - (i - cometPosition) / cometLength;
            return cometColor.map(c => Math.round(c * brightness));
        }
        return [0, 0, 0];
    });
    await sendPacket(array, universe, ip);
};

const sendSovietGarland = async (universe, ip, length) => {
    const blinkChance = 0.2;
    const array = createColorArray(length, () => {
        const isOn = Math.random() > blinkChance;
        return isOn ? getRandomSovietColor() : [0, 0, 0];
    });
    await sendPacket(array, universe, ip);
};

const sendSmoothFadeEffect = async (universe, ip, length, offset, hueColor) => {
    const fadeDuration = 170;
    const halfDuration = fadeDuration / 2;
    const rgbColor = hsvToRgb(hueColor, 1, 1);

    const computeIntensity = (color, offset) => {
        if (offset % fadeDuration < halfDuration) {
            return Math.min(255, Math.round(color * (offset % fadeDuration) / halfDuration));
        } else {
            return Math.max(0, Math.round(color * (1 - (offset % fadeDuration - halfDuration) / halfDuration)));
        }
    };

    const currentIntensity = [
        computeIntensity(rgbColor[0], offset),
        computeIntensity(rgbColor[1], offset),
        computeIntensity(rgbColor[2], offset),
    ];

    const array = createColorArray(length, () => [currentIntensity[1], currentIntensity[0], currentIntensity[2]]);
    await sendPacket(array, universe, ip);
};

const sendFillColor = async (universe, ip, length, hueColor) => {
    const color = hsvToRgb(hueColor, 1, 1);
    const array = createColorArray(length, () => color);
    await sendPacket(array, universe, ip);
};

const sendAggressiveTechnoEffect = async (universe, ip, length, offset) => {
    const fadeDuration = 170;
    const halfDuration = fadeDuration / 2;
    const randomBrightness = Math.random();
    const brightness = randomBrightness > 0.7 ? 1 : 0.3 + Math.random() * 0.7;
    const randomHue = Math.floor(Math.random() * 360);
    const rgbColor = hsvToRgb(randomHue, 1, brightness);

    const computeIntensity = (color, offset) => {
        if (offset % fadeDuration < halfDuration) {
            return Math.min(255, Math.round(color * (offset % fadeDuration) / halfDuration));
        } else {
            return Math.max(0, Math.round(color * (1 - (offset % fadeDuration - halfDuration) / halfDuration)));
        }
    };

    const currentIntensity = [
        computeIntensity(rgbColor[0], offset),
        computeIntensity(rgbColor[1], offset),
        computeIntensity(rgbColor[2], offset),
    ];

    if (Math.random() > 0.95) {
        currentIntensity.fill(255);
    }

    const array = createColorArray(length, () => [currentIntensity[0], currentIntensity[1], currentIntensity[2]]);
    await sendPacket(array, universe, ip);
};

const sendStroboTechnoEffect = async (universe, ip, length) => {
    const numStrobes = 70;
    const ledStates = new Array(length).fill([0, 0, 0]);

    for (let i = 0; i < numStrobes; i++) {
        const ledIndex = Math.floor(Math.random() * length);
        if (Math.random() > 0.5) {
            const randomHue = Math.floor(Math.random() * 360);
            ledStates[ledIndex] = hsvToRgb(randomHue, 1, 1);
        } else {
            ledStates[ledIndex] = [0, 0, 0];
        }
    }

    const array = ledStates.flat();
    await sendPacket(array, universe, ip);
};

const sendOff = async (universe, ip, length) => {
    const array = new Array(length * 3).fill(0);
    await sendPacket(array, universe, ip);
};

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
};

module.exports = { effects };