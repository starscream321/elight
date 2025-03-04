const dgram = require('dgram');
const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

let currentSequence = 0;

function createArtNetPacket(data, universe) {
    let length = Math.min(data.length, 512);
    let hUni = (universe >> 8) & 0xff;
    let lUni = universe & 0xff;

    let hLen = (length >> 8) & 0xff;
    let lLen = length & 0xff;

    currentSequence = (currentSequence + 1) & 0xFF;
    let sequence = currentSequence;

    let header = [
        'A'.charCodeAt(0), 'r'.charCodeAt(0), 't'.charCodeAt(0), '-'.charCodeAt(0),
        'N'.charCodeAt(0), 'e'.charCodeAt(0), 't'.charCodeAt(0), 0x00,
        0x00, 0x50,
        0x00, 0x0E,
        sequence,
        0x00,
        lUni, hUni,
        hLen, lLen
    ];

    return Buffer.from(header.concat(Array.from(data)));
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
