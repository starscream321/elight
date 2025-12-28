export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    h %= 360;
    if (h < 0) h += 360;

    s = s > 1 ? 1 : s < 0 ? 0 : s;
    v = v > 1 ? 1 : v < 0 ? 0 : v;

    if (s === 0) {
        const x = (v * 255) | 0;
        return [x, x, x];
    }

    const c = v * s;
    const m = v - c;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));

    let r = 0, g = 0, b = 0;

    if (hp < 1) {
        r = c; g = x; b = 0;
    } else if (hp < 2) {
        r = x; g = c; b = 0;
    } else if (hp < 3) {
        r = 0; g = c; b = x;
    } else if (hp < 4) {
        r = 0; g = x; b = c;
    } else if (hp < 5) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }

    const R = ((r + m) * 255) | 0;
    const G = ((g + m) * 255) | 0;
    const B = ((b + m) * 255) | 0;

    return [G, R, B];
}
