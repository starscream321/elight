import * as mic from "mic";
import { fft as FFT } from "fft-js";

const SAMPLE_RATE = 44100;
const FFT_SIZE = 1024;

const DEVICE = process.env.AUDIO_DEVICE || "CABLE Output (VB-Audio Virtual Cable)";
const CHANNELS = 2;

let audioMono: number[] = new Array(FFT_SIZE).fill(0);
let diagDone = false;

let smoothed = {
    kick: 0,
    bass: 0,
    mid: 0,
    treble: 0,
};

let peak = {
    kick: 1e-3,
    bass: 1e-3,
    mid: 1e-3,
    treble: 1e-3,
};

let beatHold = 4;

// отдельные сглаживатели для транзиента кика
let kickFast = 0;
let kickSlow = 0;

function smoothValue(curr: number, prev: number, rise = 0.25, fall = 0.1) {
    return prev + (curr - prev) * (curr > prev ? rise : fall);
}

function noiseGate(v: number, t = 0.03) {
    return v > t ? (v - t) / (1 - t) : 0;
}

function hannWindow(N: number) {
    const out = new Array(N);
    for (let n = 0; n < N; n++) out[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    return out;
}

const WIN = hannWindow(FFT_SIZE);

export const micInstance = mic({
    rate: String(SAMPLE_RATE),
    channels: String(CHANNELS),
    debug: false,
    encoding: "signed-integer",
    bitwidth: "16",
    endian: "little",
    device: DEVICE,
});

const stream = micInstance.getAudioStream();

function parseChunk(buf: Buffer) {
    if (buf.length % 2 === 0)
        return { type: "int16", a: new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2) };

    if (buf.length % 4 === 0)
        return { type: "f32", a: new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4) };

    return { type: "unknown", a: new Int16Array(0) };
}

function toMono(arr: Int16Array | Float32Array, channels: number, type: string) {
    const nFrames = Math.floor(arr.length / channels);
    const out = new Array(nFrames);

    for (let i = 0, j = 0; j < nFrames; i += channels, j++) {
        out[j] = (Number(arr[i]) + Number(arr[i + 1])) / 2;
    }

    let scale = 1;
    if (type === "int16") scale = 1 / 32768;

    for (let i = 0; i < nFrames; i++) {
        const v = out[i] * scale;
        out[i] = Number.isFinite(v) ? v : 0;
    }

    return out;
}

function safeAvg(arr: number[]) {
    let s = 0,
        n = 0;
    for (const v of arr) if (Number.isFinite(v)) (s += v), n++;
    return n ? s / n : 0;
}

stream.on("data", (buf: Buffer) => {
    const { type, a } = parseChunk(buf);

    if (!diagDone) {
        diagDone = true;
        console.log("[mic] Using device:", DEVICE);
    }

    if (type === "unknown") return;

    const mono = toMono(a, CHANNELS, type);
    audioMono = audioMono.concat(mono).slice(-FFT_SIZE);
});

if (!(global as any)._micStarted) {
    (global as any)._micStarted = true;
    micInstance.start();
}

export interface AudioFeatures {
    kick: number;
    bass: number;
    mid: number;
    treble: number;
    energy: number;
    beat: boolean;
}

function detectBeatFromTransient(kickNorm: number, bassNorm: number) {
    const BEAT_HOLD = 6;

    kickFast = smoothValue(kickNorm, kickFast, 0.6, 0.3);
    kickSlow = smoothValue(kickNorm, kickSlow, 0.15, 0.05);

    let transient = kickFast - kickSlow * 0.9;
    if (transient < 0) transient = 0;

    const mask = bassNorm * 0.4;
    let score = transient - mask;
    if (score < 0) score = 0;

    const THRESH = 0.10;
    let beat = false;

    if (score > THRESH && beatHold === 0) {
        beat = true;
        beatHold = BEAT_HOLD;
    }

    if (beatHold > 0) beatHold--;

    return beat;
}

export function getAudioSpectrum(): AudioFeatures {
    if (audioMono.length < FFT_SIZE) {
        return { kick: 0, bass: 0, mid: 0, treble: 0, energy: 0, beat: false };
    }

    const xw = audioMono.map((v, i) => v * WIN[i]);
    const X = FFT(xw);

    const mags = X.slice(0, FFT_SIZE / 2).map(([re, im]: [number, number]) => Math.hypot(re, im));

    const bin = SAMPLE_RATE / FFT_SIZE;
    const idx = (hz: number) => Math.min(mags.length - 1, Math.round(hz / bin));

    const KICK_RAW = safeAvg(mags.slice(idx(60), idx(150)));
    const BASS_RAW = safeAvg(mags.slice(idx(150), idx(300)));
    const MID_RAW = safeAvg(mags.slice(idx(300), idx(2000)));
    const TREBLE_RAW = safeAvg(mags.slice(idx(2000), idx(6000)));

    peak.kick = Math.max(peak.kick * 0.995, KICK_RAW);
    peak.bass = Math.max(peak.bass * 0.995, BASS_RAW);
    peak.mid = Math.max(peak.mid * 0.995, MID_RAW);
    peak.treble = Math.max(peak.treble * 0.995, TREBLE_RAW);

    const kickNorm = noiseGate(KICK_RAW / peak.kick, 0.035);
    const bassNorm = noiseGate(BASS_RAW / peak.bass, 0.045);
    const midNorm = noiseGate(MID_RAW / peak.mid, 0.04);
    const trebleNorm = noiseGate(TREBLE_RAW / peak.treble, 0.03);

    smoothed.kick = smoothValue(kickNorm, smoothed.kick, 0.45, 0.2);
    smoothed.bass = smoothValue(bassNorm, smoothed.bass, 0.35, 0.18);
    smoothed.mid = smoothValue(midNorm, smoothed.mid, 0.28, 0.15);
    smoothed.treble = smoothValue(trebleNorm, smoothed.treble, 0.22, 0.12);

    const energy =
        smoothed.kick * 0.5 +
        smoothed.bass * 0.3 +
        smoothed.mid * 0.15 +
        smoothed.treble * 0.05;

    const beat = detectBeatFromTransient(kickNorm, bassNorm);

    return {
        kick: smoothed.kick,
        bass: smoothed.bass,
        mid: smoothed.mid,
        treble: smoothed.treble,
        energy,
        beat,
    };
}
