export function hsvToRgb (h: number, s: number, v: number) {
    let r: number, g: number, b: number;

    h = h % 360;
    s = Math.min(Math.max(s, 0), 1);
    v = Math.min(Math.max(v, 0), 1);


    if (s === 0) {
        r = g = b = v;
    } else {
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;

        let r1: number, g1: number, b1: number;
        if (h >= 0 && h < 60) {
            r1 = c;
            g1 = x;
            b1 = 0;
        } else if (h >= 60 && h < 120) {
            r1 = x;
            g1 = c;
            b1 = 0;
        } else if (h >= 120 && h < 180) {
            r1 = 0;
            g1 = c;
            b1 = x;
        } else if (h >= 180 && h < 240) {
            r1 = 0;
            g1 = x;
            b1 = c;
        } else if (h >= 240 && h < 300) {
            r1 = x;
            g1 = 0;
            b1 = c;
        } else {
            r1 = c;
            g1 = 0;
            b1 = x;
        }

        r = Math.round((r1 + m) * 255);
        g = Math.round((g1 + m) * 255);
        b = Math.round((b1 + m) * 255);
    }

    return [g, r, b];
};


export function createColorArray(
    length: number,
    mapper: (i: number) => [number, number, number]
): number[] {
    const result: number[] = [];

    for (let i = 0; i < length; i++) {
        const [g, r, b] = mapper(i);
        result.push(g, r, b);
    }

    return result;
}