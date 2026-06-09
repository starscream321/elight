import { EffectsService } from './effects.service';
import { AudioService } from './audio.service';
import { WledLikeAudioData } from './wled-audio.utils';
import { renderWledMusicEffect } from './wled-music.effect';

describe('EffectsService effects', () => {
    let service: EffectsService;
    const defaultAudio: WledLikeAudioData = {
        volumeRaw: 150,
        volumeSmth: 165,
        fftResult: Uint8Array.from({ length: 16 }, (_, index) =>
            index < 5 ? 220 : index < 11 ? 170 : 130,
        ),
        samplePeak: true,
        bass: 220,
        mids: 170,
        highs: 130,
    };
    const audioService = {
        getWledLikeAudioData: jest.fn(() => defaultAudio),
    } as unknown as AudioService;

    beforeEach(() => {
        (audioService.getWledLikeAudioData as jest.Mock).mockReturnValue(defaultAudio);
        service = new EffectsService({} as never, audioService);
        service.resetState();
    });

    const expectValidFrame = (frame: Uint8Array, ledCount: number) => {
        expect(frame).toBeInstanceOf(Uint8Array);
        expect(frame).toHaveLength(ledCount * 3);
        expect(frame.some((value) => value > 0)).toBe(true);
    };

    const pixelLevel = (frame: Uint8Array, led: number) =>
        frame[led * 3] + frame[led * 3 + 1] + frame[led * 3 + 2];

    it.each([
        ['staticColor', 1000, 0.5, 220],
        ['rainbow', 1000, 0.5, 0],
        ['smoothFade', 1200, 0.5, 40],
        ['music', 1000, 0.5, 180],
        ['comet', 1000, 0.5, 0],
        ['aurora', 1000, 0.5, 0],
    ])('%s returns a non-empty frame with the expected length', async (effectName, time, brightness, hue) => {
        const ledCount = 64;
        const effect = service.getEffectByName(effectName);

        expect(effect).toBeDefined();

        const frame = await effect!(ledCount, time, brightness, hue);
        expectValidFrame(frame, ledCount);
    });

    it('returns black frames when brightness is zero', async () => {
        const ledCount = 16;
        const effects = ['staticColor', 'rainbow', 'smoothFade', 'music', 'comet', 'aurora'];

        for (const effectName of effects) {
            const effect = service.getEffectByName(effectName);
            const frame = await effect!(ledCount, 1000, 0, 120);

            expect(frame).toHaveLength(ledCount * 3);
            expect(frame.every((value) => value === 0)).toBe(true);
        }
    });

    const averageChannel = (
        frame: Uint8Array,
        ledCount: number,
        startRatio: number,
        endRatio: number,
        channelOffset: number,
    ) => {
        const start = Math.floor(ledCount * startRatio);
        const end = Math.max(start + 1, Math.floor(ledCount * endRatio));
        let sum = 0;

        for (let led = start; led < end; led++) {
            sum += frame[led * 3 + channelOffset];
        }

        return sum / (end - start);
    };

    it('music maps bass, mids and highs to the expected strip zones', async () => {
        (audioService.getWledLikeAudioData as jest.Mock).mockReturnValue({
            volumeRaw: 170,
            volumeSmth: 190,
            fftResult: Uint8Array.from({ length: 16 }, (_, index) =>
                index < 5 ? 240 : index < 11 ? 60 : 45,
            ),
            samplePeak: false,
            bass: 245,
            mids: 60,
            highs: 45,
        } satisfies WledLikeAudioData);

        const ledCount = 120;
        const frame = await service.music(ledCount, 1000, 1, 0);

        const bassBlue = averageChannel(frame, ledCount, 0, 0.3, 2);
        const midsGreen = averageChannel(frame, ledCount, 0.3, 0.7, 0);
        const highsRed = averageChannel(frame, ledCount, 0.7, 1, 1);

        expect(bassBlue).toBeGreaterThan(midsGreen);
        expect(bassBlue).toBeGreaterThan(highsRed);
    });

    it('music adds a white flash across the whole strip on sample peaks', async () => {
        const ledCount = 90;
        const frame = await service.music(ledCount, 1000, 1, 0);

        const dimmestChannel = frame.reduce(
            (min, value) => Math.min(min, value),
            255,
        );

        expect(dimmestChannel).toBeGreaterThan(130);
    });

    it('music fades previous pixels instead of switching off instantly', async () => {
        (audioService.getWledLikeAudioData as jest.Mock)
            .mockReturnValueOnce({
                volumeRaw: 180,
                volumeSmth: 200,
                fftResult: new Uint8Array(16).fill(220),
                samplePeak: false,
                bass: 240,
                mids: 20,
                highs: 20,
            } satisfies WledLikeAudioData)
            .mockReturnValueOnce({
                volumeRaw: 0,
                volumeSmth: 0,
                fftResult: new Uint8Array(16),
                samplePeak: false,
                bass: 0,
                mids: 0,
                highs: 0,
            } satisfies WledLikeAudioData);

        const ledCount = 60;
        const firstFrame = await service.music(ledCount, 1000, 1, 0);
        const secondFrame = await service.music(ledCount, 1016, 1, 0);
        const firstLevel = pixelLevel(firstFrame, 2);
        const secondLevel = pixelLevel(secondFrame, 2);

        expect(secondLevel).toBeGreaterThan(0);
        expect(secondLevel).toBeLessThan(firstLevel);
    });

    it('music keeps every RGB channel in byte range', async () => {
        const frame = await service.music(128, 1000, 1, 0);

        expect(frame.every((value) => value >= 0 && value <= 255)).toBe(true);
    });

    it('renderWledMusicEffect returns ledCount pixels with RGB byte values', () => {
        const pixels = renderWledMusicEffect(defaultAudio, [], {
            ledCount: 32,
            smoothing: 0.82,
            peakMultiplier: 1.35,
            minPeakVolume: 35,
            peakFlashDecay: 0.78,
        });

        expect(pixels).toHaveLength(32);
        expect(
            pixels.every(
                (pixel) =>
                    pixel.r >= 0 &&
                    pixel.r <= 255 &&
                    pixel.g >= 0 &&
                    pixel.g <= 255 &&
                    pixel.b >= 0 &&
                    pixel.b <= 255,
            ),
        ).toBe(true);
    });
});
