import type z from "zod/v4";

// helper: detect Zod types anywhere in a type
export type ContainsZod<T> =
  T extends z.ZodTypeAny ? true :
  T extends readonly (infer U)[] ? ContainsZod<U> :
  T extends (infer U)[] ? ContainsZod<U> :
  T extends object
    ? { [K in keyof T]: ContainsZod<T[K]> }[keyof T] extends true ? true : false
    : false;

// pretty error when Output contains Zod nodes
export type ForbidZodIn<T> =
  ContainsZod<T> extends true
    ? ["OutputContainsZodTypes", { Offending: T }]
    : unknown;
