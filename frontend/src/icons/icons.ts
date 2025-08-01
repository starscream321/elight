import FlorIcon from './assets/icons/floor.svg';
import TvIcon from './assets/icons/tv.svg';
import MassageIcon from './assets/icons/massage.svg';
import PcIcon from './assets/icons/desktop.svg';
import TableIcon from './assets/icons/table.svg';
import CeilingsIcon from './assets/icons/ceiling.svg';
import EntranceIcon from './assets/icons/entrance.svg';
import LockerIcon from './assets/icons/locker.svg';
import type { IconKey } from '../types/zone';

export const iconMap: Record<IconKey, any> = {
    floor: FlorIcon,
    tv: TvIcon,
    massage: MassageIcon,
    desktop: PcIcon,
    table: TableIcon,
    ceiling: CeilingsIcon,
    entrance: EntranceIcon,
    locker: LockerIcon,
};