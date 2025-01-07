const {effects} = require("./effects");
const IP = ['192.168.6.11', '192.168.6.12'];
const { currentEffect } = require("./server");
let FPS = 30;
let animationFrame
const universeLengths = {
    0: 150,
    1: 120,
    2: 180,
    3: 100,
    4: 150,
    5: 120,
    6: 180,
    7: 100,
    8: 150,
    9: 120,
    10: 180,
    11: 100,
    12: 150,
    13: 120,
    14: 180,
    15: 100,
    16: 100
};
const offsets = []


const startInterval = async (hueColor) => {
    for (let universe in universeLengths) {
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
                for (let universe of universeLengths) {
                    const length = universeLengths[universe]
                    offsets[universe] = (offsets[universe] + 1) % length;
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