const hsvToRgb = (h, s, v) => {
    let r, g, b;

    h = h % 360;
    s = Math.min(Math.max(s, 0), 1);
    v = Math.min(Math.max(v, 0), 1);


    if (s === 0) {
        r = g = b = v;
    } else {
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;

        let r1, g1, b1;
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




const getRandomSovietColor = () => {
    const sovietColors = [
        [255, 0, 0],   // Зеленый
        [0, 255, 0],   // Красный
        [255, 255, 0], // Желтый
        [0, 0, 255],   // Синий
    ];
    return sovietColors[Math.floor(Math.random() * sovietColors.length)];
};

module.exports = { hsvToRgb, getRandomSovietColor}
