const mic = require("mic");
const FFT = require("fft-js").fft;
const FFTUtils = require("fft-js").util;

let audioData = new Array(1024).fill(0);

const micInstance = mic({
    rate: "44100",
    channels: "1",
    debug: false,
    encoding: "signed-integer",
    bitwidth: "16",
    endian: "little"
});

const micInputStream = /** @type {any} */ (micInstance.getAudioStream());
micInputStream.on("data", data => {
    const samples = new Int16Array(data.buffer);
    audioData = Array.from(samples);
});

micInstance.start();

const getAudioSpectrum = () => {
    const phasors = FFT(audioData);
    const magnitudes = FFTUtils.fftMag(phasors);

    const bass = magnitudes.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const mid = magnitudes.slice(10, 50).reduce((a, b) => a + b, 0) / 40;
    const treble = magnitudes.slice(50, 100).reduce((a, b) => a + b, 0) / 50;

    return { bass, mid, treble };
};

module.exports = { getAudioSpectrum };
