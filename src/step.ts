// Example 4 from the article: agent orchestration and AI pipelines.
// The article uses `llm`, `fillTemplate`, `Schema`, `parseAndValidate` and
// `reviewSchema` without defining them; the minimal versions below are mine.
// The model is injected, so the tests can use a fake one.

// An AI step takes an input and produces, asynchronously, an output.
// That's the "shape" shared by the whole system.
export type Step<I, O> = (input: I) => Promise<O>;

export type Model = { complete: (prompt: string) => Promise<string> };

export const fillTemplate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

// A schema is a check that turns unknown JSON into a T, or throws.
export type Schema<T> = (json: unknown) => T;

export const parseAndValidate = <T>(text: string, schema: Schema<T>): T =>
  schema(JSON.parse(text));

// Primitives

export const prompt =
  (llm: Model) =>
  (template: string): Step<Record<string, string>, string> =>
  async (vars) => {
    const filled = fillTemplate(template, vars);
    return await llm.complete(filled);
  };

export const extractJSON = <T>(schema: Schema<T>): Step<string, T> =>
  async (text) => parseAndValidate(text, schema);

// Combinators

// Chains two steps: the output of the first feeds the second.
export const chain = <A, B, C>(s1: Step<A, B>, s2: Step<B, C>): Step<A, C> =>
  async (input) => s2(await s1(input));

// Runs two steps in parallel on the same input.
export const parallel = <I, A, B>(
  s1: Step<I, A>,
  s2: Step<I, B>
): Step<I, [A, B]> =>
  async (input) => Promise.all([s1(input), s2(input)]);

// Retries until the verifier accepts the result.
export const retryUntil = <I, O>(
  s: Step<I, O>,
  verify: (out: O) => boolean,
  maxAttempts = 3
): Step<I, O> =>
  async (input) => {
    for (let i = 0; i < maxAttempts; i++) {
      const out = await s(input);
      if (verify(out)) return out;
    }
    throw new Error("Verification failed after all attempts");
  };

// The article's `analizarReseña`.
export type Review = { sentiment: string; summary: string };

export const reviewSchema: Schema<Review> = (json) => {
  const r = json as Partial<Review>;
  if (typeof r?.sentiment !== "string" || typeof r?.summary !== "string") {
    throw new Error("not a review");
  }
  return { sentiment: r.sentiment, summary: r.summary };
};

export const analyzeReview = (llm: Model): Step<{ text: string }, Review> =>
  chain(
    prompt(llm)("Analyze this review: {text}. Return JSON with sentiment and summary."),
    extractJSON<Review>(reviewSchema)
  );
