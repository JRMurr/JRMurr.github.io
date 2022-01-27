---
title: 'Intermediate Typescript: Generics and Mapped Types'
date: '2022-01-26'
tags: ['Typescript', 'code', 'types']
draft: true
summary: Useful applications of generics and mapped types
images: []
layout: PostLayout
---

{/_ TODO: links _/}
In the last post, I covered Literal and Union types. Those types are great and can get you a long way when writing your apps. When your codebase starts to grow you may find your "middleware"/helper functions still have too general of types which leads to more type casting than you would like. This is where generics and mapped types come in.

## Generics

If your first interaction with generics was with java in school they may have put a bad taste in your mouth.
[Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) can be very simple and can help a lot with not repeating yourself.
The simplest way to think of them is sort of like a function that takes types as parameters and yields back a new type.
To drive that point home lets look at a few simple examples.

```typescript
type AddString<T> = T | string;

type NumOrString = AddString<number>; // yields number | string
type StringOrString = AddString<string>; // yields just string

interface Box<T> {
  value: T;
}

const stringBox: Box<string> = { value: 'aString' };
const arrayNumBox: Box<[number]> = { value: [1, 2, 3] };
const literalBox: Box<'aLiteral'> = { value: 'aLiteral' };
```

Generics act as a template, you define a type using a type parameter (in these cases `T`, but it can be any identifier), when the generic is used it would fill in all instances of `T` with the passed in type.

The most likely instance you would run into generics is with functions. Generics in functions allows types to flow through it when the function does not really care about any specific type.

```typescript
type Nullable<T> = T | null;
function getWithDefault<T>(possibleValue: Nullable<T>, defaultVal: T): T {
  if (possibleValue) {
    // possibleValue is now T
    return possibleValue;
  }
  // returning a T when possibleValue is null
  return defaultVal;
}

const nullableNum: Nullable<number> = 10;
const num = getWithDefault(nullableNum, 2); // num is now just a number type
```

In this example, we use the same type `T` 3 times, as a `Nullable<T>`, a default value, and the functions return type. Notice we do not need to say `getWithDefault<number>(nullableNum,2)`, typescript infers that T should be set to number based on usage.

### Generics to make types "flow"

Generics can help address a number of potential issues of types not "flowing" the way you want. A great example of this is a function modifying members of a union type. Recall the `ApiEvent` type from the last post

```typescript
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
```

Now let's say you are making a function that will take and event, and add a new field `logged: boolean` to show the event was logged out. Your first attempt might look something like this.

```typescript
function addLogged(event: ApiEvent): ApiEvent & { logged: boolean } {
  return { ...event, logged: true };
}
```

This makes sense initially however, when you go to use this function you notice an issue.

```typescript
const loginEvent: LoginEvent = { type: 'login', user: 'john', wasSuccessful: true };

const updated = addLogged(loginEvent);
console.log(updated.user); // error: Property 'user' does not exist on type 'PostCreatedEvent & { logged: boolean; }'
```

Weird, it's obvious to you that all this function does is add on a field, why is typescript complaining that `user` does not exist on `PostCreatedEvent`? The issue is the function definition. Based on the types we pass in `ApiEvent` and get back `ApiEvent` with some extra stuff. To the type system we could just always return a `PostCreatedEvent` with the logged field.

Generics help us tell typescript what we put in, is what we are going get out. Let's re-write this function like so.

```typescript
function addLogged<T extends ApiEvent>(event: T): T & { logged: boolean } {
  return { ...event, logged: true };
}

const loginEvent: LoginEvent = { type: 'login', user: 'john', wasSuccessful: true };
console.log(updated.user); // no error
```

Notice we did not change any logic of the function, just the type definition. We can still only pass in `ApiEvent`s but when we pass in a specific `LoginEvent` the type system knows we are only going to get back a `LoginEvent`. The `extends` keyword for generics is very powerful to restrict the possible allowed values for a function while still reasoning about specific types.
This does not lose generality if you had a list of `ApiEvents` you could still map over them with this function.

### Generics in type definitions

Sometimes you may have a few wrapper types like hold the same types. This example is a little contrived, but I've run into this a few times before.

```typescript
type ValidValue = string | number;

interface WrapperOne {
  type: 'wrapperOne';
  value: ValidValue;
  info: string[];
}

interface WrapperTwo {
  type: 'wrapperTwo';
  value: ValidValue;
  info: number;
}

type Wrapper = WrapperOne | WrapperTwo;
```

In this example lets say the wrappers should both hold the same value type (both string or both number). But with this definition you could do

```typescript
const wrappedValues: Wrapper[] = [{
    type: 'wrapperOne',
    value: 'aVal',
    info: ['extra info', 'more info']
}, {
    type: 'wrapperTwo'
    value: 1,
    info: 'wait why is the value a number'
}]
```

Since the `value` field can be `string | number` there is nothing stopping a user of this type to mix and match the wrapped value types in the objects of the array.

Generics can be used to "lock" the value type in for all elements of the array.

```typescript
type ValidValue = string | number;

interface WrapperOne<T extends ValidValue> {
  type: 'wrapperOne';
  value: T;
  info: string[];
}

interface WrapperTwo<T extends ValidValue> {
  type: 'wrapperTwo';
  value: T;
  info: number;
}

type Wrappers<T extends ValidValue> = WrapperOne<T> | WrapperTwo<T>;
```

Now when we say we have a `Wrappers<string>` both wrapper's `value` type will be string.

## Mapped Types

[Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html) are a specific kind of generic types to help you build out new types.
You may have seen is the `Record<K,V>` type, this lets you define an object whose keys are in the type `k` and values are in the type `V`. You can define your own record type like so.

```typescript
type MyRecord<KeyType extends string, ValueType> = {
  [key in KeyType]: ValueType;
};
const myRecord: MyRecord<'foo' | 'bar', number | string> = { foo: 10, bar: 'string' };
```

All mapped types do is iterate over possible values to define new keys (notice the `key in KeyType`).
Another common mapped type is `Pick<T, Keys>`, this will yield a new type by picking the set of properties (`Keys`) from `T`. You can define it like so.

```typescript
type myPick<Type, Keys extends keyof Type> = {
  [key in Keys]: Type[key];
};

// same record from the above example
type OnlyFoo = myPick<typeof myRecord, 'foo'>; // resulting type is {foo: number | string}
```

Typescript has a number of built-in [Utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys), look over them all, they are extremely handy to avoid repeating yourself.
