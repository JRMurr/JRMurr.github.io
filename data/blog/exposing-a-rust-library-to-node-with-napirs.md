---
title: Exposing a Rust Library to Node with Napi-rs
date: 2023-04-28T22:45:08.080Z
tags: ['rust', 'node', 'typescript']
draft: false
summary: Short guide/exploration on making native node addons with rust
images: []
layout: PostLayout
---

<TOCInline toc={props.toc} asDisclosure />

I unapologetically shill for Rust any chance I get. I annoy my coworkers any chance I get to say how things would be better if we just used Rust. It's basically a meme at this point so no one actually listens to me (rightfully so).

So to finally stop the meme I figured I would start researching ways we could actually incorporate Rust into our systems. Ideally we would make a new service in Rust, but we aren't big on microservices (yet). So the best path would be to call rust directly from node.
Since Node is written in C++ it has ways to call out to native code via [addons](https://nodejs.org/api/addons.html), the library [napi-rs](https://napi.rs/) helps with the boilerplate of exposing rust code as a node addon.

Napi-rs along with generating the node addon will also generate typescript type definitions and has a nice CLI to more easily make addons for all popular systems/architectures.

## Setting up napi

I'm going to experiment with napi in the codebase from the [build a db in rust series](/blog/build-a-db/part01), branch with all the code [here](https://github.com/JRMurr/SQLJr/tree/napi-bindings/crates/sql_jr_node).

You first need to install the napi CLI, which can be done with your favorite node package manager of choice, or if your a giant nerd like me, nix...

You can add the `napi-rs-cli` to your nix devShell like so

```nix:flake.nix
  buildInputs = with pkgs; [
     napi-rs-cli
  ]'
```

The cli will generate a rust crate with the right build scripts to build the node addon, the needed node boiler plate to load the addon with type definitons, and some github actions to build and publish the npm packages
