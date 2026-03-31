---
title: Vibe coding a Type Checker/LSP for Nix
date: 2026-03-31T02:11:40.537Z
slug: vibe-coding-a-type-checkerlsp-for-nix
tags: ["nix","types","vibe coding"]
draft: true
summary: A new type checker for nix
layout: PostSimple
---

I've started working on [Tix](https://github.com/JRMurr/tix) a custom type checker in early 2025.
I didn't really know what to expect but I felt like this should be possible.
I wanted TypeScript for Nix. We can do a lot of inference to help and use type annotations for the really nasty parts.
When I started, It was my first time really using LLMs to help with coding. At that time I only used chatgpt to help me find papers, ask questions about those papers, and write small functions.
Most the code then was done by me.

I hit a wall and life happened so I put the the project down for the rest of the year. Now in 2026 I came back to Tix with agentic coding tools and we have done A LOT. Now most of the code has been written by claude.

I split this post up into two main parts, an overview of Tix that will focus on the features of the LSP and type checker and some implementation details. 

The second part is my thoughts/experience of using agentic coding tools since this project was my first real deep dive into them. 


If you have a negative opinion of vibe coding, I totally get it. I hope you can still find tix useful (IT SO GOOD).


<TOCInline asDisclosure />


# Tix Overview

Tix is a custom type checker/LSP for nix based on Simple Sub (algebraic subtyping) + Negation types.
My main goal for Tix was to make the LSP experience of Nix more on par with other modern languages.
To do that I figured the best way has to have a typechecker since it would help track what can be autocompleted and where things are defined.
With that in mind I wanted a typechecker that has pretty inference and use type annotations on the parts that would be too hard to infer.

I have used TypeScript for many years now and while its not perfect its a very pragmatic language so I wanted to bring that power to nix.

Here is what Tix can do

- Give you type errors for bad nix code
- Auto complete for pkgs in NixPkgs
- Auto complete + inline docs for Nixos config values
- Jump to def across files in your project <!-- TODO: make this work better for real -->
- Jump to def into Nixpkgs on pkgs + Nixos options


Tix is also pretty fast. A full type check of nixpkgs can be done in around 20 secs (with some caveats I'll explain later). 
Smaller projects like my [nixos config](https://github.com/JRMurr/NixOsConfig) check in 5ish seconds.

## The Type System

A very common type system people pick for functional languages is Damas-Hindley-Milner (commonly called Hindley-Milner or HM).
Its somewhat simple to implement, and it is "Complete" meaning that without any type annotations we can infer the most general type of the program passed.

### A Basic Implementation of HM

See [this post](https://bernsteinbear.com/blog/type-inference/) for a great implementation overview, I will cover just the high level here.

It basically works like this (I am simplifying this heavily)

- Walk the AST of the program
  - As you walk assign unique type variables to each expression
  - Generate constraints on those type variables
    - EX: `let x = a` x and a must be the same type
    - EX: `let y = foo b`, foo must be a function that takes b as its arg
    - EX: `let z = bar.someKey` bar must be an attrset with at least the key `someKey`
- Solve all those generated constraints via unification, propagating the info gained from each constraint to the type variables involved.


I implemented HM initially and it worked great until I wanted to support union types, types whose value could be a number of different types, ie `string | int | {key: string}`.
When you do inference in HM you can only equate two unknown types to be the same type, there is no kind of subtyping relationship that unions need.

Other languages that use HM support some kind of tagged union to work around this. I did not want to change the core nix language so this would not really work for Tix.

### SimpleSub

Thankfully, [SimpleSub](https://lptk.github.io/programming/2020/03/26/demystifying-mlsub.html) is basically and extension of HM that support sub typing.
It has the same high level idea of walk the ast and generate constraints. But instead of requiring unification you can encode a subtyping relationship. 
For example in `let y = foo b`, instead of saying that b must be the same type as the arg of foo, b can be a subtype of the arg of foo.

This subtyping relationship is what makes union types fall out naturally.
Type variables accumulate upper and lower bounds as constraints are solved — those bounds become intersections and unions in the inferred types.
So if a value could be a `string` or an `int` depending on which branch was taken, that's not a type error — it's just a union type `string | int`.


### Narrowing

Once SimpleSub was implemented the main challenge was now narrowing down unions to useful subsets when needed. For example

```nix
let 
    foo = {name ? null}: if name != null then builtins.stringLength name else 0;
in foo {name = "John"}
```

Here the inferred type of `foo` would be `{name?: string | null } -> int`. Without a way to "narrow" the union to the non null case at the type level 
we would have a type error on builtins.stringLength name since its type only accepts string and not null.


To do this I added "Negation types"
<!-- TODO: add links and explain more -->



## Stubs

All of the type system stuff is great but inference can not realistically done on all of nixpkgs. It has a lot of fixed point logic and its just giant.

So to get useful types from nixpkgs and other large dependencies I took the declaration file idea from TypeScript and we support `tix` stub files. 

They look like


<!-- TODO: remember to update if I change the syntax -->


```
type NixosConfig = {
  appstream: {
    ## Whether to install files to support the
    ## [AppStream metadata specification](https://www.freedesktop.org/software/appstream/docs/index.html).
    @source nixpkgs:nixos/modules/config/appstream.nix:4:5
    enable: bool,
    ...
  },
  ## This option allows modules to express conditions that must
  ## hold for the evaluation of the system configuration to
  ## succeed, along with associated error messages for the user.
  @source nixpkgs:nixos/modules/misc/assertions.nix:6:5
  assertions: [{ ... }],
  boot: {
    bcache: {
      ## Whether to enable bcache mount support.
      @source nixpkgs:nixos/modules/tasks/bcache.nix:11:3
      enable: bool,
      ...
    },
  }
  # many more fields....
}

type Derivation = {
  name: string,
  pname: string,
  version: string,
  type: string,
  outPath: string,
  drvPath: string,
  system: string,
  builder: path | string,
  args: [string],
  outputs: [string],
  meta: { ... },
  ...
};

module pkgs {

  # mkDerivation accepts either an attrset or a function (finalAttrs: { ... })
  val mkDerivation :: ({ name: string, ... } | { pname: string, version: string, ... } | ({ ... } -> ({ name: string, ... } | { pname: string, version: string, ... }))) -> Derivation;

  val lib :: Lib;

  module stdenv {
    # mkDerivation accepts either an attrset or a function (finalAttrs: { ... })
    val mkDerivation :: ({ name: string, ... } | { pname: string, version: string, ... } | ({ ... } -> ({ name: string, ... } | { pname: string, version: string, ... }))) -> Derivation;
    val cc :: Derivation;
    val shell :: path;
    val isLinux :: bool;
    val isDarwin :: bool;
    val hostPlatform :: { system: string, isLinux: bool, isDarwin: bool, isx86_64: bool, isAarch64: bool, ... };
    val buildPlatform :: { system: string, isLinux: bool, isDarwin: bool, ... };
    val targetPlatform :: { system: string, isLinux: bool, isDarwin: bool, ... };
  }
}
```

<!-- TODO expand -->


## LSP

<!-- TODO expand -->


# The Vibe Coding Experience


# TODO


- mention Nil and Nixd
- a more detailed description of the core of the type checking impl (mainly how tyvars work/constraining)
- list some gotchas for things like operator overloading and string interpolation
- Might want to do another pass on stub file syntax before i launch for real. `val key :: type` is a lil weird
- can pull some stuff from https://github.com/JRMurr/JRMurr.github.io/blob/767264b6c6b125a65db64d938b86e132d235317b/content/blog/nix-typechecker-proof-of-concept.md
- 