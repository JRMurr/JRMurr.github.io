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
  - Inference
    - TODO: probably explain the type representation before?
    - TODO: explain unification before?
    - For each group of definitions (from above)
      - Get the expression where the definition is made
      - Walk the expression to generate constraints
        - Each expression has a `TyId` which should eventually resolve to a concrete or generic type, starts out as `Unknown`
        - A constraint would be something like `Eq(1,2)` which means the `TyId`s `1` and `2` should be the same type
        - The [union_find](https://crates.io/crates/union-find) crate is used to store all the `TyId`s, its use will make more sense in the solving phase
      - After generating constraints "solve them"
        - Iteratively walk through constraints and try to solve all that can, any invalid use will be a type error
        - After a full loop of constraints without being able to solve them need to "defer" the constraint (this is let generalization)
          - This basically means we don't have enough info to fully infer some types which means the unbound types are now generic types
          - TODO: explain generalization