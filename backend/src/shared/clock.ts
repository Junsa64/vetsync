/** Puerto de tiempo: el dominio nunca lee la hora del sistema directamente. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
