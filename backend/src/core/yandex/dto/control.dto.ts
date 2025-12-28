import {
    IsArray,
    ArrayNotEmpty,
    IsBoolean,
    IsOptional,
    IsString,
    IsNumber,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ControlSingleDto {
    @IsString()
    id!: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    on?: boolean;

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

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    on?: boolean;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    brightness?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    temperature_k?: number;
}

export class ControlScenarioDto {
    @IsString()
    scenarios_id!: string;

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
