const { sendPacket } = require("./art-net");
const { hsvToRgb, createColorArray } = require("./utils");

const sendRainbow = async (universe, ip, length, offset) => {
    const array = createColorArray(length, i => {
        const hue = ((i + offset) % length) / length * 360;
        const [r, g, b] = hsvToRgb(hue, 1, 0.5);
        return [g, r, b]; // GRB порядок
    });
    await sendPacket(array, universe, ip);
};

const sendSmoothFadeEffect = async (universe, ip, length, offset, hueColor) => {
    const fadeDuration = 170;
    const halfDuration = fadeDuration / 2;
    const [r, g, b] = hsvToRgb(hueColor, 1, 1);

    const computeIntensity = (color, offset) => {
        if (offset % fadeDuration < halfDuration) {
            return Math.min(255, Math.round(color * (offset % fadeDuration) / halfDuration));
        } else {
            return Math.max(0, Math.round(color * (1 - (offset % fadeDuration - halfDuration) / halfDuration)));
        }
    };

    const currentIntensity = [
        computeIntensity(r, offset),
        computeIntensity(g, offset),
        computeIntensity(b, offset),
    ];

    const array = createColorArray(length, () => [currentIntensity[1], currentIntensity[0], currentIntensity[2]]); // GRB
    await sendPacket(array, universe, ip);
};

const sendFillColor = async (universe, ip, length, hueColor) => {
    const [r, g, b] = hsvToRgb(hueColor, 1, 1);
    const array = createColorArray(length, () => [g, r, b]); // GRB
    await sendPacket(array, universe, ip);
};

const effects = {
    rainbow: sendRainbow,
    fade: sendSmoothFadeEffect,
    fillColor: sendFillColor,
};

module.exports = { effects };
