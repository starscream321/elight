const { effects } = require("./effects");
const IP_ADDRESSES = '192.168.6.11'
const TOTAL_DIODES = 10000;
const CHANNELS_PER_PIXEL = 3;
const MAX_PIXELS_PER_UNIVERSE = Math.floor(512 / CHANNELS_PER_PIXEL);
const calculateTotalUniverses = (totalDiodes) => {
    return Math.ceil(totalDiodes / MAX_PIXELS_PER_UNIVERSE);
};
const offsets = new Array(calculateTotalUniverses(TOTAL_DIODES)).fill(0);
let animationFrame = null;
let framesPerSecond = 30


const totalUniverses = calculateTotalUniverses(TOTAL_DIODES);

const startInterval = async (hueColor, currentEffect) => {
    if (animationFrame) {
        clearInterval(animationFrame);
    }


        const handleEffect = async () => {
            const promises = [];
                for (let universe = 0; universe < totalUniverses; universe++) {
                    const length = MAX_PIXELS_PER_UNIVERSE;
                    offsets[universe] = (offsets[universe] + 1) % length;

                    promises.push(effects[currentEffect](universe, IP_ADDRESSES, length, offsets[universe], hueColor));
                }

            await Promise.all(promises);
            animationFrame = setTimeout(handleEffect, 1000 / framesPerSecond);
        };

        await handleEffect();
};


module.exports = {
    startInterval,
    animationFrame,
};
