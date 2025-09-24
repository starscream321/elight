import {Entity, Column, PrimaryColumn} from 'typeorm';

@Entity()
export class Zone {
    @PrimaryColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    icon: string;

    @Column()
    x: number;

    @Column()
    y: number;

    @Column()
    zone: string;

    @Column({ default: false })
    active: boolean;
}
