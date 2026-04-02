---
title: Vibe coding a Type Checker/LSP for Nix
date: 2026-03-31T02:11:40.537Z
slug: vibe-coding-a-type-checkerlsp-for-nix
tags: ["nix","types","vibe coding"]
draft: true
summary: A new type checker for nix
layout: PostSimple
---


<video src="/blog/tix/type-error.webm" loop muted playsinline controls style="max-width: 100%; max-height: 500px; display: block; margin: 0 auto;"></video>


I've started working on [Tix](https://github.com/JRMurr/tix) a custom type checker in early 2025.
I didn't really know what to expect but I felt like this should be possible.
I wanted TypeScript for Nix. We can do a lot of inference to help and use type annotations for the really nasty parts.
When I started, It was my first time really using LLMs to help with coding. At that time I only used chatgpt to help me find papers, ask questions about those papers, and write small functions.
Most of the code then was done by me.

I hit a wall and life happened so I put the project down for the rest of the year. Now in 2026 I came back to Tix with agentic coding tools and we have done A LOT. Now most of the code has been written by claude.

I split this post up into two main parts, an overview of Tix that will focus on the features of the LSP and type checker and some implementation details. 

The second part is my thoughts/experience of using agentic coding tools since this project was my first real deep dive into them. 


If you have a negative opinion of vibe coding, I totally get it. I hope you can still find tix useful.


<TOCInline asDisclosure />


# Tix Overview

Tix is a custom type checker/LSP for nix based on Simple Sub (algebraic subtyping) + Negation types.
My main goal for Tix was to make the LSP experience of Nix more on par with other modern languages.
To do that I figured the best way has to have a typechecker since it would help track what can be autocompleted and where things are defined.
With that in mind I wanted a typechecker that has strong inference and use type annotations on the parts that would be too hard to infer.

I have used TypeScript for many years now and while it's not perfect it's a very pragmatic language so I wanted to bring that power to nix.

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
It's somewhat simple to implement, and it is "Complete" meaning that without any type annotations we can infer the most general type of the program passed.

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

Thankfully, [SimpleSub](https://lptk.github.io/programming/2020/03/26/demystifying-mlsub.html) is basically an extension of HM that supports subtyping.
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


To do this I added "Negation types". Basically in the type algebra we can track that something is `Not(<some inner type>)`. Then doing things like checking if something is not null or
using the `builtins.is<Type>`, the type system can narrow the given type. For example

```nix
foo = x: # x here is a generic
  if builtins.isString x
  then { key = x; } # x here is properly treated as just a string
  else x; # x here is ~string (Not(string))
```

This way you can properly handle narrowing down unions without needing a bunch of type casting.

As of this first launch it only works within an expression, so something like

```nix
foo = x: let 
  x_is_string = builtins.isString x;
in if x_is_string then { key = x; } else x;
```

would not narrow x in the conditional branches.



## Stubs

All of the type system stuff is great but inference can't realistically be done on all of nixpkgs. It has a lot of fixed point logic and its just giant.

So to get useful types from nixpkgs and other large dependencies I took the declaration file (`.d.ts`) idea from TypeScript and we support `tix` stub files. 

They look like

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
These are mostly intended to be auto generated when possible (`tix gen-stubs`). The syntax mostly matches [nixdoc](https://github.com/nix-community/nixdoc).

These stubs allow you to do things like

```nix
let
  /**
      type: lib :: Lib
  */
  lib = import ./lib.nix;

  # type: pkgs :: Pkgs
  pkgs = import ./pkgs.nix;

  greeting = lib.strings.concatStringsSep ", " [
    "hello"
    "world"
  ];
  identity = lib.id 42;
  names = lib.lists.map (x: x.name) [
    { name = "alice"; }
    { name = "bob"; }
  ];

  drv = pkgs.stdenv.mkDerivation {
    name = "my-package";
    src = ./.;
  };
  src = pkgs.fetchFromGitHub {
    owner = "NixOS";
    repo = "nixpkgs";
    rev = "abc123";
    sha256 = "000";
  };
in
{
  inherit
    greeting
    identity
    names
    drv
    src
    ;
}

# returned type is inferred as 
# { drv: Derivation, greeting: string, identity: int, names: [string], src: Derivation }
```


## Tix context

Annotations are cool but are really annoying to add comments all over your code base.
So Tix supports the idea of a "context" that for a given file will basically auto apply type annotations for you.

Tix has 3 builtin contexts (user configurable ones are a lil under baked atm)
- Nixos modules
- Home manager modules
- a "callPackage" file


For Nixos/HomeManager module we auto type the pkgs, lib, and config args.

The `callPackage` context types files that are "callPackage"able (e.g. `{ stdenv, fetchurl, lib, ... }: <some derivation build>`).
Here we use the types from the `pkgs` module in the stubs to type each lambda param.

The context (and other tix config) can be set in a `tix.toml`. For example I have this in my [nixos config repo](https://github.com/JRMurr/NixOsConfig/blob/main/tix.toml)

```toml
[context.nixos]
includes = [
    "common/**/*.nix",
    "hosts/**/default.nix",
    "hosts/desktop/**/*.nix",
    "hosts/framework/brightness/default.nix",
    "hosts/framework/hardware-configuration.nix",
    "hosts/framework/networking.nix",
    "hosts/thicc-server/**/*.nix",
]
excludes = [
    "common/default.nix",
    # dropped for space
]
stubs = ["@nixos"]

[context.home-manager]
includes = [
    "common/default.nix",
    "common/homemanager/**/*.nix",
    "common/users/jmurray/home.nix",
    "common/users/jr/default.nix",
    "hosts/framework/fingerprint-reader.nix",
]
excludes = [
    "common/homemanager/cargo.nix",
    # dropped for space
]
stubs = ["@home-manager"]

[context.callpackage]
includes = [
    "pkgs/glance.nix",
    "pkgs/happy-server.nix",
    "pkgs/herdr.nix",
    "pkgs/polybar-spotify/default.nix",
    "templates/**/rust.nix",
]
stubs = ["@callpackage"]
```

This will tell tix what files to apply what context to.

### Stub generation

To make sure the stubs for nixpkgs (and home manager) are correct for your specific checkout of nixpkgs, Tix can auto generate them. You can add this to your `tix.toml`:

```toml
[stubs.generate]
nixpkgs = { expr = "(builtins.getFlake (toString ./.)).inputs.nixpkgs" }
home-manager = { expr = "(builtins.getFlake (toString ./.)).inputs.home-manager" }
```

The expr can be any nix expression that resolves to the path of the nixpkgs/home manager checkout you have. `tix check` and the LSP will run the generation and cache the results.


## LSP

<video src="/blog/tix/auto-jump.webm" loop muted playsinline controls style="max-width: 100%; max-height: 500px; display: block; margin: 0 auto;"></video>


The LSP is the main reason i wanted to make Tix. The video above shows my favorite features

- Types on hover
- Docs on hover for nixos options
- Autocomplete on `pkgs.` to instantly see what pkgs are in nixpkgs
- Jump to def on pkgs in nixpkgs
- Jump to def on nixos config values


It's great that most of this somewhat falls out for free from all the type checking work. While the type checker does not care about docs or source locations,
it's easy to take that information on top to get a great LSP experience for not too much work.



# The Vibe Coding Experience

Tix is the first real project I used LLMs on. A year ago it was just chats but now it's full agents

## Starting out

When getting started on Tix, I was reading papers on type checking algorithms and just doing general research.
At the time I mostly used ChatGpt to help find more papers, summarize them, compare different algorithms, and ask questions to solidify my understanding.

It was a pretty good sweet spot, I was learning a lot, writing all the code, and laying out the ground work for a good architecture for the project.
The most actual code assists I got was writing pseudo code of some common inference logic i would need and stubbing out some rust functions.

I eventually hit a wall with hindley milner, I knew i would need some kind of core change so slowly lost the drive to keep going.


## Agents

A year later and basically everyone was glazing claude code so figured why not see what's going on.
For me this [Jon Gjengset stream](https://youtu.be/vmKvw73V394?si=Txfqb4dzz9R-J66a) porting a Java tool to Rust with claude and multiple agents at once was a real game changer for me.
I went from an AI agent skeptic to "AI Pilled" from almost entirely that video.

So after watching that I wanted to try it out on something. I made some new projects but wasn't quite feeling fun. Then I remembered that I had some tedious work i could delegate in Tix.

I told claude to help me research potential algorithms i could use in Tix. I knew of algebraic subtyping/SimpleSub from the first wave of research but not in detail.
After a long planning session claude was able to do the work to switch the core from HM to SimpleSub in only 30ish min.
It helped that I had a lot of tests (including PBT) already implemented so it could correct it self as it went

I was addicted after that. I was spending almost every free moment I had having claude fix bugs and making new features.

A type checker seems to be a really good fit for agents, it's well defined, good papers to reference, and relatively straightforward to see if it worked.


## What worked well

I mostly had one claude going at a time so I really paid attention to what claude seemed to be struggling on.
After claude finishes its work I will then focus on the areas of the code it struggled on so the code base doesn't naturally go to spaghetti (It still did a bit, but it works at least....)

If claude does not have a way to check itself, it gives pretty bad results or finishes before something is really done.
Also claude will sometimes have assumptions on what the code is doing, without running code it might fix the wrong thing.
The best way to deal with those two points is by telling claude to do Red Green TDD.
That alone is usually enough to get claude to start every impl by making a failing test and only finish when the test passes.

Claude is the best printf debugger I've ever seen. When debugging perf issues I had claude just add instrumentation/logs to see what was slow and using too much memory.
It would take a while but I would let it run in a loop until it found the root cause.


## What did not work well

Claude is pretty lazy. When planning features it tends to want to do the easiest thing instead of a potentially bigger refactor.
At first I took its advice more seriously but after being burned a few times I usually went with what I thought would lead to a better code base and it seemed to work out.

The core of the type checker was pretty good to give claude a good harness on. I would find a repro of some type issue and claude could run in a loop until it fixed it.
The LSP however was much more difficult. There was more variables and ephemeral state at play. Order of edits, file loading, auto complete in weird spots, 
and I used it on more real code other than dummy test examples.
I had to do a lot more manual testing of the LSP features to make sure they actually worked.
Over time I made sure the tix cli and LSP shared as much logic as possible which helped a bit but I still don't feel as good about claude one shotting LSP work.



# TODO


- mention Nil and Nixd
- a more detailed description of the core of the type checking impl (mainly how tyvars work/constraining)
- list some gotchas for things like operator overloading and string interpolation
- can pull some stuff from https://github.com/JRMurr/JRMurr.github.io/blob/767264b6c6b125a65db64d938b86e132d235317b/content/blog/nix-typechecker-proof-of-concept.md
