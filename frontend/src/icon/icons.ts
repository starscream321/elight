import FlorIcon from '../assets/icons/floor.svg';
import TvIcon from '../assets/icons/tv.svg'
import MassageIcon from '../assets/icons/massage.svg';
import PcIcon from '../assets/icons/desktop.svg';
import TableIcon from '../assets/icons/table.svg';
import CeilingsIcon from '../assets/icons/ceiling.svg';
import EntranceIcon from '../assets/icons/entrance.svg';
import LockerIcon from '../assets/icons/locker.svg';
import EffectsOffIcon from '../assets/icons/effects-off.svg';
import CometIcon from '../assets/icons/comet.svg';
import PulseIcon from '../assets/icons/pulse.svg';
import RainbowIcon from '../assets/icons/rainbow.svg';
import AuroraIcon from '../assets/icons/aurora.svg';
import MusicIcon from '../assets/icons/music.svg';
import LightnessMaxIcon from '../assets/icons/lightness-max.svg';
import NightIcon from '../assets/icons/night.svg';
import DefaultLightIcon from '../assets/icons/default-light.svg';
import GamesIcon from '../assets/icons/games.svg';
import PartyIcon from '../assets/icons/party.svg';
import RomanceIcon from '../assets/icons/romance.svg';
import type {IconLightsKey} from '../types/zone';
import type {IconEffectsKey} from "../types/rgb.ts";
import type {IconScenariosKey} from "../types/scenarios.ts";
import type { Component } from 'vue';

const asIcon = (icon: unknown) => icon as Component;

export const iconMapLights: Record<IconLightsKey, Component> = {
    floor: asIcon(FlorIcon),
    tv: asIcon(TvIcon),
    massage: asIcon(MassageIcon),
    desktop: asIcon(PcIcon),
    table: asIcon(TableIcon),
    ceiling: asIcon(CeilingsIcon),
    entrance: asIcon(EntranceIcon),
    locker: asIcon(LockerIcon),
};

export const iconMapEffects: Record<IconEffectsKey, Component> = {
    effectsOff: asIcon(EffectsOffIcon),
    comet: asIcon(CometIcon),
    pulse: asIcon(PulseIcon),
    rainbow: asIcon(RainbowIcon),
    music: asIcon(MusicIcon),
    aurora: asIcon(AuroraIcon),
}

export const iconMapScenarios: Record<IconScenariosKey, Component> = {
    lightness_max: asIcon(LightnessMaxIcon),
    night: asIcon(NightIcon),
    default_light: asIcon(DefaultLightIcon),
    games: asIcon(GamesIcon),
    party: asIcon(PartyIcon),
    romance: asIcon(RomanceIcon),
}

