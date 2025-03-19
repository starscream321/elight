const dgram = require('dgram');
const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

let currentSequence = 0;

// Глобальная обработка ошибок сокета (чтобы не создавать лишние обработчики)
socket.on('error', (err) => {
    console.error('Socket error:', err);
});

function createArtNetPacket(data, universe) {
    if (!Buffer.isBuffer(data)) {
        data = Buffer.from(data); // Преобразуем в Buffer, если data — массив или Uint8Array
    }

    let length = Math.min(data.length, 512);
    let paddedData = Buffer.alloc(512); // Создаём буфер фиксированной длины (512 байт)
    data.copy(paddedData, 0, 0, length); // Копируем реальные данные

    let hUni = (universe >> 8) & 0xff;
    let lUni = universe & 0xff;

    let hLen = (length >> 8) & 0xff;
    let lLen = length & 0xff;

    currentSequence = (currentSequence + 1) & 0xFF;
    let sequence = currentSequence || 1; // Art-Net требует, чтобы sequence не был 0

    let header = Buffer.from([
        0x41, 0x72, 0x74, 0x2D, 0x4E, 0x65, 0x74, 0x00, // "Art-Net\0"
        0x00, 0x50, // OpOutput (0x5000)
        0x00, 0x0E, // Protocol version (14)
        sequence,   // Sequence number (1-255, 0 - запрещён)
        0x00,       // Physical (обычно 0)
        lUni, hUni, // Universe (Low, High)
        hLen, lLen  // Data length (Low, High)
    ]);

    return Buffer.concat([header, paddedData]);
}

function sendPacket(data, universe, ip) {
    return new Promise((resolve, reject) => {
        const packet = createArtNetPacket(data, universe);

        socket.send(packet, 6454, ip, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = { sendPacket };
