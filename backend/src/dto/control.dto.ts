import {
    IsArray,
    ArrayNotEmpty,
    IsBoolean,
    IsOptional,
    IsString,
    IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ControlSingleDto {
    @IsString()
    id!: string;

    @IsBoolean()
    @Type(() => Boolean)
    on!: boolean;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    brightness?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    temperature_k?: number;
}


export class ControlManyDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    ids!: string[];

    @IsBoolean()
    @Type(() => Boolean)
    on!: boolean;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    brightness?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    temperature_k?: number;
}

export class CreateLightDto {
    @IsOptional()
    @IsString()
    id?: string;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    active?: boolean;

}


export class UpdateActiveDto {
    @IsBoolean()
    @Type(() => Boolean)
    active!: boolean;
}
