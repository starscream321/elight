const dgram = require('dgram');
const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

function createArtNetPocket(data, universe) {
    let length = data.length;

    if (length % 2) {
        length += 1;
    }

    let hUni = (universe >> 8) & 0xff;
    let lUni = universe & 0xff;

    let hLen = (length >> 8) & 0xff;
    let lLen = (length & 0xff);

    let header = [
        'A'.charCodeAt(0),
        'r'.charCodeAt(0),
        't'.charCodeAt(0),
        '-'.charCodeAt(0),
        'N'.charCodeAt(0),
        'e'.charCodeAt(0),
        't'.charCodeAt(0),
        0, // Null termination
        0, // Null termination
        80, // 0x50 (OpCode: OpOutput / OpDmx)
        0, // Protocol version high byte
        14, // Protocol version low byte
        0, // data Sequence
        0,
        lUni,
        hUni,
        hLen,
        lLen
    ];

    return Buffer.from(header.concat(data));
}

function sendPacket(data, universe, ip) {
    return new Promise((resolve, reject) => {
        const packet = createArtNetPocket(data, universe);
        socket.send(packet, 6454, ip, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}



module.exports = { sendPacket };
