let currentSequence = 0;

/**
 * Создаёт Art-Net DMX пакет по протоколу.
 * @param data - Буфер или массив с DMX-данными (не более 512 каналов)
 * @param universe - DMX Universe (номер вселенной)
 * @returns Буфер, готовый к отправке по UDP
 */
export function createArtNetPacket(data: Buffer | number[], universe: number): Buffer {
    if (!Buffer.isBuffer(data)) {
        data = Buffer.from(data);
    }

    const length = Math.min(data.length, 512);

    const paddedData = Buffer.alloc(512);
    data.copy(paddedData, 0, 0, length);

    const lUni = universe & 0xff;
    const hUni = (universe >> 8) & 0xff;
    const lLen = length & 0xff;
    const hLen = (length >> 8) & 0xff;

    currentSequence = (currentSequence + 1) & 0xFF;
    const sequence = currentSequence || 1;

    const header = Buffer.from([
        0x41, 0x72, 0x74, 0x2D, 0x4E, 0x65, 0x74, 0x00,
        0x00, 0x50,
        0x00, 0x0E,
        sequence,
        0x00,
        lUni, hUni,
        hLen, lLen
    ]);

    return Buffer.concat([header, paddedData]);
}
