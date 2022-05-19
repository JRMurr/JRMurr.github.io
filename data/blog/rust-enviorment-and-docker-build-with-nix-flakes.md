---
title: Rust Environment and Docker Build with Nix Flakes
date: '2022-05-19'
tags: ['rust', 'nix', 'docker']
draft: true
summary: Reproducible dev environments and builds with Nix
images: []
layout: PostLayout
---

## Why Nix

Getting a dev environment setup with rust is usually pretty simple, just use rustup then you're good to go.
Using a build tool like [Nix](https://nixos.org/) can buy you much more for not much extra work. Nix lets you

- Specify non rust project dependencies in code
- Automatically add all your projects tools/dependencies to your path with [direnv](https://direnv.net/)
- Easily build slim docker containers

Once you start working in a repo with nix you never want to go back.
No more READMEs with a list of Homebrew, apt, pacman, etc. commands you need to run.
Building slim docker containers is a breeze without needing to manually handle multiple layers to copy build artifacts from.

This post will mostly be a quick and dirty guide to getting started with nix, so I won't go into too much detail on what nix is doing under the hood/nix syntax.
For a quick and dirty nix syntax reference I recommend [learn X in Y's post](https://learnxinyminutes.com/docs/nix/),
if you have some functional programming experience most of the basics will be quick to pick up.

## The Dev environment

We will use [nix flakes](https://nixos.wiki/wiki/Flakes) to set up nix for our project.
Flakes are nix's newish way to make nix builds more reproducible by adding a lock file concept to the project.
Each flake can have `inputs` which are other flakes/nix files and many [outputs](https://nixos.wiki/wiki/Flakes#Output_schema).
One thing to note, all files referenced in your flake (including itself) must be added to git.
If you run into any file not found errors make sure you `git add` everything you need.

To get started in the root of your project run

```bash
nix flake init
```

This will give you a `flake.nix` file that looks like

```nix
{
  description = "A very basic flake";

  outputs = { self, nixpkgs }: {

    packages.x86_64-linux.hello = nixpkgs.legacyPackages.x86_64-linux.hello;

    defaultPackage.x86_64-linux = self.packages.x86_64-linux.hello;

  };
}
```

This starter flake will build a hello world binary with `nix build .#hello` which calls the first line or with just `nix build` to call the `defaultPackage` line.
The downside is this only builds the package on x86/64 Linux, let's add some inputs to generalize this to more systems.

```nix
{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = import nixpkgs { inherit system; };
      in {
        packages.hello = pkgs.hello;
        defaultPackage = pkgs.hello;
      });
}
```

We added two inputs, the first is `nixpkgs` which lets us specify which version of nixpkgs we should use.
There are many [thousands of packages](https://search.nixos.org/packages) in the nixpkg repository, and they are updated often so here will use the unstable branch.
We also added [flake-utils](https://github.com/numtide/flake-utils) which helps us generalize the flake to support multiple systems, not just Linux.

Now on Linux and mac the hello package will build. When you run `nix build`, you should see a `result` folder which contains the `hello` package,
you can run it with `./result/bin/hello`. The `result` folder is a symlink to the output of build in the nix store (where nix keeps all outputs).
It will not always be a folder, it will just depend on the build.

## Rust in Nix

To move on from "hello world" to rust lets add another input

```nix
inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
        rustVersion = pkgs.rust-bin.stable.latest.default;
      in {
        devShell = pkgs.mkShell {
          buildInputs =
            [ (rustVersion.override { extensions = [ "rust-src" ]; }) ];
        };
      });
}
```

We added [rust-overlay](https://github.com/oxalica/rust-overlay), so we can easily specify different rust versions
without relying on `nixpkgs` to give us what ever rust version in there.

We also switched the `outputs` to only have `devShell`, that output is tied to `nix develop`, when run you will get a new sandboxed shell with the stable rust version.

If you want to use a specific version/nightly build you can use
`rustVersion = (pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml);` to read a rust toolchain file and use the version specified in there.

You may also have noticed we added `.override { extensions = [ "rust-src" ]; })`. This is needed for rust analyzer to get rust source code.

## Automatically load the Nix environment

Now that we have the rust version we want let's make the `nix develop` step automatic.

Install [direnv](https://direnv.net/) and [nix-direnv](https://github.com/nix-community/nix-direnv).
The second is optional but helps with caching, so I recommend it.

Direnv will add hooks to your shell so when you `cd` into your project it will autoload the nix environment for you without needing to run `nix develop`.

In the root of your project run

```bash
echo "use flake" >> .envrc
direnv allow
```

The `.envrc` file will be loaded by direnv, and it will use the flake's `devShell` output to set up your environment.
On changes to your flake direnv will reload only what has changed.

If you are using VS Code, use [nix env selector](https://marketplace.visualstudio.com/items?itemName=arrterian.nix-env-selector), so VS Code is aware of the flake. It is not always necessary if you open VS Code from your terminal, but It's simple to set up.

## Build Rust project

Now that we have rust in our dev environment we can make a new rust app with

```bash
cargo init
```

Then we can run/build the project like you normally would with `cargo run`/`cargo build`.
That works well while developing but let's use nix to build the project, this will help us later on when we make the docker image.

Let's update the outputs too

```nix
outputs = { self, nixpkgs, flake-utils, rust-overlay, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
        rustVersion = pkgs.rust-bin.stable.latest.default;

        rustPlatform = pkgs.makeRustPlatform {
          cargo = rustVersion;
          rustc = rustVersion;
        };

        myRustBuild = rustPlatform.buildRustPackage {
          pname =
            "rust_nix_blog"; # make this what ever your cargo.toml package.name is
          version = "0.1.0";
          src = ./.; # the folder with the cargo.toml

          cargoLock.lockFile = ./Cargo.lock;
        };

      in {
        defaultPackage = myRustBuild;
        devShell = pkgs.mkShell {
          buildInputs =
            [ (rustVersion.override { extensions = [ "rust-src" ]; }) ];
        };
      });
```

First we have to make a `rustPlatform` with our rust version.
The platform will let us build our rust package with `rustPlatform.buildRustPackage`. This is the nix equivalent of `cargo build`.
We need `cargoLock.lockFile` so nix can cache all of your project's dependencies based on your existing lock file.

Now we can run `nix build`, then your project will be in the `result` folder again. In my case I can run `./result/bin/rust_nix_blog`.

## Make a Docker image

Now that we have nix building the rust project making the docker container is quite easy.

```nix
outputs = { self, nixpkgs, flake-utils, rust-overlay, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
        rustVersion = pkgs.rust-bin.stable.latest.default;

        rustPlatform = pkgs.makeRustPlatform {
          cargo = rustVersion;
          rustc = rustVersion;
        };

        myRustBuild = rustPlatform.buildRustPackage {
          pname =
            "rust_nix_blog"; # make this what ever your cargo.toml package.name is
          version = "0.1.0";
          src = ./.; # the folder with the cargo.toml

          cargoLock.lockFile = ./Cargo.lock;
        };

        dockerImage = pkgs.dockerTools.buildImage {
          name = "rust-nix-blog";
          config = { Cmd = [ "${myRustBuild}/bin/rust_nix_blog" ]; };
        };

      in {
        packages = {
          rustPackage = myRustBuild;
          docker = dockerImage;
        };
        defaultPackage = dockerImage;
        devShell = pkgs.mkShell {
          buildInputs =
            [ (rustVersion.override { extensions = [ "rust-src" ]; }) ];
        };
      });
```

Now `nix build` or `nix build .#docker` will build the docker image. After building `result` is just a sym link to the image tar file of a folder like before.
Since nix is declarative it does not load it directly into docker for you. You can load it with

```bash
docker load < result
```

You should see an output like `rust-nix-blog:yyc9gd4nkydrikzpsvlp3gmwnpxhh1ik` which is the image and tag loaded in.

Now run the image with

```bash
docker run rust-nix-blog:yyc9gd4nkydrikzpsvlp3gmwnpxhh1ik
```

We can automate this a bit with a script like. (Slightly modified example from [here](https://jamey.thesharps.us/2021/02/02/docker-containers-nix/))

```bash
#!/usr/bin/env bash
set -e; set -o pipefail;

nix build '.#docker'
image=$((docker load < result) | sed -n '$s/^Loaded image: //p')
docker image tag "$image" rust-nix-blog:latest
```

Let's use [dive](https://github.com/wagoodman/dive) to look at the image. You can use it temporarily with `nix shell nixpkgs#dive`.

Looking at the output you can see it's a single layer image with just they need nix store package to run the binary (in case just libc and the rust code).

## Common troubleshooting issues

### Non rust build dependencies

Building with nix is great once its working, it will stay working forever.
Getting to a working state can be a bit of pain sometimes.
If your rust code relies on system packages (like OpenSSL) make sure you include them in `buildInputs`, for example

```nix
rustPlatform.buildRustPackage {
  pname =
    "rust_nix_blog"; # make this what ever your cargo.toml package.name is
  version = "0.1.0";
  src = ./.; # the folder with the cargo.toml
  nativeBuildInputs = [pkg-config ]; # just for the host building the package
  buildInputs = [openssl]; # packages needed by the consumer
  cargoLock.lockFile = ./Cargo.lock;
};
```

For OpenSSL specifically I would recommend using rusttls when possible. It's easier to build and in rust.

### Nix Docs

Nix documentation is not the best. While the [wiki](https://nixos.wiki/wiki/Rust) and [manual](https://nixos.org/manual/nixpkgs/stable/#preface) have some info, I've found the best resources have been the many nix bloggers out there. Here are some good references

- [Xe](https://christine.website/blog/nix-flakes-1-2022-02-21) most of her blogs relate to nixos, the Linux distro based on nix, but it helps to learn the language and common patterns
- [Ian Henry's how to learn nix](https://ianthehenry.com/posts/how-to-learn-nix/) Ian has a blog series of him learning nix. It's not really documentation but more curated notes of his process of using nix.
- [Intro to nix flakes](https://www.tweag.io/blog/2020-05-25-flakes/) Great 3 part series on what flakes are and how to use them
- [Building docker containers with nix](https://jamey.thesharps.us/2021/02/02/docker-containers-nix/) Linked this earlier, but it's a good reference for more options on building containers

I also highly recommend on diving headfirst into nix by using Nixos as your Linux distro. It will help make you more comfortable with the language and its great to use once it clicks.
