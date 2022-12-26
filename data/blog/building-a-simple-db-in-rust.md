---
title: Building a Simple DB in Rust - Part 1
date: 2022-12-26T03:47:02.984Z
tags: ['rust', 'database']
draft: false
summary: building a basic database in rust
images: []
layout: PostLayout
---

<TOCInline toc={props.toc} asDisclosure />

While I've used rust for a while and have had a few small projects in it, I felt like I was missing a truly "systems" project.
So I figured why not try to make my own basic DB in rust.

I've worked on basic compilers/interpreters before, but I have not done much with database implementation outside of making my own (awful) B-Tree in college.

This series will be mostly a dev log but will try to do what I can to use it as tutorial content when possible.
I will probably get things wrong, so please call me out in comments, on my [GitHub](https://github.com/JRMurr/JRMurr.github.io), or on my [socials](/about)

I really don't know how hard this will be so here's my list of goals and stretch goals.

## Goals

- Have "reasonable" performance
- Support basic data types (bool, int, floats, text)
- Support simplish queries (some aggregates, basic joins/filters)
- Start out with existing crates when possible. Make my own when it sounds fun, would be a good learning experience, or needed for performance
- Good error messages

### Stretch goals

- Basic transactions
- More than basic concurrency (try to avoid fully locking tables to allow at least multiple readers)
- JSON column support

I really don't know how unreasonable these are so will update if the goals change.

These mostly follow being an even more basic SQLite so lets call this SQLJr

## Project setup

I love nix, so I always start with that to get rust installed.
I recently made my own [nix flake templates](https://github.com/JRMurr/NixOsConfig/tree/main/templates) to make starting new projects easier.
You can run

```shell
$ nix flake --refresh new --template github:JRMurr/NixOsConfig#rust <pathToProjectDir>
```

to create a new folder with a `flake.nix` file to get rust setup with nightly, update the `rust-toolchain.toml` to the most recent nightly.

The template does not include a `Cargo.toml` so make one with `cargo init` or `cargo new` to set up the crate.

### Cargo Workspaces

While we could probably get away with having a `core`/`lib` crate then make an `application` crate for CLI/HTTP access to the DB,
I would like to try to split up the crates across more logical boundaries. This helps out with compile times since rust can compile each crate in parallel.
My current idea is a different crate for

- a CLI/REPL to interact with a db
- Parsing/the SQL language
- Query Execution

Some things like defining the different commands/queries doesn't quite feel right in being in the parsing/execution crates so might make sense to add a crate just for shared types.

To set up cargo workspaces make a `Cargo.toml` that looks like

```toml:Cargo.toml
[workspace]
members = [
    # all crates in a `./crates` folder will be added to the workspace
	"crates/*",
]

# https://doc.rust-lang.org/nightly/cargo/reference/specifying-dependencies.html#inheriting-a-dependency-from-a-workspace
# Shared dependencies across all workspace crates
[workspace.dependencies]
# these are very likely to be used across all/most crates so pin the version for them all
thiserror = "1.0.38"
serde = { version = "1.0.151", features = ["derive"] }
```

this will tell cargo we are using workspaces. Once we start making crates I will explain how to use the shared dependencies listed above

## The REPL

While we could go right to execution or parsing and just develop with unit tests, I like having some form of interactivity as soon as possible.
The unit test approach would definitely make sense if this was a "real" project, for personal stuff I'm fine being a bit in the wild west to make life easier.

So to get to interactivity let's make a REPL. We can make a new crate by going in the `crates` directory and running `cargo new sql_jr_repl`.
The [rustyline crate](https://github.com/kkawakam/rustyline) seems like it will cover the basics for a REPL, so we can add it with `cargo add rustyline` in the `sql_jr_repl` directory.

We can basically copy the example with some small tweaks to get started

```rust:main.rs
use rustyline::error::ReadlineError;
use rustyline::{Editor, Result};

const HISTORY_FILE: &str = "./history.txt";

fn main() -> Result<()> {
    let mut rl = Editor::<()>::new()?;
    if rl.load_history(HISTORY_FILE).is_err() {
        println!("No previous history.");
    }
    loop {
        let readline = rl.readline(">> ");
        match readline {
            Ok(line) => {
                rl.add_history_entry(line.as_str());
                println!("Line: {}", line);
            },
            Err(ReadlineError::Interrupted) => {
                // CTRL-C so just skip
            },
            Err(ReadlineError::Eof) => {
                // CTRL-D so exit
                break
            },
            Err(err) => {
                println!("Error: {:?}", err);
                break
            }
        }
    }
    rl.save_history(HISTORY_FILE)
}
```

This will store the history in a local file (we can use the users home/XDG dirs to store it elsewhere later) and allow `CTRL-C` to "cancel" the current input and have `CTRL-D`/an error exit the REPL.
Try it out with `cargo run`, it will just repeat lines you send with enter and run until you hit `CTRL-D`.

## Parsing

Now that the basic REPL is set up we can work on parsing our simple SQL language.
