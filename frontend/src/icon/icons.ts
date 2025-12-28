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

export const iconMapLights: Record<IconLightsKey, any> = {
    floor: FlorIcon,
    tv: TvIcon,
    massage: MassageIcon,
    desktop: PcIcon,
    table: TableIcon,
    ceiling: CeilingsIcon,
    entrance: EntranceIcon,
    locker: LockerIcon,
};

export const iconMapEffects: Record<IconEffectsKey, any> = {
    effectsOff: EffectsOffIcon,
    comet: CometIcon,
    pulse: PulseIcon,
    rainbow: RainbowIcon,
    music: MusicIcon,
    aurora: AuroraIcon,
}

export const iconMapScenarios: Record<IconScenariosKey, any> = {
    lightness_max: LightnessMaxIcon,
    night: NightIcon,
    default_light: DefaultLightIcon,
    games: GamesIcon,
    party: PartyIcon,
    romance: RomanceIcon,
}

