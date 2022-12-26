---
title: Type classes are cool
date: 2022-12-15T04:06:58.631Z
tags: ['functional', 'type classes', 'traits', 'rust', 'haskell', 'typescript']
draft: false
summary: Why I think type classes are my favorite functional idea
images: []
layout: PostLayout
---

<TOCInline toc={props.toc} asDisclosure />

<Note>
For the purposes of this blog I will use trait/typeclass interchanibly. They are techincally different for the points ill raise it does not really matter
</Note>

Functional programming ideas have alaways had an appeal to me since I was exposed to them in school. While its hard to give a strong list of what makes a lang functional, these are the points that matter most to me

- Pattern matching + Algerbraic data types is my go to mental model to use when exploring a problem for the first time.
- Immutability (to a lesser extent the borrow checker in rust) helps me reduce cognitive load and focus on what is acutally happening.
- Higher order functions just feels good to me, there is some kind of joy in a haskell/ocaml/_insert favorite functional lang here_ of composing many funcs together to make very elegante looking 1 liners (there can be some downsides to that for future you but no one likes them)
- Strong type systems save you from yourself (or others....)

All of these things can appear in any language. Pattern matching has been added to python. Immutability is possible in any lang with enough will power. Most major languages I can think of have some kind of lambda/anoymous function to make using higher order functions easier. Compile time type sytems can be added onto basically every lang (see Typescript, the many python type checkers, crystal for ruby, etc)

Though one functional idea that I have not seen spread to many mainstream languages is [Type Classes](https://en.wikipedia.org/wiki/Type_class).

## What is a Type Class?

If you are more expereinced with OOP ideas, at first glance a type class seems to look the same as an Interface. They achieve similar goals of [Ad hoc polymorphism](https://en.wikipedia.org/wiki/Ad_hoc_polymorphism).
Thats a nerd word so lets look at an example of re-creating the `Show` type class (basically a `toString` typeclass) from haskell in haskell, rust, and typescript.

```haskell:haskell
-- the definition of the type class
class Show a where
  show :: a -> String

-- implement for a type
data MyIntHolder = MyInt Int

instance Show MyIntHolder where
    show (MyInt val) = "My int has val: " ++ show val

-- a function needing the type to "be" show
callShow :: Show a => a -> (String, Int)
-- return the show of the val and the lengths of the string show would produce
callShow x = let shownX = show x in (shownX, length shownX)

main = print (callShow (MyInt 10)) -- prints ("My int has val: 10",18)
```

```rust:rust
// define the trait
pub trait Show {
    fn show(&self) -> String;
}

// implement for a type
struct MyInt(isize);


impl Show for MyInt {
    fn show(&self) -> String {
        format!("My int has val: {}", self.0)
    }
}

// a function needing the type to "be" show
// Note: the signature "fn call_show(x: &impl Show) -> (String, usize)" is also valid
pub fn call_show<T: Show>(x: &T) -> (String, usize) {
    let shown_x = x.show();
    let length = shown_x.len();
    (shown_x, length)
}

fn main() {
    let my_int = MyInt(10);
    // need :? to debug print a tuple
    println!("{:?}", call_show(&my_int)) // prints ("My int has val: 10", 18)
}
```

```ts:typescript twoslash
// define the interface
interface Show {
  show: () => string;
}
// implement it for a type (class)
class MyIntHolder implements Show {
  constructor(private myInt: number) {}

  show(): string {
    return `My int has val: ${this.myInt}`;
  }
}

// a function needing the type to "be" show
function callShow<T extends Show>(x: T): [string, number] {
  const shownX = x.show();
  return [shownX, shownX.length];
}

const myInt = new MyIntHolder(10);
console.log(callShow(myInt)); // prints ["My int has val: 10", 18]
```

<Note className="text-sm">While i always knew rust was a good mix of functional and imperative ideas, it is kinda neat that it does seem to "feel" halfway between the haskell and typescript examples</Note>

All of these examples accomplish the same idea. You define some behavior that multiple types could have. Then you can say a type has that behavior, then require that behavior for a function call.

## What typeclasses can do that interfaces can not

The main difference for the typescript version compared to the others is that in typescript (and many java descendets) is that you can only implement interfaces when you define a type. While this does not seem like a big deal it has a few implications

- In rust/haskell you can implement the trait in different files from where the type is defined to improve readbility
- In typescript implementing a generic interface like [the from trait](https://doc.rust-lang.org/std/convert/trait.From.html) would be extermely hard/not ergnomic

The first point is minor but it does help. You can have a "god" struct defined in the root of a crate then implement specfic traits in other files to make the code easier to explore.

The second point, however, is one of the main reasons I love rust. The [the from trait](https://doc.rust-lang.org/std/convert/trait.From.html) is a godsend when dealing with "boundries" of your code and handling errors nicely.

## The from trait

The rust docs page for from shows the error handling example, lets work through an example of converting from a db row to an "id" holder. Its a little contrived but I think it will show the usefulness.

```rust

// Some types for db rows
pub struct PostRow {
    id: usize,
    title: String,
    // others...
}

pub struct UserRow {
    id: usize,
    name: String,
    // others....
}

// For real this would probably be some enum for all tables but ehh....
#[derive(Debug)] // auto add an impl of the debug trait
pub struct AnId {
    num: usize,
    tag: String,
}

impl From<PostRow> for AnId {
    fn from(value: PostRow) -> Self {
        Self {num: value.id, tag: "PostRow".to_string()}
    }
}

impl From<UserRow> for AnId {
    fn from(value: UserRow) -> Self {
        Self {num: value.id, tag: "UserRow".to_string()}
    }
}

fn main() {
    let post_row = PostRow{id: 2, title: "pog stuff".to_string()};
    // implementing the from trait will add the correct "Into" func on the "Frommed" type
    let post_id: AnId = post_row.into();
    println!("{:?}", post_id); // AnId { num: 2, tag: "PostRow" }

    let user_row = UserRow{id: 5, name: "Rusty".to_string()};
    let row_id: AnId = user_row.into();
    println!("{:?}", row_id); // AnId { num: 5, tag: "UserRow" }
}
```

With this setup anytime we have a `PostRow` or `UserRow` we can easily convert it into `AnId` without needing to import anything.

Trying to implement the same interface twice in typescript is kinda weird

```ts twoslash
// @experimentalDecorators: true
// Need both the from "T" and the into "U"
interface From<T, U> {
  from: (arg: T) => U;
}

// class decorator needed to have static funcs in an interface
// see https://stackoverflow.com/questions/13955157/how-to-define-static-property-in-typescript-interface
function staticImplements<T>() {
  return <U extends T>(constructor: U) => {
    constructor;
  };
}

// could be classes but lets keep it simple
interface PostRow {
  id: number;
  title: string;
  // others...
}

interface UserRow {
  id: number;
  name: string;
  // others...
}

@staticImplements<From<PostRow | UserRow, AnId>>()
class AnId {
  constructor(private num: number, private tag: string) {}
  static from(arg: PostRow | UserRow): AnId {
    // need to see what "from" thing we have
    // this is more an issue in TS becuase of not having types at runtime
    // but similar issue exist in other langs like java https://stackoverflow.com/questions/22138475/how-to-implement-the-same-interface-multiple-times-but-with-different-generics
    if ('title' in arg) {
      // PostRow
      return new AnId(arg.id, 'PostRow');
    } else if ('name' in arg) {
      return new AnId(arg.id, 'UserRow');
    }
    throw new Error('invalid arg');
  }
}

const postRow = { id: 2, title: 'pog stuff' };
const postId = AnId.from(postRow);
console.log(postId); // AnId: {"num": 2, "tag": "PostRow"}

const userRow = { id: 5, name: 'not rusty :(' };
const userId = AnId.from(userRow);
```

Theres a lot going on in here. For one implementing a static function from an interface requires a decorator which is okish. I wish you could just have `static foo(...` in the interface but it works.
The main issue I have is you can only `implement` the interface once so you need to union all possible "froms" together into one. Then you need to make sure your **1** from function handles everything.

-- https://stackoverflow.com/a/21238513 (same guy who designed haskell designed java generics...)
-- need to watch https://www.youtube.com/watch?v=8frGknO8rIg

So these both accomplish the same idea, have some "contract" you want multiple types to "implement" so you can constraint generic types to those who respect that contract.

I think the key difference is how you implement that "contract" to an existing type. In Haskell and Rust (and others I just know those more) the implemention of a type class is seperate from the definition of a type, where as in typescript, java, (TODO: other langs) you have to add the implemention when you define a type.

- TODO: this will probably end up being a compiled vs dynamic lang thing since interfaces vs typeclasses are very similar
- the main point is compiler will add the def to a "object" where as in typescript you need to manually give an impl at the call site (if you dont do this implements stuff which sucks)
- maybe grab quote from crafting intrperts on horizontal vs vertial and visitor pattern

VVVVV this is the main point i want to show

- show some cool traits that would be a pain to add in "non functional" langs
  - many different `from<T>` impls would be very sad for a java/ts since it requires more code / less saftey / less ergonomic
- Talk about the expression problem as a whole https://craftinginterpreters.com/representing-code.html#the-expression-problem https://en.wikipedia.org/wiki/Expression_problem
  - I think traits are the soltuion but maybe it will just be discussing this as a whole?
- why traits can be sad https://lobste.rs/s/hot5by/garnet_generics_problem#c_angn1i
