declare module "fft.js" {
  export default class FFT {
    constructor(size: number);
    size: number;
    createComplexArray(): number[];
    toComplexArray(input: ArrayLike<number>, storage?: number[]): number[];
    transform(out: number[], data: number[]): void;
    realTransform(out: number[], data: number[]): void;
    inverseTransform(out: number[], data: number[]): void;
  }
}
