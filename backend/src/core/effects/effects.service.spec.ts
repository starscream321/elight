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

    const averageSegmentBand = (
        frame: Uint8Array,
        ledCount: number,
        segmentIndex: number,
        bandIndex: number,
    ) => {
        const segmentSize = ledCount / 8;
        const start = Math.floor(segmentIndex * segmentSize + (bandIndex * segmentSize) / 4);
        const end = Math.floor(segmentIndex * segmentSize + ((bandIndex + 1) * segmentSize) / 4);
        let total = 0;
        let count = 0;

        for (let led = start; led < end; led++) {
            total += pixelLevel(frame, led);
            count++;
        }

        return count > 0 ? total / count : 0;
    };

    it('music maps frequency bands to fixed zones inside each segment', async () => {
        (audioService.getAudioSpectrum as jest.Mock).mockReturnValue({
            kick: 1,
            bass: 0.05,
            mid: 0.05,
            treble: 0.05,
            energy: 0.35,
            beat: false,
        });

        const ledCount = 160;
        const frame = await service.music(ledCount, 1000, 0.7, 0);
        const segmentSize = ledCount / 8;
        const firstSegmentKick = averageSegmentBand(frame, ledCount, 0, 0);
        const firstSegmentBass = averageSegmentBand(frame, ledCount, 0, 1);
        const firstSegmentMid = averageSegmentBand(frame, ledCount, 0, 2);
        const firstSegmentTreble = averageSegmentBand(frame, ledCount, 0, 3);
        const repeatedSegmentKick = averageSegmentBand(frame, ledCount, 4, 0);

        expect(segmentSize).toBe(20);
        expect(firstSegmentKick).toBeGreaterThan(firstSegmentBass * 1.4);
        expect(firstSegmentKick).toBeGreaterThan(firstSegmentMid * 1.4);
        expect(firstSegmentKick).toBeGreaterThan(firstSegmentTreble * 1.4);
        expect(repeatedSegmentKick).toBeGreaterThan(firstSegmentBass * 1.4);
    });

    it('music compresses sustained high input instead of clipping the frame', async () => {
        (audioService.getAudioSpectrum as jest.Mock).mockReturnValue({
            kick: 0.95,
            bass: 0.95,
            mid: 0.95,
            treble: 0.95,
            energy: 0.95,
            beat: true,
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
});
