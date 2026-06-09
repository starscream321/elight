import { EffectsService } from './effects.service';
import { AudioService } from './audio.service';

describe('EffectsService effects', () => {
    let service: EffectsService;
    const defaultSpectrum = {
        kick: 0.7,
        bass: 0.5,
        mid: 0.4,
        treble: 0.3,
        energy: 0.6,
        beat: true,
        spectrum: Array.from({ length: 30 }, (_, index) =>
            index < 8 ? 0.7 : index < 18 ? 0.45 : 0.25,
        ),
    };
    const audioService = {
        getAudioSpectrum: jest.fn(() => defaultSpectrum),
    } as unknown as AudioService;

    beforeEach(() => {
        (audioService.getAudioSpectrum as jest.Mock).mockReturnValue(defaultSpectrum);
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

    const segmentLevels = (frame: Uint8Array, ledCount: number, segmentIndex: number) => {
        const segmentSize = ledCount / 8;
        const start = Math.floor(segmentIndex * segmentSize);
        const end = Math.floor((segmentIndex + 1) * segmentSize);
        const levels: number[] = [];

        for (let led = start; led < end; led++) {
            levels.push(pixelLevel(frame, led));
        }

        return levels;
    };

    it('music maps many frequency bins symmetrically inside each segment', async () => {
        const spectrumBins = new Array(30).fill(0.05);
        spectrumBins[0] = 1;
        spectrumBins[14] = 0.62;
        spectrumBins[29] = 0.9;
        (audioService.getAudioSpectrum as jest.Mock).mockReturnValue({
            kick: 0.8,
            bass: 0.55,
            mid: 0.4,
            treble: 0.7,
            energy: 0.75,
            beat: false,
            spectrum: spectrumBins,
        });

        const ledCount = 240;
        const frame = await service.music(ledCount, 1000, 0.8, 0);
        const levels = segmentLevels(frame, ledCount, 0);
        const center = levels[Math.floor(levels.length / 2)];
        const leftEdge = levels[0];
        const rightEdge = levels[levels.length - 1];
        const quarter = levels[Math.floor(levels.length * 0.25)];
        const quietBin = levels[Math.floor(levels.length * 0.38)];

        expect(center).toBeGreaterThan(quietBin * 1.5);
        expect(leftEdge).toBeGreaterThan(quietBin * 1.4);
        expect(rightEdge).toBeGreaterThan(quietBin * 1.4);
        expect(quarter).toBeGreaterThan(quietBin);
    });

    it('music compresses sustained high input instead of clipping the frame', async () => {
        (audioService.getAudioSpectrum as jest.Mock).mockReturnValue({
            kick: 0.95,
            bass: 0.95,
            mid: 0.95,
            treble: 0.95,
            energy: 0.95,
            beat: true,
            spectrum: new Array(30).fill(0.95),
        });

        const ledCount = 128;
        let frame = new Uint8Array(ledCount * 3);

        for (let frameIndex = 0; frameIndex < 24; frameIndex++) {
            frame = await service.music(ledCount, 1000 + frameIndex * 16, 1, 180);
        }

        const clippedChannels = frame.filter((value) => value >= 250).length;
        const maxChannel = frame.reduce((max, value) => Math.max(max, value), 0);
        const averageChannel =
            frame.reduce((sum, value) => sum + value, 0) / frame.length;

        expect(clippedChannels / frame.length).toBeLessThan(0.02);
        expect(maxChannel).toBeLessThan(180);
        expect(averageChannel).toBeLessThan(90);
    });

    it('music does not flash the whole strip for a flat spectrum', async () => {
        (audioService.getAudioSpectrum as jest.Mock).mockReturnValue({
            kick: 0.8,
            bass: 0.8,
            mid: 0.8,
            treble: 0.8,
            energy: 0.8,
            beat: true,
            spectrum: new Array(30).fill(0.7),
        });

        const ledCount = 240;
        const frame = await service.music(ledCount, 1000, 1, 180);
        const levels = Array.from({ length: ledCount }, (_, led) =>
            pixelLevel(frame, led),
        );
        const average =
            levels.reduce((sum, level) => sum + level, 0) / levels.length;
        const brightPixels = levels.filter((level) => level > 80).length;

        expect(average).toBeLessThan(45);
        expect(brightPixels / ledCount).toBeLessThan(0.12);
    });

    it('music suppresses overloaded low-contrast audio input', async () => {
        (audioService.getAudioSpectrum as jest.Mock).mockReturnValue({
            kick: 0.88,
            bass: 0.88,
            mid: 0.88,
            treble: 0.88,
            energy: 0.88,
            beat: true,
            safety: 0.05,
            spectrum: new Array(30).fill(0.9),
        });

        const ledCount = 240;
        let frame = new Uint8Array(ledCount * 3);

        for (let frameIndex = 0; frameIndex < 8; frameIndex++) {
            frame = await service.music(ledCount, 1000 + frameIndex * 16, 1, 180);
        }

        const levels = Array.from({ length: ledCount }, (_, led) =>
            pixelLevel(frame, led),
        );
        const average =
            levels.reduce((sum, level) => sum + level, 0) / levels.length;
        const brightPixels = levels.filter((level) => level > 45).length;

        expect(average).toBeLessThan(16);
        expect(brightPixels / ledCount).toBeLessThan(0.04);
    });
});
