// The article's examples, run: what each one returns.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { integer } from "../src/parser";
import { vipUsers } from "../src/predicate";
import { analyzeReview, retryUntil, type Model, type Step } from "../src/step";
import { ProtectedProfile, session } from "../src/ui";

describe("Example 1: parsers", () => {
  test("integer reads one or more digits and leaves the rest", () => {
    expect(integer("123abc")).toEqual({ ok: true, value: 123, rest: "abc" });
  });
  test("integer needs at least one digit", () => {
    expect(integer("abc")).toEqual({ ok: false });
  });
});

describe("Example 2: queries", () => {
  test("vipUsers builds the SQL and the parameters the article shows", () => {
    expect(vipUsers.sql).toBe("(age >= ?) AND (active = ?)");
    expect(vipUsers.params).toEqual([18, true]);
  });
});

describe("Example 3: higher-order components", () => {
  test("signed out, the profile asks to sign in", () => {
    session.user = null;
    expect(renderToString(<ProtectedProfile name="Ada" isLoading={false} />)).toBe(
      "<p>please sign in</p>"
    );
  });
  test("signed in and loading, it shows the spinner", () => {
    session.user = "ada";
    expect(renderToString(<ProtectedProfile name="Ada" isLoading={true} />)).toBe(
      "<p>loading…</p>"
    );
  });
  test("signed in and loaded, it shows the profile", () => {
    session.user = "ada";
    expect(renderToString(<ProtectedProfile name="Ada" isLoading={false} />)).toBe(
      "<h1>Ada</h1>"
    );
  });
});

describe("Example 4: pipelines", () => {
  // A fake model: it answers with fixed JSON and records the prompt it got.
  const prompts: string[] = [];
  const fake: Model = {
    complete: async (p) => {
      prompts.push(p);
      return JSON.stringify({ sentiment: "positive", summary: "great coffee" });
    },
  };

  test("analyzeReview fills the template, calls the model and validates the JSON", async () => {
    const review = await analyzeReview(fake)({ text: "Best coffee in town" });
    expect(review).toEqual({ sentiment: "positive", summary: "great coffee" });
    expect(prompts.at(-1)).toBe(
      "Analyze this review: Best coffee in town. Return JSON with sentiment and summary."
    );
  });

  test("retryUntil retries until the verifier accepts", async () => {
    let calls = 0;
    const flaky: Step<string, number> = async () => ++calls;
    expect(await retryUntil(flaky, (n) => n === 3)("x")).toBe(3);
  });

  test("retryUntil gives up after maxAttempts", async () => {
    let calls = 0;
    const never: Step<string, number> = async () => ++calls;
    await expect(retryUntil(never, () => false, 3)("x")).rejects.toThrow(
      "Verification failed after all attempts"
    );
    expect(calls).toBe(3);
  });
});
