import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class StartEffectDto {
    @IsNumber()
    id: number;

    @IsString()
    effect: string;

    @IsBoolean()
    active: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(360)
    color?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    brightness?: number;
}

export class SetBrightnessDto {
    @IsNumber()
    @Min(0)
    @Max(1)
    brightness: number;
}

export class SetColorDto {
    @IsNumber()
    @Min(0)
    @Max(360)
    color: number;
}

export class StopEffectDto {
    @IsOptional()
    @IsNumber()
    id?: number;
}
