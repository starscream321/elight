import { Injectable } from '@nestjs/common';
import * as dgram from 'dgram';
import { createArtNetPacket } from './artnet.helper';

@Injectable()
export class ArtnetService {
    private socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    async sendPacket(data: Buffer | number[], universe: number, ip: string): Promise<void> {
        const packet = createArtNetPacket(data, universe);
        return new Promise((resolve, reject) => {
            this.socket.send(packet, 6454, ip, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async sendRgb(ip: string, universe: number, r: number, g: number, b: number): Promise<void> {
        await this.sendPacket([r, g, b], universe, ip);
    }
}
