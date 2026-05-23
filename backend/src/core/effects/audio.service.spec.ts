import { ConfigService } from '@nestjs/config';

import { AudioService } from './audio.service';

type AudioServiceInternals = {
    updateInputGain(windowRms: number, windowPeak?: number): number;
    softLimitSample(sample: number): number;
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
});
