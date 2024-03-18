---
title: Type Safe GroupBy In TypeScript
slug: type-safe-groupby-in-typescript
date: '2022-05-25'
tags: ['typescript', 'types', 'code', 'guide']
draft: false
summary: Create a better groupBy function that only allows valid keys to be grouped on
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />

## Lodash's groupBy

I would bet if you have a sizeable Javascript/Typescript codebase you most likely are using [lodash](https://lodash.com/) somewhere in there.
While Javascript has gotten more "batteries included" over the last few years, lodash still has many nice functions for manipulating arrays/objects.
One such function is [groupBy](https://lodash.com/docs/4.17.15#groupBy). It groups a list by some predicate, in the simplest case it can just be a key in the objects of the array.

```twoslash export=main
import _ from 'lodash';

interface Foo {
  num: number;
  someLiteral: 'a' | 'b' | 'c';
  object: Record<string, any>;
}

const vals: Foo[] = [
  { num: 1, someLiteral: 'a', object: { key: 'value' } },
  { num: 2, someLiteral: 'a', object: { key: 'diffValue' } },
  { num: 1, someLiteral: 'b', object: {} },
];
```

```ts twoslash
// @include: main

console.dir(_.groupBy(vals, 'num'));
/*
{
  '1': [ { num: 1, someLiteral: 'a' }, { num: 1, someLiteral: 'b' } ],
  '2': [ { num: 2, someLiteral: 'a' } ]
}
*/
console.dir(_.groupBy(vals, 'someLiteral'));
/*
{
  a:[
      { num: 1, someLiteral: 'a', object: [Object] },
      { num: 2, someLiteral: 'a', object: [Object] }
  ],
  b: [ { num: 1, someLiteral: 'b', object: {} } ]
}
*/
```

This all seems to make sense, you can set what key you want to group on, and you get back an object whose keys are the values for found in the input array of objects.

Now if you're in a TypeScript code base I hope you are using the [definitely typed lodash types](https://www.npmjs.com/package/@types/lodash) to add some types to the lodash functions.
In this case the `_.groupBy` type looks roughly like (simplified from the actual code)

```ts twoslash
declare function groupBy<T>(collection: Array<T>, key: string): Dictionary<T[]>;

interface Dictionary<T> {
  [index: string]: T;
}
```

So a few things stick out here. First, the `key` type is just string, so there's nothing stopping me from doing `_.groupBy(vals, "someKeyThatDoesNotExist")`.
Second, we have no restrictions at the type level of me grouping on a key whose value is not a valid object key (the value must be a subset of `string | number | symbol`). For example in `Foo` the `object` key's value was a record. Here's what happens when you try to group on that key.

```ts twoslash
// @include: main
// ---cut---

console.dir(_.groupBy(vals, 'object'));
/*
{
  '[object Object]': [
    { num: 1, someLiteral: 'a', object: [Object] },
    { num: 2, someLiteral: 'a', object: [Object] },
    { num: 1, someLiteral: 'b', object: {} }
  ]
}
*/
```

In this case the objects where coerced to string values so all elements of `vals` where grouped under the same weird `[object Object]` key. While this does not throw an error there is almost 0 chance you want this to happen in your code.

Finally, the return type of this function is `Dictionary`, while its "right" it could be "more right" by encoding that the returning object's keys would be the values of the grouping key in the input object.

## Making our own groupBy

_insert Bender joke here_

To start making our own type safe `groupBy`, we first need some code that actually does the grouping logic. Let's start with that and some basic types.

```ts twoslash
// @include: main
// ---cut---
// Note: PropertyKey is a builtIn type alias of
// type PropertyKey = string | number | symbol
// This lets us use "Record<PropertyKey, any>" to represent any object
// but is slightly nicer to use than the "object" type
function simpleGroupBy<T extends Record<PropertyKey, any>>(arr: T[], key: keyof T): any {
  return arr.reduce((accumulator, val) => {
    const groupedKey = val[key];
    if (!accumulator[groupedKey]) {
      accumulator[groupedKey] = [];
    }
    accumulator[groupedKey].push(val);
    return accumulator;
  }, {} as any);
}

console.dir(simpleGroupBy(vals, 'num'));
/*
{
  '1': [
    { num: 1, someLiteral: 'a', object: [Object] },
    { num: 1, someLiteral: 'b', object: {} }
  ],
  '2': [ { num: 2, someLiteral: 'a', object: [Object] } ]
}
*/
```

Cool the logic here seems to work, but obviously the types could use some love.

Let's start by adding a few more generics, so we can type the output correctly.
Your first change might be to make the return type `Record<string, T[]>` since the keys will be coerced to strings by JavaScript and the values will be the same values in the array.
This will unfortunately make typescript sad.

```ts twoslash
// @include: main
// ---cut---
// @errors: 2536
function sadAttempt<T extends object>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((accumulator, val) => {
    const groupedKey = val[key];
    if (!accumulator[groupedKey]) {
      accumulator[groupedKey] = [];
    }
    accumulator[groupedKey].push(val);
    return accumulator;
  }, {} as Record<string, T[]>);
}
```

The lines with `accumulator[groupedKey]` will error with `Type 'T[keyof T]' cannot be used to index type 'Record<string, T>'`. Here the `keyof T` could be any key in `T` so since not every key's value in `T` is a string typescript will not let you treat `groupedKey` as a string.

We can almost fix this by adding some more information on the input key by binding it to a new generic parameter, though there will still be some issues.

```ts twoslash
function betterSadAttempt<T extends Record<PropertyKey, any>, Key extends keyof T>(
  arr: T[],
  key: Key
): Record<T[Key], T[]> {
  return arr.reduce((accumulator, val) => {
    const groupedKey = val[key];
    if (!accumulator[groupedKey]) {
      accumulator[groupedKey] = [];
    }
    accumulator[groupedKey].push(val);
    return accumulator;
  }, {} as Record<T[Key], T[]>);
}
```

Here we added a new generic `Key extends keyof T` so when we supply a specific key to the function, the Key generic will be narrowed to that value. For example if we did `betterSadAttempt(vals, 'someLiteral')`, `Key` would exactly be `'someLiteral'` instead of `keyof Foo = 'someLiteral' | 'num' | 'object'`

However, typescript is still sad on the `Record<T[Key], T[]>` lines with `Type 'T[Key]' does not satisfy the constraint 'string | number | symbol'`.
This error is similar to the error before, basically `T[Key]` can not be a key for the `Record` since it could be some weird value.

To accomplish this we need to make a helper type that filters down the allowed keys to only keys whose values are `string | number | symbol`.
We can use a [mapped type](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html) to do just that

```ts twoslash
type MapValuesToKeysIfAllowed<T> = {
  [K in keyof T]: T[K] extends PropertyKey ? K : never;
};
type Filter<T> = MapValuesToKeysIfAllowed<T>[keyof T];
```

This type helper does a few things. First it maps over all the values in `T` (`[K in keyof T]`) and makes the value the key if it is a subset of `string | number | symbol` (`T[K] extends PropertyKey ? K`), if it's not a subset its value will be the `never` type. Finally, we use an [index access type](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html) to get all values of the transformed object as a union. This step will drop all the `never` values automatically for us since adding `never` to a union is like saying `or false` its basically is a no op.

That was a mouthful so let's see an example

```ts twoslash
type MapValuesToKeysIfAllowed<T> = {
  [K in keyof T]: T[K] extends PropertyKey ? K : never;
};
type Filter<T> = MapValuesToKeysIfAllowed<T>[keyof T];
// ---cut---
// from above
interface Foo {
  num: number;
  someLiteral: 'a' | 'b' | 'c';
  object: Record<string, any>;
}

type MappedFoo = MapValuesToKeysIfAllowed<Foo>;
/*
{
  num: "num";
  someLiteral: "someLiteral";
  object: never;
}
*/
// we replace the values of this object with just the key as a string literal or never

type FooKeys = Filter<Foo>;
// => "num" | "someLiteral"
// notice the never does not show up in the union

interface AllObjects {
  object: Record<string, any>;
  diffObject: Record<number, any>;
}

type MappedAllObjects = MapValuesToKeysIfAllowed<AllObjects>;
/*
{ 
  object: never;
  diffObject: never;
}
*/

type AllObjectsKeys = Filter<AllObjects>;
// => never
// the output is only never. Think of this like saying "false or false", the output will just be false
```

With this filter type helper function we can now properly limit the `Key` generic by replacing `Key extends keyof T` with `Key extends Filter<T>`.

## Putting it all together

```ts twoslash
// @include: main
// ---cut---

type MapValuesToKeysIfAllowed<T> = {
  [K in keyof T]: T[K] extends PropertyKey ? K : never;
};
type Filter<T> = MapValuesToKeysIfAllowed<T>[keyof T];

function groupBy<T extends Record<PropertyKey, any>, Key extends Filter<T>>(
  arr: T[],
  key: Key
): Record<T[Key], T[]> {
  return arr.reduce((accumulator, val) => {
    const groupedKey = val[key];
    if (!accumulator[groupedKey]) {
      accumulator[groupedKey] = [];
    }
    accumulator[groupedKey].push(val);
    return accumulator;
  }, {} as Record<T[Key], T[]>);
}

const nums = groupBy(vals, 'num');
// nums = Record<number, Foo[]>

const literals = groupBy(vals, 'someLiteral');
// literals = Record<"a" | "b" | "c", Foo[]>

// @errors: 2345
const sad = groupBy(vals, 'object');
```

Now this works great, we can only pass in keys that have valid values, and we even get autocomplete on it! However, one thing that bothers me is the error message in the last case.
While it's correct, saying `not assignable to parameter of type 'Filter<Foo>'` is not very useful to a user. This pops up sometimes with typescript where it won't show the underlying type and instead just show the higher level type helper instead.

To make the error message show the valid keys we can use a modified version of [this "hack"](https://stackoverflow.com/a/57683652). Here instead of creating the `Expand` type in the post, we can make our own `ValuesOf` to replace the `[keyof T]` at the end of `Filter`

```ts twoslash
// @include: main
type MapValuesToKeysIfAllowed<T> = {
  [K in keyof T]: T[K] extends PropertyKey ? K : never;
};

function groupBy<T extends Record<PropertyKey, any>, Key extends Filter<T>>(
  arr: T[],
  key: Key
): Record<T[Key], T[]> {
  return arr.reduce((accumulator, val) => {
    const groupedKey = val[key];
    if (!accumulator[groupedKey]) {
      accumulator[groupedKey] = [];
    }
    accumulator[groupedKey].push(val);
    return accumulator;
  }, {} as Record<T[Key], T[]>);
}
// ---cut---
type ValuesOf<A> = A extends infer O ? A[keyof A] : never;

type Filter<T> = ValuesOf<MapValuesToKeysIfAllowed<T>>;
// was Filter<T> = MapValuesToKeysIfAllowed<T>[keyof T]

// @errors: 2345
const sad = groupBy(vals, 'object');
```

Now we have type safety and good error messages!

## Possible improvements

One thing this `groupBy` function lacks that the lodash `groupBy` gives is we do not allow you to pass a function instead of a key to group on.
The example in the lodash docs is

```ts twoslash
// @include: main
// ---cut---
_.groupBy([6.1, 4.2, 6.3], Math.floor);
// { '4': [4.2], '6': [6.1, 6.3] }
```

While this is not perfect this mostly works

```ts twoslash
function groupByFunc<
  RetType extends PropertyKey,
  T // no longer need any requirements on T since the grouper can do w/e it wants
>(arr: T[], mapper: (arg: T) => RetType): Record<RetType, T[]> {
  return arr.reduce((accumulator, val) => {
    const groupedKey = mapper(val);
    if (!accumulator[groupedKey]) {
      accumulator[groupedKey] = [];
    }
    accumulator[groupedKey].push(val);
    return accumulator;
  }, {} as Record<RetType, T[]>);
}

const test = groupByFunc([6.1, 4.2, 6.3], Math.floor);
// test = Record<PropertyKey, Foo[]>
```

This works by only letting you pass in functions that return `PropertyKey`, and typescript even narrows the types. In this case `test` is `Record<number, Foo[]>` since TS infers the return type of the grouping function.

If you know how to improve this function further feel free to leave an issue/pr on my [blog's GitHub](https://github.com/JRMurr/JRMurr.github.io)!
