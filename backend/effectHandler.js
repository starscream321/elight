const {effects} = require("./effects");
const IP = ['192.168.6.11', '192.168.6.12'];
let FPS
let animationFrame
const totalDiodes = 2220

const offsets = []
const CHANNELS_PER_PIXEL = 3;
const MAX_PIXELS_PER_UNIVERSE = Math.floor(512 / CHANNELS_PER_PIXEL);

const calculateUniverses = (totalDiodes) => {
    return Math.ceil(totalDiodes / MAX_PIXELS_PER_UNIVERSE);
};
const totalUniverses = calculateUniverses(totalDiodes, 170);

const startInterval = async (hueColor, currentEffect) => {
    clearInterval(animationFrame);
    for (let universe = 0; universe < totalUniverses; universe++) {
        if (!offsets[universe]) {
            offsets[universe] = 0;
        }
    }
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
            const promises = []

            for (let ip of IP) {
                for (let universe = 0; universe < totalUniverses; universe++) {
                    const length = 170
                    offsets[universe] = (offsets[universe] + 1) % length;
                    if (offsets[universe] > length - 1) {
                        offsets[universe] = length - 1
                    } else if (offsets[universe] < 0) {
                        offsets[universe] = 0;
                    }
                    promises.push(effects[currentEffect](universe, ip, length, offsets[universe], hueColor));
                }
            }
            await Promise.all(promises)
            animationFrame = setTimeout(handleEffect, 1000 / FPS);
        };
        await handleEffect();
    }
};

module.exports = {
    startInterval,
    animationFrame,
}
