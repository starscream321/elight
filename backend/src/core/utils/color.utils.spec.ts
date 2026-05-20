import { hsvToRgb, writeHsvToRgb } from './color.utils';

describe('color utils', () => {
    it('writes the same GRB values as hsvToRgb returns', () => {
        const samples = [
            { h: 0, s: 1, v: 1 },
            { h: 120, s: 1, v: 0.5 },
            { h: 240, s: 0.75, v: 0.25 },
            { h: 359, s: 1, v: 0.8 },
        ];

        for (const sample of samples) {
            const expected = hsvToRgb(sample.h, sample.s, sample.v);
            const buffer = new Uint8Array(3);

            writeHsvToRgb(buffer, 0, sample.h, sample.s, sample.v);

            expect(Array.from(buffer)).toEqual(expected);
        }
    });
});
