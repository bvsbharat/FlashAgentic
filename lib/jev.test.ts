import assert from "node:assert/strict";
import test from "node:test";
import { interpretTranscript } from "./interpret";
import { drinksFromAnswers, interpretWithJev, type JevCaller } from "./jev";

function answer(choice: string) {
  return { type: "choice" as const, choice, confidence: 1, probabilities: { [choice]: 1 } };
}

function order(slots: Array<{ type: string; size: string; shots: string; milk: string; temp: string } | null>) {
  const answers: Record<string, { choice: string }> = {};
  for (let index = 0; index < 4; index += 1) {
    const slot = index + 1;
    const drink = slots[index];
    answers[`d${slot}_type`] = answer(drink?.type ?? "none");
    answers[`d${slot}_size`] = answer(drink?.size ?? "grande");
    answers[`d${slot}_shots`] = answer(drink?.shots ?? "2");
    answers[`d${slot}_milk`] = answer(drink?.milk ?? "whole");
    answers[`d${slot}_temp`] = answer(drink?.temp ?? "hot");
  }
  return answers;
}

const icedOatMatcha = {
  type: "matcha",
  size: "grande",
  shots: "2",
  milk: "oat",
  temp: "iced",
};

function mockCaller(answers: Record<string, { choice: string }>, seen: string[]): JevCaller {
  return {
    async systemOne(request) {
      seen.push(request.state.transcript);
      assert.equal(request.model, "jev-latest");
      assert.equal(typeof request.questions.d1_type, "object");
      assert.equal(request.questions.d4_temp.type, "choice");
      return { answers };
    },
  };
}

test("a mock Jev reading becomes the order", async () => {
  const seen: string[] = [];
  const drinks = await interpretWithJev("can i get a matcha let's make it iced with oat milk", {
    client: mockCaller(order([icedOatMatcha]), seen),
  });
  assert.deepEqual(drinks, [
    {
      id: "matcha-jev-1",
      type: "matcha",
      size: "Grande",
      shots: 2,
      milk: "Oat",
      temp: "Iced",
    },
  ]);
  assert.deepEqual(seen, ["can i get a matcha let's make it iced with oat milk"]);
});

test("the final scripted order maps from Jev slots", () => {
  const drinks = drinksFromAnswers(
    order([
      icedOatMatcha,
      { type: "latte", size: "tall", shots: "3", milk: "oat", temp: "iced" },
      { type: "latte", size: "venti", shots: "2", milk: "whole", temp: "hot" },
    ]),
    "full order",
  );
  assert.deepEqual(
    drinks?.map((drink) => [drink.type, drink.size, drink.shots, drink.milk, drink.temp]),
    [
      ["matcha", "Grande", 2, "Oat", "Iced"],
      ["latte", "Tall", 3, "Oat", "Iced"],
      ["latte", "Venti", 2, "Whole", "Hot"],
    ],
  );
});

test("an empty reading of a spoken transcript is unusable", () => {
  assert.equal(drinksFromAnswers(order([]), "can i get a matcha"), null);
});

test("without a key the parser is the order", async () => {
  const result = await interpretTranscript("can i get a matcha");
  assert.equal(result.source, "parser");
  assert.equal(result.drinks[0]?.type, "matcha");
  assert.equal(result.drinks[0]?.temp, "Hot");
});

test("a Jev client is the primary reading", async () => {
  const result = await interpretTranscript("can i get a matcha let's make it iced", {
    client: mockCaller(order([{ ...icedOatMatcha, milk: "whole" }]), []),
  });
  assert.equal(result.source, "jev");
  assert.equal(result.drinks[0]?.temp, "Iced");
  assert.equal(result.drinks[0]?.milk, "Whole");
});

test("a failed Jev call falls back to the parser", async () => {
  const client: JevCaller = {
    async systemOne() {
      throw new Error("timeout");
    },
  };
  const result = await interpretTranscript("can i get a matcha", { apiKey: "test-key", client });
  assert.equal(result.source, "parser");
  assert.equal(result.drinks[0]?.type, "matcha");
});
