const mic = require("mic");
const FFT = require("fft-js").fft;

// ====== НАСТРОЙКИ ======
const SAMPLE_RATE = 44100;
const FFT_SIZE = 1024;

const DEVICE = process.env.AUDIO_DEVICE || "CABLE Output (VB-Audio Virtual Cable)"

// Каналы и формат: для VB-Cable и Stereo Mix обычно 2 канала, 16 бит, little-endian
const CHANNELS = 2;
const BITWIDTH = 16;
const ENCODING = "signed-integer"; // чаще всего 16-bit PCM
const ENDIAN = "little";

// ====== ВНУТРЕННИЕ ПЕРЕМЕННЫЕ ======
let audioMono = new Array(FFT_SIZE).fill(0);
let diagDone = false;


// ====== ВСПОМОГАТЕЛЬНЫЕ ======
let smooth = { bass: 0, mid: 0, treble: 0 };

function smoothValue(curr: number, prev: number, rise = 0.25, fall = 0.08) {
    const alpha = curr > prev ? rise : fall; // вверх быстрее, вниз медленнее
    return prev + (curr - prev) * alpha;
}

function noiseGate(v: number, threshold = 0.02): number {
    return v > threshold ? (v - threshold) / (1 - threshold) : 0;
}

let peakHold = 1;

function normalize(val: number) {
    peakHold = Math.max(peakHold * 0.995, val, 1e-6); // падает на 0.5% за кадр
    return val / peakHold;
}



function hannWindow(N: number): number[] {
    const w: number[] = new Array(N);
    for (let n = 0; n < N; n++) {
        w[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    }
    return w;
}
const WIN = hannWindow(FFT_SIZE);

// ====== MIC ИНИЦ ======
export const micInstance = mic({
    rate: String(SAMPLE_RATE),
    channels: String(CHANNELS),
    debug: false,
    encoding: ENCODING,
    bitwidth: String(BITWIDTH),
    endian: ENDIAN,
    device: DEVICE, // undefined => дефолтное устройство записи
});

const stream: any = micInstance.getAudioStream();

// ====== ВСПОМОГАТЕЛЬНЫЕ ======
type ParsedChunk =
    | { type: "int16"; a: Int16Array; bytesPerSample: 2 }
    | { type: "f32"; a: Float32Array; bytesPerSample: 4 }
    | { type: "unknown"; a: Int16Array; bytesPerSample: 0 };

function parseChunk(buf: Buffer): ParsedChunk {
    if (buf.length % 2 === 0) {
        const a = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
        return { type: "int16", a, bytesPerSample: 2 };
    }
    if (buf.length % 4 === 0) {
        const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
        return { type: "f32", a: f32, bytesPerSample: 4 };
    }
    return { type: "unknown", a: new Int16Array(0), bytesPerSample: 0 };
}

function toMono(arr: Int16Array | Float32Array, channels: number, type: "int16" | "f32" | "int32"): number[] {
    const nFrames = Math.floor(arr.length / Math.max(1, channels));
    const out: number[] = new Array(nFrames);

    if (channels === 1) {
        for (let i = 0; i < nFrames; i++) out[i] = Number(arr[i]);
    } else {
        for (let i = 0, j = 0; j < nFrames; i += channels, j++) {
            let sum = 0;
            for (let c = 0; c < channels; c++) sum += Number((arr as any)[i + c] ?? 0);
            out[j] = sum / channels;
        }
    }

    let scale = 1;
    if (type === "int16") scale = 1 / 32768;
    else if (type === "int32") scale = 1 / 2147483648; // на всякий случай
    // float32 уже -1..1

    for (let i = 0; i < out.length; i++) {
        const v = out[i] * scale;
        out[i] = Number.isFinite(v) ? v : 0;
    }
    return out;
}

function safeAvg(arr: number[]): number {
    let s = 0;
    let n = 0;
    for (const v of arr) {
        if (Number.isFinite(v)) {
            s += v;
            n++;
        }
    }
    return n ? s / n : 0;
}

// ====== ПРИЁМ ПОТОКА ======
stream.on("data", (buf: Buffer) => {
    const { type, a, bytesPerSample } = parseChunk(buf);

    if (!diagDone) {
        diagDone = true;
        // eslint-disable-next-line no-console
        console.log(
            `[diag] device=${DEVICE ?? "(default)"} | ch=${CHANNELS} | fmt=${type} | bps=${bytesPerSample} | bytes=${buf.length}`
        );
    }
    if (type === "unknown") return;

    const mono = toMono(a, CHANNELS, type);

    // Скользящее окно FFT_SIZE
    audioMono = audioMono.concat(mono).slice(-FFT_SIZE);

    // Простой VU-метр (можно убрать)
    if (!(global as any)._lastVu || Date.now() - (global as any)._lastVu > 250) {
        (global as any)._lastVu = Date.now();
        const rms = Math.sqrt(
            audioMono.reduce((s, v) => s + (Number.isFinite(v) ? v * v : 0), 0) / audioMono.length
        );
        process.stdout.write(`\rRMS: ${rms.toFixed(4)}   `);
    }
});

stream.on("error", (e: any) => console.error("Mic error:", e));

// Автостарт (если нужно — уберите и запускайте вовне)
if (!(global as any)._micStarted) {
    (global as any)._micStarted = true;
    micInstance.start();
}

// ====== ПУБЛИЧНОЕ API ======
export function getAudioSpectrum(): { bass: number; mid: number; treble: number } {
    if (audioMono.length < FFT_SIZE) return { bass: 0, mid: 0, treble: 0 };

    const xw = audioMono.map((v, i) => (Number.isFinite(v) ? v : 0) * WIN[i]);
    const X: [number, number][] = FFT(xw) as any;

    const mags: number[] = [];
    for (let i = 0; i < FFT_SIZE / 2; i++) {
        const [re, im] = X[i];
        mags.push(Math.hypot(re, im));
    }

    const binHz = SAMPLE_RATE / FFT_SIZE;
    const idx = (hz: number) => Math.min(mags.length - 1, Math.round(hz / binHz));

    const BASS = safeAvg(mags.slice(idx(20), idx(200)));
    const MID = safeAvg(mags.slice(idx(200), idx(2000)));
    const TREBLE = safeAvg(mags.slice(idx(2000), idx(6000)));

    // нормализуем через бегущий максимум
    const bassRaw = normalize(BASS);
    const midRaw = normalize(MID);
    const trebleRaw = normalize(TREBLE);

    // порог и сглаживание
    smooth.bass   = smoothValue(noiseGate(bassRaw),   smooth.bass);
    smooth.mid    = smoothValue(noiseGate(midRaw),    smooth.mid);
    smooth.treble = smoothValue(noiseGate(trebleRaw), smooth.treble);

    return { ...smooth };
}
