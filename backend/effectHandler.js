const { effects } = require("./effects");

const IP_ADDRESSES = ['192.168.6.11', '192.168.6.12'];
const TOTAL_DIODES = 2220;
const CHANNELS_PER_PIXEL = 3;
const MAX_PIXELS_PER_UNIVERSE = Math.floor(512 / CHANNELS_PER_PIXEL);
const offsets = new Array(calculateTotalUniverses(TOTAL_DIODES)).fill(0);
let animationFrame = null;
let framesPerSecond;

const calculateTotalUniverses = (totalDiodes) => {
    return Math.ceil(totalDiodes / MAX_PIXELS_PER_UNIVERSE);
};

const totalUniverses = calculateTotalUniverses(TOTAL_DIODES);

const startInterval = async (hueColor, currentEffect) => {
    if (animationFrame) {
        clearInterval(animationFrame);
    }

    if (currentEffect) {
        framesPerSecond = determineFPS(currentEffect);

        const handleEffect = async () => {
            const promises = [];

            for (const ip of IP_ADDRESSES) {
                for (let universe = 0; universe < totalUniverses; universe++) {
                    const length = MAX_PIXELS_PER_UNIVERSE;
                    offsets[universe] = (offsets[universe] + 1) % length;

                    promises.push(effects[currentEffect](universe, ip, length, offsets[universe], hueColor));
                }
            }

            await Promise.all(promises);
            animationFrame = setTimeout(handleEffect, 1000 / framesPerSecond);
        };

        await handleEffect();
    }
};

const determineFPS = (effect) => {
    switch (effect) {
        case "garland":
            return 15;
        case "soviet":
            return 5;
        default:
            return 30;
    }
};

module.exports = {
    startInterval,
    animationFrame,
};