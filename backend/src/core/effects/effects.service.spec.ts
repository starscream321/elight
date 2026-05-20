import { EffectsService } from './effects.service';
import { AudioService } from './audio.service';

describe('EffectsService effects', () => {
    let service: EffectsService;
    const audioService = {
        getAudioSpectrum: jest.fn(() => ({
            kick: 0.7,
            bass: 0.5,
            mid: 0.4,
            treble: 0.3,
            energy: 0.6,
            beat: true,
        })),
    } as unknown as AudioService;

    beforeEach(() => {
        service = new EffectsService({} as never, audioService);
        service.resetState();
    });

    const expectValidFrame = (frame: Uint8Array, ledCount: number) => {
        expect(frame).toBeInstanceOf(Uint8Array);
        expect(frame).toHaveLength(ledCount * 3);
        expect(frame.some((value) => value > 0)).toBe(true);
    };

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
});
