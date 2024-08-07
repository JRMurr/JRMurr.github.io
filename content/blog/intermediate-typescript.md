---
title: 'Intermediate Typescript: Literals and Unions'
slug: intermediate-typescript
date: '2022-01-25'
tags: ['Typescript', 'code', 'types', 'guide']
draft: false
summary: Typescript patterns I have found to make your life easier in a big codebase
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />

At my job we have spent a lot of time converting a node backend and angular frontend to Typescript.
Before Typescript when working in our codebase I found myself having to read a lot of code, API schemas, and tests just to see what fields actually existed.
So during the transition I tried my hardest to make the types I made as descriptive as they could be.
Converting to Typescript and making big interfaces/types with many optional fields does not buy you much other than typo prevention and basic autocomplete.

This post assumes you have a basic understanding of Javascript/Typescript.

# Literal types

You are most likely familiar with the basic types like

```ts twoslash
let num: number = 1; // can be any number
let str: string = 'hi'; // can be any string
let bool: boolean = true; // can be true or false
let arr: number[] = [10]; // can be an array of any length with numbers
let obj: { key: string } = { key: 'value' }; // the key field can be any string
```

These types are fine for many cases and I still default most types to be these until I understand the code more.

[Literal Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types) on the other hand are a much stronger restriction on what the allowed values are

```ts twoslash
const numLiteral = 1 as const; // this can only be the number 1, no other number
const strLiteral = 'literal' as const; // can only be the string 'literal'
const boolLiteral = true as const; // can only be true
const arrLiteral = [10] as const; // can only be an array with a single element of 10
const objLiteral = { key: 'value' } as const; // can only be this specific object mapping
```

These types on their own are not that useful but when combined with unions and conditional types they can make your types very powerful.

# Unions

[Union Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types) allow you to say a type is either
`foo` or `bar` or `number` or `string`...

```ts twoslash
function printId(id: number | string) {
  console.log('Your ID is: ' + id);
}
```

This function will allow you to pass in a string or number, this is fine since both can be added to a string for display.

When combined with literals you can make types very strongly defined.

```ts twoslash
// @errors: 2345 1128
type MethodType = 'GET' | 'PUT' | 'POST' | 'DELETE';

function makeHttpCall(url: string, method: MethodType) {
  console.log(`Im hitting ${url} with ${method}`);
}
const url = 'johns.codes';
makeHttpCall(url, 'GET'); // allowed
makeHttpCall(url, 'GeT'); // not allowed
makeHttpCall(url, 'POG'); // not allowed
```

This helps greatly for new users of this function to see what the valid method fields are without having to look at external documentation,
your editor will provide autocomplete on the method field, and you get a compile error if you try to use an arbitrary string as the method parameter.

## Restricting Unions

Literals allow for strongly typed APIs, but how do you properly narrow a general type to a more specific type? Typescript allows this in a few ways

```ts twoslash
type MethodType = 'GET' | 'PUT' | 'POST' | 'DELETE';
function makeHttpCall(url: string, method: MethodType) {
  console.log(`Im hitting ${url} with ${method}`);
}
// ---cut---
function handleAny(url: string, method: unknown) {
  if (typeof method === 'string') {
    // in this block method is now a string type
    if (method == 'GET') {
      // method is now the literal "GET"
      makeHttpCall(url, method);
    }
    if (method == 'PUT') {
      // method is now the literal "PUT"
      makeHttpCall(url, method);
    }
  }
}
```

This manual checking is fine but if you have a more complex type or a union with many possible values this gets unwieldy quite fast.
The next best approach is a [type predicate](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)

```ts twoslash
function makeHttpCall(url: string, method: MethodType) {
  console.log(`Im hitting ${url} with ${method}`);
}
// ---cut---
// First define valid methods as a const array
const ValidMethods = ['GET', 'PUT', 'POST', 'DELETE'] as const;
type MethodType = typeof ValidMethods[number]; // resulting type is the same as before

function isValidMethod(method: unknown): method is MethodType {
  // need the `as any` since valid methods is more strongly typed
  return typeof method === 'string' && ValidMethods.includes(method as any);
}

function handleAny(url: string, method: unknown) {
  if (isValidMethod(method)) {
    // method is now a MethodType
    makeHttpCall(url, method);
  }
}
```

The type predicate `isValidMethod` is just a function that returns a boolean,
when true Typescript knows the input parameter `method` is a `MethodType` and can be used as such.
Type predicates are a good simple way to encode any runtime checks into the type system.

## Discriminated unions

Now unions of basic literals are quite powerful, but unions can be even more powerful when you make unions of objects.
Say in your app you track different events. The events could look like the following

```ts twoslash
interface LoginEvent {
  // the user's email
  user: string;
  wasSuccessful: boolean;
}

interface PostCreatedEvent {
  name: string;
  body: string;
  createdAt: Date;
}
// and many others
```

Once you have typed out all the different events, and you want to group them together to a single event type
you might think a simple union like `type ApiEvent = LoginEvent | PostCreatedEvent | ...` would be good but
when you want to narrow this type down you would have to end up with a lot of `if ('user' in event) {..}` checks or many custom type predicate functions.

To avoid that issue you can define the event types as a [Discriminated union](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions).
All this is, is a union type where all types in the union have a field whose value is unique in all the union's types. We can redefine the above types as follows

```ts twoslash
interface LoginEvent {
  type: 'login';
  user: string;
  wasSuccessful: boolean;
}

interface PostCreatedEvent {
  type: 'postCreated';
  name: string;
  body: string;
  createdAt: Date;
}

type ApiEvent = LoginEvent | PostCreatedEvent;
type EventTypes = ApiEvent['type']; // this resolves to 'login' | 'postCreated'
```

In this example you could name the key `type` whatever you want, as long as every type has that field the union type will allow you to access the key.
Now to narrow this type down you could do the following

```ts twoslash
interface LoginEvent {
  type: 'login';
  user: string;
  wasSuccessful: boolean;
}

interface PostCreatedEvent {
  type: 'postCreated';
  name: string;
  body: string;
  createdAt: Date;
}

type ApiEvent = LoginEvent | PostCreatedEvent;
// ---cut---

function logEvent(event: ApiEvent) {
  if (event.type === 'login') {
    console.log(`user: ${event.user}, wasSuccessful: ${event.wasSuccessful}`);
  } else if (event.type === 'postCreated') {
    console.log(`post ${event.name} was created at ${event.createdAt}`);
  }
}
```

This style of checking the discriminating field in if statement is fine but is a little verbose to me.
I find that a switch statement makes it more readable and less verbose.

```ts twoslash
interface LoginEvent {
  type: 'login';
  user: string;
  wasSuccessful: boolean;
}

interface PostCreatedEvent {
  type: 'postCreated';
  name: string;
  body: string;
  createdAt: Date;
}

type ApiEvent = LoginEvent | PostCreatedEvent;
// ---cut---

function logEvent(event: ApiEvent) {
  switch (event.type) {
    case 'login':
      console.log(`user: ${event.user}, wasSuccessful: ${event.wasSuccessful}`);
      break;
    case 'postCreated':
      console.log(`post ${event.name} was created at ${event.createdAt}`);
      break;
    default:
      throw new Error(`invalid event type: ${(event as { type: string }).type}`);
  }
}
```

There is one issue with this approach, in the future when we add a new event type it would fall through to default case, and we wouldn't know about it until runtime.
However, using Typescript's `never` type we can force a compile error when we don't handle all cases

```ts twoslash
interface LoginEvent {
  type: 'login';
  user: string;
  wasSuccessful: boolean;
}

interface PostCreatedEvent {
  type: 'postCreated';
  name: string;
  body: string;
  createdAt: Date;
}

type ApiEvent = LoginEvent | PostCreatedEvent;
// ---cut---

function assertUnreachable(type: never): never {
  throw new Error(`Invalid event type: ${type}`);
}

function logEvent(event: ApiEvent) {
  const type = event.type;
  switch (type) {
    case 'login':
      console.log(`user: ${event.user}, wasSuccessful: ${event.wasSuccessful}`);
      break;
    case 'postCreated':
      console.log(`post ${event.name} was created at ${event.createdAt}`);
      break;
    default:
      // event.type is `never` here since this default case would never be hit since all possible cases are handled
      assertUnreachable(type);
  }
}
```

Now in the future if we added an event with a type field of `NewEvent` it would fall through to the default case,
since its type is not `never` (it would be `NewEvent`) we would get a compile error on the call to `assertUnreachable`.

# Wrap up

While these features I covered can help you a lot (these are almost all I used during the initial typescript migration),
there are many other really cool typescript features, like generics, mapped types and conditional types.
I hope to cover them all in a Part 2 so check back soon!
