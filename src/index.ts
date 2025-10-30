import z from "zod/v4";
type T<Input, Output> = (input: Input) => Output;

class Vertex<Schema extends z.ZodType<Input>, Output, Input = z.infer<Schema>> {
  execute: T<Input, Output> = () => {
    return {} as Output;
  };

  constructor(input: { input?: Schema; execute: T<Input, Output> }) {}
}

const a = new Vertex({
  input: z.string(),
  execute: (input) => {},
});

a.execute();
