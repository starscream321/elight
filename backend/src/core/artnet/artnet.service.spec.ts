import { ArtnetService } from './artnet.service';

describe('ArtnetService', () => {
    it('clears unused DMX bytes between packets', async () => {
        const service = new ArtnetService();
        const serviceInternals = service as unknown as {
            socket: {
                send: jest.Mock;
                close: () => void;
            };
        };
        const packets: Buffer[] = [];

        serviceInternals.socket.send = jest.fn(
            (packet: Buffer, _port: number, _ip: string, callback: (err: Error | null) => void) => {
                packets.push(Buffer.from(packet));
                callback(null);
            },
        );

        await service.sendPacket(new Uint8Array(512).fill(255), 0, '127.0.0.1');
        await service.sendPacket(new Uint8Array([1, 2, 3]), 1, '127.0.0.1');

        expect(packets[1][18]).toBe(1);
        expect(packets[1][19]).toBe(2);
        expect(packets[1][20]).toBe(3);
        expect(packets[1][21]).toBe(0);
        expect(packets[1][18 + 511]).toBe(0);

        serviceInternals.socket.close();
    });
});
