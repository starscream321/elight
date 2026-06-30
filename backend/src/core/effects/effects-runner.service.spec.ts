import { ConfigService } from '@nestjs/config';

import { ArtnetService } from '../artnet/artnet.service';
import { EffectsService } from './effects.service';
import { EffectsRunnerService } from './effects-runner.service';

describe('EffectsRunnerService', () => {
  const createRunner = () => {
    const sentFrames: Uint8Array[] = [];
    const effect = jest.fn(
      async (length: number) => new Uint8Array(length * 3).fill(128),
    );
    const effectsService = {
      getEffectByName: jest.fn(() => effect),
      resetState: jest.fn(),
    } as unknown as EffectsService;
    const artnetService = {
      sendPacket: jest.fn(async (dmx: Uint8Array) => {
        sentFrames.push(Uint8Array.from(dmx));
      }),
    } as unknown as ArtnetService;
    const config = {
      get: jest.fn((name: string) => {
        const values: Record<string, string | number> = {
          ARTNET_IP: '127.0.0.1',
          TOTAL_DIODES: 4,
          EFFECTS_FPS: 60,
        };

        return values[name];
      }),
    } as unknown as ConfigService;

    return {
      runner: new EffectsRunnerService(effectsService, artnetService, config),
      effect,
      sentFrames,
    };
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not start the effects loop when brightness is zero', async () => {
    const { runner, effect, sentFrames } = createRunner();

    const started = await runner.start('rainbow', 0, 120);
    await jest.advanceTimersByTimeAsync(1000);

    expect(started).toBe(true);
    expect(effect).not.toHaveBeenCalled();
    expect(sentFrames).toHaveLength(1);
    expect(sentFrames[0].every((value) => value === 0)).toBe(true);
  });

  it('stops the effects loop when brightness is updated to zero', async () => {
    const { runner, effect, sentFrames } = createRunner();

    await runner.start('rainbow', 0.5, 120);
    await jest.advanceTimersByTimeAsync(0);

    expect(effect).toHaveBeenCalledTimes(1);

    await runner.updateBrightness(0);
    await jest.advanceTimersByTimeAsync(1000);

    expect(effect).toHaveBeenCalledTimes(1);
    expect(sentFrames.at(-1)?.every((value) => value === 0)).toBe(true);
  });
});
