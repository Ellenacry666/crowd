import { IsEnum } from 'class-validator';

export enum SimulatedOutcome {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export class SimulatePaymentDto {
  @IsEnum(SimulatedOutcome)
  outcome!: SimulatedOutcome;
}
