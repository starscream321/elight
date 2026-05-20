import { Injectable } from '@nestjs/common';
import * as dgram from 'dgram';

const ARTNET_PORT = 6454;
const DMX_SIZE = 512;
const PACKET_SIZE = 18 + DMX_SIZE;

@Injectable()
export class ArtnetService {
  private socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  private header = Buffer.alloc(PACKET_SIZE);
  private sequence = 1;

  constructor() {
    this.header[0] = 0x41;
    this.header[1] = 0x72;
    this.header[2] = 0x74;
    this.header[3] = 0x2d;
    this.header[4] = 0x4e;
    this.header[5] = 0x65;
    this.header[6] = 0x74;
    this.header[7] = 0x00;

    this.header[8] = 0x00;
    this.header[9] = 0x50;

    this.header[10] = 0x00;
    this.header[11] = 0x0e;

    this.header[12] = 0x01;
    this.header[13] = 0x00;

    this.header[16] = (DMX_SIZE >> 8) & 0xff;
    this.header[17] = DMX_SIZE & 0xff;
  }

  async sendPacket(
    dmx: Uint8Array,
    universe: number,
    ip: string,
  ): Promise<void> {
    const packet = Buffer.from(this.header);

    packet[12] = this.sequence;
    this.sequence = (this.sequence + 1) & 0xff;
    if (this.sequence === 0) this.sequence = 1;

    packet[14] = universe & 0xff;
    packet[15] = (universe >> 8) & 0xff;

    packet.set(dmx.subarray(0, DMX_SIZE), 18);

    return new Promise((resolve, reject) => {
      this.socket.send(packet, ARTNET_PORT, ip, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
