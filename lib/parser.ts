import { orderControlSpan } from "./checkout-cues";
import type { Drink, DrinkType, Milk, Size, Temp } from "./types";

const NUMBER: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  single: 1,
  double: 2,
  triple: 3,
};

const SIZE: Record<string, Size> = {
  small: "Tall",
  tall: "Tall",
  medium: "Grande",
  grande: "Grande",
  regular: "Grande",
  large: "Venti",
  big: "Venti",
  venti: "Venti",
};

const MILK: Record<string, Milk> = {
  oat: "Oat",
  oats: "Oat",
  oatmilk: "Oat",
  whole: "Whole",
  almond: "Almond",
  skim: "Skim",
  nonfat: "Skim",
  skinny: "Skim",
};

const DESCRIPTORS = new Set([
  "small",
  "tall",
  "medium",
  "grande",
  "regular",
  "large",
  "big",
  "venti",
  "hot",
  "iced",
  "cold",
  "warm",
]);

const ADD_VERBS = new Set(["add", "get", "order", "grab", "have", "want", "like"]);

export function normalizeTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9%'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  return normalizeTranscript(input)
    .replace(/let's/g, "lets")
    .replace(/'/g, "")
    .split(" ")
    .filter(Boolean);
}

function drinkAt(
  tokens: string[],
  index: number,
): { type: DrinkType; consumed: number; iced: boolean } | null {
  if (index >= tokens.length) return null;
  let iced = false;
  let cursor = index;
  if (tokens[cursor] === "iced" || tokens[cursor] === "ice") {
    iced = true;
    cursor += 1;
  }
  const word = tokens[cursor];
  if (!word) return null;

  if (word === "matcha" || word === "matchas") {
    const extra = tokens[cursor + 1] === "latte" || tokens[cursor + 1] === "lattes" ? 1 : 0;
    return { type: "matcha", consumed: cursor - index + 1 + extra, iced };
  }
  if (word === "cappuccino" || word === "cappuccinos") {
    return { type: "cappuccino", consumed: cursor - index + 1, iced };
  }
  if (word === "caffe" || word === "cafe") {
    const extra = tokens[cursor + 1] === "latte" || tokens[cursor + 1] === "lattes" ? 1 : 0;
    return { type: "latte", consumed: cursor - index + 1 + extra, iced };
  }
  if (word === "latte" || word === "lattes") {
    return { type: "latte", consumed: cursor - index + 1, iced };
  }
  return null;
}

function indicesOf(drinks: Drink[], type: DrinkType): number[] {
  const found: number[] = [];
  drinks.forEach((drink, index) => {
    if (drink.type === type) found.push(index);
  });
  return found;
}

function matchesDescriptor(drink: Drink, word: string): boolean {
  if (word === "small" || word === "tall") return drink.size === "Tall";
  if (word === "medium" || word === "grande" || word === "regular") return drink.size === "Grande";
  if (word === "large" || word === "big" || word === "venti") return drink.size === "Venti";
  if (word === "iced" || word === "cold") return drink.temp === "Iced";
  if (word === "hot" || word === "warm") return drink.temp === "Hot";
  return false;
}

function findByDescriptor(drinks: Drink[], word: string, group: number[] | null): number {
  const pools = group && group.length ? [group, drinks.map((_, index) => index)] : [drinks.map((_, index) => index)];
  for (const pool of pools) {
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      const index = pool[i];
      if (matchesDescriptor(drinks[index], word)) return index;
    }
  }
  return -1;
}

type Modifier =
  | { kind: "size"; size: Size; next: number }
  | { kind: "shots"; shots: number; next: number }
  | { kind: "shots-delta"; delta: number; next: number }
  | { kind: "milk"; milk: Milk; next: number }
  | { kind: "temp"; temp: Temp; next: number };

function readModifier(tokens: string[], index: number): Modifier | null {
  const word = tokens[index];
  const next = tokens[index + 1];
  if (!word) return null;

  if (SIZE[word]) return { kind: "size", size: SIZE[word], next: index + 1 };

  if ((word === "extra" || word === "another") && (next === "shot" || next === "shots")) {
    return { kind: "shots-delta", delta: 1, next: index + 2 };
  }
  if (NUMBER[word] !== undefined && (next === "shot" || next === "shots")) {
    return { kind: "shots", shots: NUMBER[word], next: index + 2 };
  }

  if (word === "oatmilk") return { kind: "milk", milk: "Oat", next: index + 1 };
  if (MILK[word] && (next === "milk" || next === "milks")) {
    return { kind: "milk", milk: MILK[word], next: index + 2 };
  }

  if (word === "hot" || word === "warm") return { kind: "temp", temp: "Hot", next: index + 1 };
  if ((word === "iced" || word === "ice" || word === "cold") && next !== "matcha" && next !== "matchas" && next !== "latte" && next !== "lattes" && next !== "cappuccino" && next !== "cappuccinos") {
    return { kind: "temp", temp: "Iced", next: index + 1 };
  }
  return null;
}

function applyModifier(drink: Drink, modifier: Modifier) {
  if (modifier.kind === "size") drink.size = modifier.size;
  if (modifier.kind === "shots") drink.shots = Math.min(6, Math.max(1, modifier.shots));
  if (modifier.kind === "shots-delta") drink.shots = Math.min(6, drink.shots + modifier.delta);
  if (modifier.kind === "milk") drink.milk = modifier.milk;
  if (modifier.kind === "temp") drink.temp = modifier.temp;
}

type Add = { type: DrinkType; count: number; iced: boolean; next: number };

function readAdd(tokens: string[], index: number): Add | null {
  const word = tokens[index];
  if (!word) return null;

  const from = (cursor: number, count: number): Add | null => {
    if (tokens[cursor] === "more" || tokens[cursor] === "another") cursor += 1;
    const drink = drinkAt(tokens, cursor);
    if (!drink) return null;
    return { type: drink.type, count, iced: drink.iced, next: cursor + drink.consumed };
  };

  if (ADD_VERBS.has(word)) {
    let cursor = index + 1;
    if (tokens[cursor] === "me" || tokens[cursor] === "us") cursor += 1;
    let count = 1;
    if (tokens[cursor] === "a" || tokens[cursor] === "an") cursor += 1;
    else if (NUMBER[tokens[cursor]] !== undefined && tokens[cursor + 1] !== "of" && tokens[cursor + 1] !== "shot" && tokens[cursor + 1] !== "shots") {
      count = NUMBER[tokens[cursor]];
      cursor += 1;
    }
    return from(cursor, count);
  }

  if (word === "can" && (tokens[index + 1] === "i" || tokens[index + 1] === "we") && ADD_VERBS.has(tokens[index + 2] ?? "")) {
    return readAdd(tokens, index + 2);
  }

  if (word === "another") return from(index + 1, 1);

  if (NUMBER[word] !== undefined && tokens[index + 1] === "more") {
    return from(index + 2, NUMBER[word]);
  }

  if ((word === "and" || word === "plus" || word === "also") && tokens[index + 1] !== "then") {
    let cursor = index + 1;
    let count = 1;
    if (tokens[cursor] === "a" || tokens[cursor] === "an") cursor += 1;
    else if (NUMBER[tokens[cursor]] !== undefined && tokens[cursor + 1] !== "of" && tokens[cursor + 1] !== "shot" && tokens[cursor + 1] !== "shots") {
      count = NUMBER[tokens[cursor]];
      cursor += 1;
    } else return null;
    return from(cursor, count);
  }

  if ((word === "a" || word === "an" || NUMBER[word] !== undefined) && tokens[index + 1] !== "of" && tokens[index + 1] !== "more" && tokens[index + 1] !== "shot" && tokens[index + 1] !== "shots") {
    const count = word === "a" || word === "an" ? 1 : NUMBER[word];
    const start = word === "a" || word === "an" ? index + 1 : index + 1;
    return from(start, count);
  }

  return null;
}

function isRemove(tokens: string[], index: number): number {
  const word = tokens[index];
  if (word === "get" && tokens[index + 1] === "rid" && tokens[index + 2] === "of") return index + 3;
  if (word === "remove" || word === "cancel" || word === "scratch" || word === "drop" || word === "delete" || word === "nix") {
    return index + 1;
  }
  return -1;
}

function createDrink(type: DrinkType, temp: Temp, id: number): Drink {
  return {
    id: `${type}-${id}`,
    type,
    size: "Grande",
    shots: 2,
    milk: "Whole",
    temp,
  };
}

/**
 * Turn a running transcript into the order it describes.
 * The function is pure: the same text always yields the same drinks and ids,
 * so it can run on every interim speech result.
 */
export function parseOrder(transcript: string): Drink[] {
  const tokens = tokenize(transcript);
  const drinks: Drink[] = [];
  let focus = -1;
  let group: number[] | null = null;
  let nextId = 1;

  const retarget = (index: number) => {
    if (index >= 0 && index < drinks.length) focus = index;
  };

  let index = 0;
  while (index < tokens.length) {
    const control = orderControlSpan(tokens, index);
    if (control > 0) {
      index += control;
      continue;
    }

    const word = tokens[index];

    const removeAt = isRemove(tokens, index);
    if (removeAt >= 0) {
      let cursor = removeAt;
      if (tokens[cursor] === "the" || tokens[cursor] === "that" || tokens[cursor] === "this" || tokens[cursor] === "a") {
        cursor += 1;
      }
      let target = -1;
      if (tokens[cursor] === "other") {
        const pool = group && group.length ? group : focus >= 0 ? indicesOf(drinks, drinks[focus].type) : [];
        const others = pool.filter((item) => item !== focus);
        target = others.length ? others[others.length - 1] : -1;
        cursor += 1;
        if (tokens[cursor] === "one" || tokens[cursor] === "ones") cursor += 1;
      } else if (DESCRIPTORS.has(tokens[cursor]) && (tokens[cursor + 1] === "one" || tokens[cursor + 1] === "ones")) {
        target = findByDescriptor(drinks, tokens[cursor], group);
        cursor += 2;
      } else if (tokens[cursor] === "it" || tokens[cursor] === "one") {
        target = focus;
        cursor += 1;
      } else {
        const drink = drinkAt(tokens, cursor);
        if (drink) {
          let pool = indicesOf(drinks, drink.type);
          if (drink.iced) {
            const iced = pool.filter((item) => drinks[item].temp === "Iced");
            if (iced.length) pool = iced;
          }
          target = pool.length ? pool[pool.length - 1] : -1;
          cursor += drink.consumed;
        }
      }
      if (target >= 0) {
        drinks.splice(target, 1);
        if (group) group = group.filter((item) => item !== target).map((item) => (item > target ? item - 1 : item));
        if (focus === target) focus = Math.min(target, drinks.length - 1);
        else if (focus > target) focus -= 1;
        if (focus >= drinks.length) focus = drinks.length - 1;
      }
      index = target >= 0 || cursor > removeAt ? cursor : index + 1;
      continue;
    }

    if ((word === "one" || word === "1") && tokens[index + 1] === "of") {
      let cursor = index + 2;
      if (tokens[cursor] === "the" || tokens[cursor] === "those" || tokens[cursor] === "these") cursor += 1;
      const drink = drinkAt(tokens, cursor);
      if (drink) {
        const pool = indicesOf(drinks, drink.type);
        group = pool;
        if (pool.length) focus = pool[pool.length - 1];
        index = cursor + drink.consumed;
        continue;
      }
    }

    if (word === "the" && tokens[index + 1] === "other") {
      const pool = group && group.length ? group : focus >= 0 ? indicesOf(drinks, drinks[focus].type) : [];
      const others = pool.filter((item) => item !== focus);
      if (others.length) focus = others[others.length - 1];
      let cursor = index + 2;
      if (tokens[cursor] === "one" || tokens[cursor] === "ones") cursor += 1;
      else {
        const drink = drinkAt(tokens, cursor);
        if (drink) cursor += drink.consumed;
      }
      index = cursor;
      continue;
    }

    if (word === "the" && DESCRIPTORS.has(tokens[index + 1]) && (tokens[index + 2] === "one" || tokens[index + 2] === "ones")) {
      retarget(findByDescriptor(drinks, tokens[index + 1], group));
      index += 3;
      continue;
    }

    if ((word === "that" || word === "this") && (tokens[index + 1] === "one" || tokens[index + 1] === "ones")) {
      index += 2;
      continue;
    }

    const addition = readAdd(tokens, index);
    if (addition) {
      for (let count = 0; count < addition.count; count += 1) {
        drinks.push(createDrink(addition.type, addition.iced ? "Iced" : "Hot", nextId));
        nextId += 1;
        focus = drinks.length - 1;
      }
      group = null;
      index = addition.next;
      continue;
    }

    if (word === "it" || word === "that" || word === "this") {
      index += 1;
      continue;
    }

    const modifier = readModifier(tokens, index);
    if (modifier && focus >= 0) {
      applyModifier(drinks[focus], modifier);
      index = modifier.next;
      continue;
    }

    if ((word === "the" || word === "that") && tokens[index + 1] !== "other") {
      const drink = drinkAt(tokens, index + 1);
      if (drink) {
        const pool = indicesOf(drinks, drink.type);
        if (pool.length) {
          focus = pool[pool.length - 1];
          if (drink.iced) drinks[focus].temp = "Iced";
          group = pool;
        }
        index = index + 1 + drink.consumed;
        continue;
      }
    }

    index += 1;
  }

  return drinks;
}
