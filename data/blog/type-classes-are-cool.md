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
- Immutability helps me reduce cognitive load and focus on what is acutally happening.
- Higher order functions just feels good to me, there is some kind of joy in a haskell/ocaml/_insert favorite functional lang here_ of composing many funcs together to make very elegante looking 1 liners (there can be some downsides to that for future you but no one likes them)
- Strong type systems save you from yourself (or others....)

All of these points can appear in any language. Pattern matching has been added to python. Immutability is possible in any lang with enough will power. Most major languages I can think of have some kind of lambda/anoymous function to make using higher order functions easier. Compile time type ystems can be added onto basically every lang (see Typescript, the many python type checkers, crystal for ruby, etc)

Though one functional idea that I have not seen spread to many mainstream languages is [Type Classes](https://en.wikipedia.org/wiki/Type_class).

## What is a Type Class?

If you are more expereinced with OOP ideas, at first glance a type class seems to look the same as an Interface. They achieve similar goals of [Ad hoc polymorphism](https://en.wikipedia.org/wiki/Ad_hoc_polymorphism)
For example in haskell the `Show` type class (similar idea as a `toString` func) is defined as follows

```haskell
-- the definition of the type class
class Show a where
  show :: a -> String

-- implement for a type
data MyIntHolder = MyInt Int

instance Show MyIntHolder where
    show (MyInt val) = "My int has val: " ++ show val

main = putStrLn $ show (MyInt 10) -- prints "My int has val: 10"
```

in typescript you could make the following interface to express the same idea

```ts twoslash
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

const myInt = new MyIntHolder(10);
console.log(myInt.show()); // prints "My int has val: 10"
```

-- TODO: add some blurbs about using them for constraints in generics
-- https://stackoverflow.com/a/21238513 (same guy who designed haskell designed java generics...)
-- need to watch https://www.youtube.com/watch?v=8frGknO8rIg

So these both accomplish the same idea, have some "contract" you want multiple types to "implement" so you can constraint generic types to those who respect that contract.

I think the key difference is how you implement that "contract" to an existing type. In Haskell and Rust (and others I just know those more) the implemention of a type class is seperate from the definition of a type, where as in typescript, java, (TODO: other langs) you have to add the implemention when you define a type.

- TODO: this will probably end up being a compiled vs dynamic lang thing since interfaces vs typeclasses are very similar
- the main point is compiler will add the def to a "object" where as in typescript you need to manually give an impl at the call site (if you dont do this implements stuff which sucks)
- maybe grab quote from crafting intrperts on horizontal vs vertial and visitor pattern

VVVVV this is the main point i want to show

- show some cool traits that would be a pain to add in "non functional" langs
  - many different `from<T>` impls would be very sad for a java/ts class since its implements line would be hella long
  - could you even implement multiple different `from<T>` in java/ts?
