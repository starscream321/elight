import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Effect {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    icon: string;

    @Column({ default: false })
    active: boolean;
}
