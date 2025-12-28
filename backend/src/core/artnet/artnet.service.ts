import { Injectable } from '@nestjs/common';
import * as dgram from 'dgram';

const ARTNET_PORT = 6454;
const DMX_SIZE = 512;
const PACKET_SIZE = 18 + DMX_SIZE;

@Injectable()
export class ArtnetService {
    private socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    private packet = Buffer.alloc(PACKET_SIZE);
    private sequence = 1;

    constructor() {
        this.packet[0] = 0x41;
        this.packet[1] = 0x72;
        this.packet[2] = 0x74;
        this.packet[3] = 0x2D;
        this.packet[4] = 0x4E;
        this.packet[5] = 0x65;
        this.packet[6] = 0x74;
        this.packet[7] = 0x00;

        this.packet[8] = 0x00;
        this.packet[9] = 0x50;

        this.packet[10] = 0x00;
        this.packet[11] = 0x0E;

        this.packet[12] = 0x01;
        this.packet[13] = 0x00;

        this.packet[16] = (DMX_SIZE >> 8) & 0xff;
        this.packet[17] = DMX_SIZE & 0xff;
    }

    async sendPacket(dmx: Uint8Array, universe: number, ip: string): Promise<void> {
        this.packet[12] = this.sequence;
        this.sequence = (this.sequence + 1) & 0xff;
        if (this.sequence === 0) this.sequence = 1;

        this.packet[14] = universe & 0xff;
        this.packet[15] = (universe >> 8) & 0xff;

        this.packet.set(dmx, 18);

        return new Promise((resolve, reject) => {
            this.socket.send(this.packet, ARTNET_PORT, ip, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

