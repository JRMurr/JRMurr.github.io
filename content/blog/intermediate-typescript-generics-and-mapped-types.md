---
title: 'Intermediate Typescript: Generics and Mapped Types'
slug: intermediate-typescript-generics-and-mapped-types
date: '2022-01-31'
tags: ['Typescript', 'code', 'types', 'guide']
draft: false
summary: Useful applications of generics and mapped types
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />

In the [last post](/blog/intermediate-typescript), I covered Literal and Union types. Those types are great and can get you a long way when writing your apps. When your codebase starts to grow you may find your middleware/helper functions still have too general of types which leads to more type casting than you would like. This is where generics and mapped types come in.

## Generics

If your first interaction with generics was with java in school they may have put a bad taste in your mouth.
[Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) can be very simple and can help a lot with not repeating yourself.
The simplest way to think of them is sort of like a function that takes types as parameters and yields back a new type.
To drive that point home lets look at a few simple examples.

```ts twoslash
type AddString<T> = T | string;

type NumOrString = AddString<number>; // yields number | string
type StringOrString = AddString<string>; // yields just string

interface Box<T> {
  value: T;
}

const stringBox: Box<string> = { value: 'aString' };
const arrayNumBox: Box<number[]> = { value: [1, 2, 3] };
const literalBox: Box<'aLiteral'> = { value: 'aLiteral' };
```

Generics act as a template, you define a type using a type parameter (in these cases `T`, but it can be any identifier), when the generic is used it would fill in all instances of `T` with the passed in type.

The most likely instance you would run into generics is with functions. Generics in functions allows types to flow through it when the function does not really care about any specific type.

```ts twoslash
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

```twoslash export=main
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

```ts twoslash
// @include: main
```

Now let's say you are making a function that will take an event, and add a new field `logged: boolean` to show the event was logged out. Your first attempt might look something like this.

```ts twoslash
// @include: main
// ---cut---
function addLogged(event: ApiEvent): ApiEvent & { logged: boolean } {
  return { ...event, logged: true };
}
```

This makes sense initially however, when you go to use this function you notice an issue.

```ts twoslash
// @errors: 2339
// @include: main
function addLogged(event: ApiEvent): ApiEvent & { logged: boolean } {
  return { ...event, logged: true };
}
// ---cut---
const loginEvent: LoginEvent = { type: 'login', user: 'john', wasSuccessful: true };

const updated = addLogged(loginEvent);
console.log(updated.user);
```

Weird, it's obvious to you that all this function does is add on a field, why is typescript complaining that `user` does not exist on `PostCreatedEvent`? The issue is the function definition. Based on the types we pass in `ApiEvent` and get back `ApiEvent` with some extra stuff. To the type system we could just always return a `PostCreatedEvent` with the logged field.

Generics help us tell typescript what we put in, is what we are going get out. Let's re-write this function like so.

```ts twoslash
// @include: main
// ---cut---
function addLogged<T extends ApiEvent>(event: T): T & { logged: boolean } {
  return { ...event, logged: true };
}

const loginEvent: LoginEvent = { type: 'login', user: 'john', wasSuccessful: true };
const updated = addLogged(loginEvent);
console.log(updated.user); // no error
```

Notice we did not change any logic of the function, just the type definition. We can still only pass in `ApiEvent`s but when we pass in a specific `LoginEvent` the type system knows we are only going to get back a `LoginEvent`. The `extends` keyword for generics is very powerful to restrict the possible allowed values for a function while still reasoning about specific types.
This does not lose generality if you had a list of `ApiEvents` you could still map over them with this function.

### Generics in type definitions

Sometimes you may have a few wrapper types that hold the same types. This example is a little contrived, but I've run into this a few times before.

```twoslash export=wrapOne
type ValidValue = string | number;

interface WrapperOne {
  type: 'wrapperOne';
  value: ValidValue;
  info: string[];
}

interface WrapperTwo {
  type: 'wrapperTwo';
  value: ValidValue;
  extra: number;
}

type Wrapper = WrapperOne | WrapperTwo;
```

```ts twoslash
// @include: wrapOne
```

In this example lets say the wrappers should both hold the same value type (both string or both number). But with this definition you could do

```ts twoslash
// @include: wrapOne

// ---cut---
const wrappedValues: Wrapper[] = [
  {
    type: 'wrapperOne',
    value: 'aVal', // this wrapper is using a string
    info: ['extra info', 'more info'],
  },
  {
    type: 'wrapperTwo',
    value: 1, // this wrapper is using a number
    extra: 10,
  },
];
```

Since the `value` field can be `string | number` there is nothing stopping a user of this type to mix and match the wrapped value types in the objects of the array.

Generics can be used to "lock" the value type in for all elements of the array.

```twoslash export=wrapTwo
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

type Wrapper<T extends ValidValue> = WrapperOne<T> | WrapperTwo<T>;
```

```ts twoslash
// @include: wrapTwo
```

Now when we say we have a `Wrappers<string>` both wrapper's `value` type will be string.

```ts twoslash
// @include: wrapTwo

// ---cut---
const wrappedValues: Wrapper<string>[] = [
  {
    type: 'wrapperOne',
    value: 'aVal', // this wrapper is using a string
    info: ['extra info', 'more info'],
  },
  {
    type: 'wrapperTwo',
    value: 'I can only use string', // using a number here would now throw an error
    info: 10,
  },
];
```

## Mapped Types

[Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html) are a specific kind of generic types to help you build out new types.
You may have seen is the `Record<K,V>` type, this lets you define an object whose keys are in the type `K` and values are in the type `V`. You can define your own record type like so.

```ts twoslash
type MyRecord<KeyType extends string, ValueType> = {
  [key in KeyType]: ValueType;
};
const myRecord: MyRecord<'foo' | 'bar', number | string> = { foo: 10, bar: 'string' };
```

All mapped types do is iterate over possible values to define new keys (notice the `key in KeyType`).
Another common mapped type is `Pick<T, Keys>`, this will yield a new type by picking the set of properties (`Keys`) from `T`. You can define it like so.

```ts twoslash
type MyRecord<KeyType extends string, ValueType> = {
  [key in KeyType]: ValueType;
};
const myRecord: MyRecord<'foo' | 'bar', number | string> = { foo: 10, bar: 'string' };

// ---cut---
type myPick<Type, Keys extends keyof Type> = {
  [key in Keys]: Type[key];
};

// same record from the above example
type OnlyFoo = myPick<typeof myRecord, 'foo'>; // resulting type is {foo: number | string}
```

Typescript has a number of built-in [Utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys), look over them all, they are extremely handy to avoid repeating yourself.

### Incrementally Type an object

Mapped types are excellent for incrementally adding types when converting from javascript to typescript. Let's say you are adding types for database tables. When you first converted you may have made a type like `type Tables = Record<string, any>`. This doesn't but you much other than saying `Tables` is an object.

When you decide it's time to add types for tables you start by typing a simple database table like so

```ts twoslash
interface UserTable {
  id: number;
  username: string;
  email: string;
}
```

Now you run into an issue, how can you add just this type to the `Tables` type we had before without specifying all your tables? Mapped types can set a default type for anything you have not explicitly set.

```ts twoslash
interface UserTable {
  id: number;
  username: string;
  email: string;
}
// ---cut---
type Tables = {
  users: UserTable;
  [key: string]: any;
};

type Users = Tables['users']; // This is the UserTable type above
type Other = Tables['somethingElse']; // This is any
```

Now you can add types for just tables you have manually typed while allowing old code to still reference any untyped table.

### Using Mapped Types instead of Enums

Typescript added [Enums](https://www.typescriptlang.org/docs/handbook/enums.html) to Javascript, personally I would avoid them. There is some debate on how useful enums are, I will avoid that discussion here and show how what I do instead.

I like to use an `as const` object to hold my enum like types.

```ts twoslash
const UserStates = {
  guest: 'guest',
  loggedIn: 'loggedIn',
  paid: 'paid',
} as const;

type UserStatesMap = typeof UserStates;
type UserStates = UserStatesMap[keyof UserStatesMap]; // UserStates is now 'guest' | 'loggedIn' | 'paid'

function handleState(state: UserStates) {}

handleState(UserStates.guest);
```

Now this looks like more code than just using a typescript enum, but this buys us a few things. Since the type is just an object map we can use mapped types to modify/filter our types as we need. Let's say we wanted to filter our `UserStates` type to not include `guest` accounts. We could do the following

```ts twoslash
const UserStates = {
  guest: 'guest',
  loggedIn: 'loggedIn',
  paid: 'paid',
} as const;

type UserStatesMap = typeof UserStates;
type UserStates = UserStatesMap[keyof UserStatesMap];
// ---cut---
type NonGuest = {
  [key in keyof UserStatesMap]: key extends 'guest' ? never : UserStatesMap[key];
}[keyof UserStatesMap]; // This type resolves to `'loggedIn' | 'paid'`
```

In this example we actually used something called a [Conditional Type](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html) to filter our the `guest` type. These types basically provide the ternary operator to the typescript type system. In this example if the key extends `'guest'` its value in the resulting object would be `never`. Then when we get all the values of the map the `never` type is dropped from the union.

Conditional and Mapped types show up together a lot. They can be very powerful to modify existing types. They allow you to avoid redefining types for small changes.

I plan on covering Conditional Types in more detail in my next post!

## Wrap up

Generics and Mapped Types are extremely powerful tools to help types follow through your program and to avoid repeating yourself. They can be a little confusing to newcomers so be sure to comment them well.
