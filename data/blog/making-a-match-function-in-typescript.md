---
title: Making a Match Function in Typescript
date: '2022-06-02'
tags: ['Typescript', 'code', 'types', 'guide']
draft: false
summary: Try to bring the match expression from functional langs to TS
images: []
layout: PostLayout
---

If you have used a functional language, Rust, Python 3.10, and many more languages you may have come across a `match` statement before.
In Rust match looks like

```rust
fn num_match(num: usize) {
    match num {
        1 => println!("got one"),
        2 => println!("got two"),
        _ => println!("got something other than one or two"),
    }
}
```

`num_match(1)` would print `got one`, `num_match(2)` would print `got two`, any other number would print `got something other than one or two`.

## Alternatives to match

For simple cases like this you probably have seen a `switch` statement like

```ts twoslash
function numMatch(num: number) {
  switch (num) {
    case 1:
      console.log('got one');
      break;
    case 2:
      console.log('got two');
      break;
    default:
      console.log('got something other than one or two');
      break;
  }
}
```

This switch statement does the same thing as the match in rust, but there's some extra boilerplate like saying `case` and `break`. Also, if you wanted to define some variable in the case blocks you need to wrap each case block with `{}`, so variables don't conflict with other case blocks.

A common case for wanting to use match like expression in TS would be to handle discriminated unions.

```twoslash include main
interface CaseOne {
  type: 'c1',
  num: number
}

interface CaseTwo {
  type: 'c2',
  str: string
}

type Cases = CaseOne | CaseTwo;
```

```ts twoslash
// @include: main

function logVal(v: Cases) {
  switch (v.type) {
    case 'c1':
      console.log(v.num);
      break;
    case 'c2':
      console.log(v.str);
      break;
    default:
      // Compile error if a new case is added
      const _exhaustiveCheck: never = v;
      break;
  }
}
```

Here we log the value `num` or `str` depending on the type of `v`, Typescript knows to narrow `v` depending on what type is.

So let's make our own match function to do this a little cleaner, and learn some cool types along the way.

## Making match

Let's try to make the match look like this

```typescript
match(v, {
  c1: (val) => {
    // val will be narrowed to CaseOne
    console.log(val.num);
  },
  c2: (val) => {
    // val will be narrowed to CaseTwo
    console.log(val.str);
  },
});
```

Here we make an object whose keys are the discriminated values of `Cases`, the values are functions whose arg is properly narrowed to each case of the discriminated union.

To start we need a type helper to get each case of the discriminated union.

```ts twoslash
// @include: main
// ---cut---
type GetCase<T extends { type: string }, CaseVal extends T['type']> = T extends { type: CaseVal }
  ? T
  : never;

type CaseOneAlias = GetCase<Cases, 'c1'>; // the same as CaseOne
type CaseTwoAlias = GetCase<Cases, 'c2'>; // the same as CaseTwo
```

The `GetCase` type will iterate over the discriminated union to pull out the specific case we asked for.
We need this helper to type out the match function object.

```ts twoslash
// @include: main
type GetCase<T extends { type: string }, CaseVal extends T['type']> = T extends { type: CaseVal }
  ? T
  : never;
// ---cut---

type Arms<T extends { type: string }> = {
  [K in T['type']]: (a: GetCase<T, K>) => any;
};

type CaseArms = Arms<Cases>;
/**
{
  c1: (a: CaseOne) => any;
  c2: (a: CaseTwo) => any;
}
*/
```

Here we use a mapped type to iterate to make an object whose keys are all the different `type` values in the discriminated union. Then we use `GetCase` to narrow the function values to be the correct type for the key. We make the return type `any` since at this point we don't care what the return type is and it can be narrowed later.

Now we can make the match function

```ts twoslash
// @include: main
type GetCase<T extends { type: string }, CaseVal extends T['type']> = T extends { type: CaseVal }
  ? T
  : never;

type Arms<T extends { type: string }> = {
  [K in T['type']]: (a: GetCase<T, K>) => any;
};
// ---cut---

function match<T extends { type: string }, M extends Arms<T>>(
  val: T,
  mapper: M
): ReturnType<M[T['type']]> {
  const disc: T['type'] = val.type;
  const f = mapper[disc];
  return f(val as GetCase<T, typeof disc>);
}
```

The key thing to note here is the generic constraint of `M extends Arms<T>`, the `extends` will narrow the `any` return value to what ever the actual function's return value is, so we get full type inference.

```twoslash include full
interface CaseOne {
  type: 'c1',
  num: number
}

interface CaseTwo {
  type: 'c2',
  str: string
}

type Cases = CaseOne | CaseTwo;
type GetCase<T extends {type: string}, CaseVal extends T["type"]> = T extends {type: CaseVal} ? T : never;

type Arms<T extends { type: string }> = {
  [K in T["type"]]: (a: GetCase<T, K>) => any;
};

function match<T extends { type: string }, M extends Arms<T>>(
  val: T,
  mapper: M
): ReturnType<M[T["type"]]> {
  const disc: T["type"] = val.type;
  const f = mapper[disc];
  return f(val as GetCase<T, typeof disc>);
}
```

```ts twoslash
// @include: full
// ---cut---

const c: Cases = { type: 'c1', num: 1 } as Cases;

const r = match(c, {
  c1: (val) => {
    return val.num;
  },
  c2: (val) => {
    return val.str.length;
  },
}); // r is properly inferred to be a number
```

## Using Match

One thing to note is this currently does not enforce that each function returns the same type, for example this is allowed

```ts twoslash
// @include: full
// ---cut---

const c: Cases = { type: 'c1', num: 1 } as Cases;

const r = match(c, {
  c1: (val) => {
    return val.num;
  },
  c2: (val) => {
    return val.str;
  },
}); // r is number | string
```

One possible way to enforce the return types is to manually add a type annotation of the output of the `match` function like this

```ts twoslash
// @include: full
// @errors: 2322
// ---cut---

const c: Cases = { type: 'c1', num: 1 } as Cases;

const r: number = match(c, {
  c1: (val) => {
    return val.num;
  },
  c2: (val) => {
    return val.str;
  },
});
```

TODO: show enforcing all cases need to be supplied
