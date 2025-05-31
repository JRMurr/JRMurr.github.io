---
title: Nix Typechecker Proof of Concept
slug: nix-typechecker-proof-of-concept
date: 2025-05-29T20:55:53.904Z
tags: ["nix","types","type-checking"]
draft: true
summary: An attempt to make a type checker for nix, it kinda works
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />

<Note>
    Disclosure up front. This typechecker is very much experimental. It kinda works on simple nix files but I have not tested on nixpkgs.
    Overlays/overrides *should* work in theory but will probably need some manual annotations
</Note>

- Intro
  - I really like type systems and I like nix
  - My only experience implementing type systems is a portion of my compilers class in college
  - I learned on the fly
- High Level Design
  - goal of "typescript for nix"
    - Ideally normal nix code should work, just like the promise of typescript to javascript
    - Just like typescript that promise is only half true and you will probably need some amount of annotations
  - used https://github.com/oxalica/nil as a base since it had some basic hindley milner like type inference already
  - https://bernsteinbear.com/blog/type-inference/ was a great overview of hindley milner
  - Hindley milner is good but does not natively support polymorphism without things like tagged unions or type classes (which i don't want to add since i want mostly base nix to work)
  - Support basic union types in the same vein as typescript unions (ie you don't "need" to tag them but better if you do)
- Impl
  - https://github.com/salsa-rs/salsa to structure the pipeline of checking
    - Based on code from rust-analyzer
    - Will allow for incremental updates when eventually exposed as on lsp
    - Its "db" approach lets you make "testing" impls somewhat simple
  - [rnix](https://github.com/nix-community/rnix-parser) to parse nix code, made own ast to do checking on
  - Parse doc comments for type annotations 
    - Logic sorta similar to https://github.com/nix-community/nixdoc
    - type annotations mostly follow https://github.com/hsjobeki/nix-types/blob/main/docs/README.md#nix-types-rfc-draft 
  - Name resolution
    - First "phase" of checking (logic basically taken as is from nil)
    - Walks the ast and tracks current scope with what names (variables are in scope)
    - When a variable/name is used we track a dependency between the expression where its used and the expression its defined in
  - Definition grouping
    - After name resolution we now know what variable declarations depend on each other
    - We want to do inference starting at the names with no dependencies
    - definitions can be mutually dependent so in those case those names will need to be inferred together
    - Can figure out the ordering by getting the [Strongly Connected Components](https://en.wikipedia.org/wiki/Strongly_connected_component) of the dependency graph
      - [petgraph](https://docs.rs/petgraph/latest/petgraph/algo/fn.tarjan_scc.html) did this for me
  - Type Representation: [code](https://github.com/JRMurr/tix/blob/d106515c936bbef5130bef1e30cb893a44fb5d7f/crates/lang_ty/src/lib.rs#L21) 
    - Every expression will be assigned a unique `TyID`, this will eventually be mapped to its actual type like `Int`, `String`, `Attrset{...}`, etc. But starts as a `TyVar(<TyID>)` (ie a "unknown" variable with the same int id as its key)
    - During inference (explained more later) when we see two expression need to be the same type, we `Unify` the two `TyId`s together.
      - Unification is the "core" of the the type inference and where most of the type errors will arise
      - Unification will make it so the two `TyID`s point to the same underlying type.
      - For example if you unify `TyId 2 = List(TyId 4 = TyVar(4))` with `TyID 3 = List(TyId 5 = String)`, after unification `TyId` 2 and 3 will both be `List(String)`. Also `TyId` 4 will also be mapped to a `String`
      - If you try to unify `List(Int)` with `List(String)` you will get a type error
    - We store the mapping of `TyId`s to there actual types in a [Union Find data structure](https://en.wikipedia.org/wiki/Disjoint-set_data_structure)
      - When two Ids are merged this makes it so there is only 1 source of truth for the actual type to make mutation easier and all `TyId`s will map to it
      - This allows multiple different keys to map to the same value so you don't need to update references in old types
      - The [union_find](https://crates.io/crates/union-find) crate does a lot of the work for this
  - Generalization
    - This is where a lot of complexity of the implementation comes from but its what makes hindley milner style type inference so good
    - The basic idea is you do typechecking "bottom up", when you get to a binding site of a variable you see if you need to generalize the type the variable is bound to
    - Ie if you have something like
    ```nix
    let 
      foo = x: builtins.map (elem: builtins.toString elem) x;
    in
      (foo [1 2 3]) ++ (foo ["a" "b" "c"])
    ```
    - foo is a generic func that has the type `[a] -> [String]`. The flattened type rep would look something like `Lambda { param: List(TyVar(5)), body: List(String) }`.
    - So after we do inference on the value of foo we would scan it for any parts of its type that still reference `TyVars`, these are "FreeVars" ie we don't know exactly what type it is so it will become a generic param
    - So generalization basically means when we reference foo we need to make a new copy of it at each call site since the FreeVar in it will depend on how its called.
    - In the example above it would be instantiated once with its free var as an int and a second time with its free var as a string
- Testing
  - For solo projects I don't usually go too hard testing since it usally is just me and I can keep a lot of it in my head as a dev (but obviously this fails when i leave the project...)
  - I wanted to do a Property Based Testing approach since my Day Job at [Antithesis](antithesis.com) made me a PBT shill...
  - I used the [proptest](https://github.com/proptest-rs/proptest) crate to get PBT setup
  - The rough approach i took is implement the [Arbitrary trait](https://docs.rs/proptest/latest/proptest/arbitrary/trait.Arbitrary.html) for my type representation
  - Then given an arbitrary type "ast" i convert it into a nix string. [code here](https://github.com/JRMurr/tix/blob/d106515c936bbef5130bef1e30cb893a44fb5d7f/crates/lang_check/src/pbt/mod.rs#L152)
  - Then i verify running the checker/inference on the generated text gives back the same arbitrary type generated at the start
  - This worked really well. Most of the complexity was getting my head wrapped around how prop test works but once i understood I found a lot of bugs, many in the pbt related code but a few in the actual type checker
  - The main challenge is asserting that two types are the same ie they are [Alpha Equivalent](https://en.wikipedia.org/wiki/Lambda_calculus#Alpha_equivalence)
    - For example `foo = x: builtins.toString x` and `bar = y: builtins.toString y` should both be `a -> String` but my type inference (in more complciated examples) might return `b -> String` so i needed to do a lot of work to make sure I always normalize types in the same way

OLD BELOW
  - Inference
    - For each group of definitions (from above)
      - Get the expression where the definition is made
      - Walk the expression to generate constraints
        - Each expression has a `TyId` which should eventually resolve to a concrete or generic type, starts out as `Unknown`
        - A constraint would be something like `Eq(1,2)` which means the `TyId`s `1` and `2` should be the same type
      - After generating constraints "solve them"
        - Iteratively walk through constraints and try to solve all that can, any invalid use will be a type error
        - After a full loop of constraints without being able to solve them need to "defer" the constraint (this is let generalization)
          - This basically means we don't have enough info to fully infer some types which means the unbound types are now generic types
          - TODO: explain generalization