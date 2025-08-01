const mic = require('mic');
const FFT = require("fft-js").fft;
const FFTUtils = require("fft-js").util;

const FFT_SIZE = 1024;
let audioData = new Array(FFT_SIZE).fill(0);

// 🔧 Укажи устройство (важно!)
const micInstance = mic({
    rate: "44100",
    channels: "1",
    debug: false,
    encoding: "signed-integer",
    bitwidth: "16",
    endian: "little",
    device: "hw:1,0"
});

const micInputStream = micInstance.getAudioStream();

micInputStream.on("data", (data: { buffer: any; byteOffset: number | undefined; length: number; }) => {
    const samples = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
    audioData = audioData.concat(Array.from(samples)).slice(-FFT_SIZE);
});

micInputStream.on("error", (err: any) => {
    console.error("Mic error:", err);
});

micInstance.start();

export function getAudioSpectrum () {
    if (audioData.length < FFT_SIZE) return { bass: 0, mid: 0, treble: 0 };

    const phasors = FFT(audioData);
    const magnitudes = FFTUtils.fftMag(phasors);

    const bassBins = magnitudes.slice(0, 10);
    const midBins = magnitudes.slice(10, 50);
    const trebleBins = magnitudes.slice(50, 100);

    const norm = Math.max(...magnitudes) || 1;

    return {
        bass: bassBins.reduce((a: any, b: any) => a + b, 0) / bassBins.length / norm,
        mid: midBins.reduce((a: any, b: any) => a + b, 0) / midBins.length / norm,
        treble: trebleBins.reduce((a: any, b: any) => a + b, 0) / trebleBins.length / norm,
    };
}
