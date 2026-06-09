import { ConfigService } from '@nestjs/config';

import { AudioService } from './audio.service';
import {
    calculateVolumeRaw,
    detectPeak,
    mapFrequencyBinsTo16Bands,
} from './wled-audio.utils';

type AudioServiceInternals = {
    updateInputGain(windowRms: number, windowPeak?: number): number;
    softLimitSample(sample: number): number;
    normalizeBand(
        key: 'kick' | 'bass' | 'mid' | 'treble',
        raw: number,
        band: {
            exponent: number;
        },
    ): number;
    calculateInputShapeSafety(windowRms: number, windowPeak: number): number;
    calculateSpectralSafety(mags: number[], binHz: number): number;
    colorMusicGate(
        key: 'kick' | 'bass' | 'mid' | 'treble',
        value: number,
        band: {
            ratioThreshold: number;
        },
    ): number;
    calculateSpectrumBins(mags: number[], binHz: number): number[];
};

describe('AudioService normalization', () => {
    const createService = () =>
        new AudioService({
            get: jest.fn((key: string) => {
                const config: Record<string, string | number> = {
                    AUDIO_NOISE_FLOOR_RMS: 0.001,
                    AUDIO_NORMALIZE_TARGET_RMS: 0.1,
                    AUDIO_NORMALIZE_TARGET_PEAK: 0.35,
                    AUDIO_NORMALIZE_MIN_GAIN: 0.05,
                    AUDIO_NORMALIZE_MAX_GAIN: 4,
                };

                return config[key];
            }),
        } as unknown as ConfigService);

    it('keeps gain bounded while adapting to different input volumes', () => {
        const service = createService() as unknown as AudioServiceInternals;

        let loudGain = 1;
        for (let i = 0; i < 16; i++) {
            loudGain = service.updateInputGain(0.4);
        }

        let quietGain = loudGain;
        for (let i = 0; i < 24; i++) {
            quietGain = service.updateInputGain(0.025);
        }

        expect(loudGain).toBeGreaterThanOrEqual(0.05);
        expect(loudGain).toBeLessThan(0.4);
        expect(quietGain).toBeGreaterThan(loudGain);
        expect(quietGain).toBeLessThanOrEqual(4);
    });

    it('clamps gain quickly when volume jumps from quiet to loud', () => {
        const service = createService() as unknown as AudioServiceInternals;

        let quietGain = 1;
        for (let i = 0; i < 24; i++) {
            quietGain = service.updateInputGain(0.025);
        }

        const overloadGain = service.updateInputGain(0.9);

        expect(quietGain).toBeGreaterThan(3);
        expect(overloadGain).toBeLessThanOrEqual(0.16);
    });

    it('limits sustained high peaks even when RMS is moderate', () => {
        const service = createService() as unknown as AudioServiceInternals;

        let gain = 1;
        for (let i = 0; i < 16; i++) {
            gain = service.updateInputGain(0.07, 0.98);
        }

        expect(gain).toBeGreaterThanOrEqual(0.05);
        expect(gain).toBeLessThanOrEqual(0.38);
        expect(gain * 0.98).toBeLessThanOrEqual(0.38);
    });

    it('soft-limits normalized samples before FFT', () => {
        const service = createService() as unknown as AudioServiceInternals;

        expect(service.softLimitSample(8)).toBeLessThan(1);
        expect(service.softLimitSample(-8)).toBeGreaterThan(-1);
        expect(service.softLimitSample(Number.NaN)).toBe(0);
    });

    it('normalizes the same band shape across different input levels', () => {
        const service = createService() as unknown as AudioServiceInternals;
        const band = { exponent: 1.1 };

        let quietLevel = 0;
        for (let i = 0; i < 48; i++) {
            quietLevel = service.normalizeBand('kick', 0.02, band);
        }

        let loudLevel = 0;
        for (let i = 0; i < 48; i++) {
            loudLevel = service.normalizeBand('kick', 0.2, band);
        }

        expect(quietLevel).toBeGreaterThan(0);
        expect(loudLevel).toBeGreaterThan(0);
        expect(Math.abs(loudLevel - quietLevel)).toBeLessThan(0.35);
        expect(loudLevel).toBeLessThan(0.95);
    });

    it('reduces safety for clipped or over-compressed input shapes', () => {
        const service = createService() as unknown as AudioServiceInternals;

        expect(service.calculateInputShapeSafety(0.05, 0.26)).toBeGreaterThan(0.9);
        expect(service.calculateInputShapeSafety(0.14, 0.19)).toBeLessThan(0.45);
        expect(service.calculateInputShapeSafety(0.08, 0.96)).toBeLessThan(0.35);
        expect(service.calculateInputShapeSafety(0.5, 0.98)).toBeLessThan(0.12);
    });

    it('reduces safety for broadband noisy spectra', () => {
        const service = createService() as unknown as AudioServiceInternals;
        const binHz = 44100 / 1024;
        const noisy = Array(512).fill(1);
        const peaky = Array(512).fill(1e-6);

        peaky[Math.round(90 / binHz)] = 1;
        peaky[Math.round(180 / binHz)] = 0.6;
        peaky[Math.round(850 / binHz)] = 0.35;

        expect(service.calculateSpectralSafety(peaky, binHz)).toBeGreaterThan(0.85);
        expect(service.calculateSpectralSafety(noisy, binHz)).toBeLessThan(0.18);
    });

    it('keeps steady bands restrained and passes relative frequency flashes', () => {
        const service = createService() as unknown as AudioServiceInternals;
        const band = { ratioThreshold: 1.2 };

        let steady = 0;
        for (let i = 0; i < 64; i++) {
            steady = service.colorMusicGate('kick', 0.32, band);
        }

        const flash = service.colorMusicGate('kick', 0.72, band);
        const afterFlash = service.colorMusicGate('kick', 0.18, band);

        expect(steady).toBeGreaterThan(0);
        expect(steady).toBeLessThan(0.12);
        expect(flash).toBeGreaterThan(steady * 2.5);
        expect(afterFlash).toBeGreaterThan(0.05);
        expect(afterFlash).toBeLessThan(flash);
    });

    it('extracts a thirty-bin adaptive spectrum for dense visualizers', () => {
        const service = createService() as unknown as AudioServiceInternals;
        const binHz = 44100 / 1024;
        const mags = new Array(512).fill(1e-6);

        mags[Math.round(90 / binHz)] = 1;
        mags[Math.round(1100 / binHz)] = 0.7;
        mags[Math.round(7600 / binHz)] = 0.9;

        const bins = service.calculateSpectrumBins(mags, binHz);

        expect(bins).toHaveLength(30);
        expect(Math.max(...bins)).toBeGreaterThan(0.6);
        expect(bins.filter((value) => value > 0.2).length).toBeGreaterThanOrEqual(3);
    });

    it('maps frequency data into exactly sixteen WLED-like bands', () => {
        const frequencyData = new Uint8Array(512);
        frequencyData[2] = 220;
        frequencyData[40] = 180;
        frequencyData[180] = 150;

        const bands = mapFrequencyBinsTo16Bands(frequencyData, 44100);

        expect(bands).toHaveLength(16);
        expect(Math.max(...bands)).toBeGreaterThan(0);
        expect(bands.every((value) => value >= 0 && value <= 255)).toBe(true);
    });

    it('calculates near-zero raw volume for centered byte samples', () => {
        const silence = new Uint8Array(1024).fill(128);

        expect(calculateVolumeRaw(silence)).toBeLessThanOrEqual(1);
    });

    it('increases raw volume for larger byte sample deviations', () => {
        const quiet = Uint8Array.from({ length: 1024 }, (_, index) =>
            index % 2 === 0 ? 124 : 132,
        );
        const loud = Uint8Array.from({ length: 1024 }, (_, index) =>
            index % 2 === 0 ? 40 : 216,
        );

        expect(calculateVolumeRaw(loud)).toBeGreaterThan(calculateVolumeRaw(quiet));
    });

    it('detects peaks on sharp volume jumps and respects cooldown', () => {
        const first = detectPeak(
            120,
            50,
            { cooldownFrames: 0 },
            { peakMultiplier: 1.35, minPeakVolume: 35, cooldownFrames: 4 },
        );
        const second = detectPeak(
            130,
            55,
            { cooldownFrames: first.cooldownFrames },
            { peakMultiplier: 1.35, minPeakVolume: 35, cooldownFrames: 4 },
        );

        expect(first.samplePeak).toBe(true);
        expect(second.samplePeak).toBe(false);
        expect(second.cooldownFrames).toBe(3);
    });
});
