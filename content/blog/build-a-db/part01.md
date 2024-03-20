---
title: Building a Simple DB in Rust - Part 1 - Parsing
seriesTitle: Part 1 - Parsing
slug: build-a-db/part01
date: 2023-01-02T05:19:22.985Z
tags: ['rust', 'database', 'parsing']
draft: false
summary: building a basic database in rust
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />

While I've used rust for a while and have had a few small projects in it, I felt like I was missing a truly "systems" project.
So when I came across [this series](https://cstack.github.io/db_tutorial/) for making a simple DB in C, I figured why not try to make my basic DB in rust.
I will roughly follow the structure of that series at first, but I will most likely deviate and focus on what interests me more.

This series will be mostly a dev log (I'm making this up as I go) but will try to do what I can to use it as tutorial content when possible.
I will probably get things wrong, so please call me out in comments, on my [GitHub](https://github.com/JRMurr/JRMurr.github.io), or my [socials](/about)

I hate naming things, so I'll keep it basic, I will be calling my DB SQLJr

If you wanna just jump to some code [this is the repo for it](https://github.com/JRMurr/SQLJr).
It will be mostly the same with some minor tweaks here and there (and more up-to-date).

## What am I Making

I plan on mostly focusing on building my own SQL (not following any spec) that will have basic filtering, aggregates, and joins.
Since rust has many B-Tree libraries (One of the core data structures for how to store/search rows), I will try to focus more on good concurrency+transaction support instead of building my own B-tree/persistence logic.
Also, many Rust based tools I used have excellent error messages, so I will try to have good/informative errors for all parts of the DB.

I will probably end up on some side tangents from those core features, so I will follow whatever vibe I get.

In this post, we will focus on getting the project setup and building a basic REPL (in a similar vein to [psql](https://www.postgresql.org/docs/current/app-psql.html)) + parser
to make it easy to interact with the rest of the DB later on.

## Project setup

I love [Nix](https://nixos.org/), so I always start with that to get rust installed.
I recently made my own [nix flake templates](https://github.com/JRMurr/NixOsConfig/tree/main/templates) to make starting new projects easier.
You can run

```shell
$ nix flake --refresh new --template github:JRMurr/NixOsConfig#rust <pathToProjectDir>
```

to create a new folder with a `flake.nix` file to get rust setup with nightly, update the `rust-toolchain.toml` to the most recent nightly.

The template does not include a `Cargo.toml` so make one with `cargo init` or `cargo new` to set up the crate.

### Cargo Workspaces

While we could probably get away with having a `core`/`lib` crate and then make an `application` crate for CLI/HTTP access to the DB,
I would like to try to split up the crates across more logical boundaries. This helps out with compile times since rust can compile each crate in parallel.
My current idea is a different crate for

- a CLI/REPL to interact with a db
- Parsing SQL
- Query Execution

Some things like defining the different commands/queries don't quite feel right in being in the parsing/execution crates so might make sense to add a crate just for shared types.

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
miette = "5.5.0"
serde = { version = "1.0.151", features = ["derive"] }
thiserror = "1.0.38"
```

This will tell cargo we are using workspaces. Once we start making crates I will explain how to use the shared dependencies listed above

## The REPL

While we could go right to execution or parsing and just develop with unit tests, I like having some form of interactivity as soon as possible.
The unit test approach would definitely make sense if this was a "real" project, for personal stuff I'm fine being a bit in the wild west to make life easier.

So to get to interactivity let's make a REPL. We can make a new crate by going into the `crates` directory and running  `cargo new sql_jr_repl`. The [rustyline crate](https://github.com/kkawakam/rustyline) seems like it will cover the basics for a REPL, so we can add it with `cargo add rustyline`in the`sql_jr_repl` directory.

We can copy the example with some small tweaks to get started

```rust:sql_jr_repl/main.rs
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

This will store the history in a local file (we can use the user's home/XDG dirs to store it elsewhere later) and allow `CTRL-C` to "cancel" the current input and have `CTRL-D`/an error exit the REPL.
Try it out with `cargo run`, it will just repeat the lines you send with enter and run until you hit `CTRL-D`.

## Parsing

Now that the basic REPL is set up we can work on parsing our simple SQL. In Rust, I have usually used [nom](https://github.com/Geal/nom) when I need to make a parser.
I like that I stay in rust and don't need to mess with a new "language" to get my parsing code. With that said [pest](https://pest.rs/) looks pretty great as a more generator approach and may end up switching to that later on.

### nom for dummies

nom is a [parser combinator library](https://en.wikipedia.org/wiki/Parser_combinator). The TLDR for that is you make functions that take in parsers and output parsers to build up your grammar.

Here are some examples

```rust
// IResult tracks the input type (generally string or bytes) and the output type for the parser
fn parser(s: &str) -> IResult<&str, &str> {
  tag_no_case("hello")(s)
}
// when you run a parser on some input it will return the remaining input in the first param
// and the matched input for that parser that ran
assert_eq!(parser("Hello, World!"), Ok((", World!", "Hello")));


// NOTE: this is missing some trait bounds but the vibe is right
/// Run the given parser f on a comma seperated list
pub(crate) fn comma_sep<I, O, E, F>(
    f: F,
) -> impl FnMut(I) -> IResult<I, Vec<O>, E>
where
{
    separated_list1(tuple((multispace0, char(','), multispace0)), f)
}
```

There are [many combinators](https://github.com/Geal/nom/blob/main/doc/choosing_a_combinator.md) provided by nom.

### My Own SQL

Right now I'm going to handle basic select, insert, and create table statements that will look like

```
CREATE TABLE FOO (
    col1 string,
    col2 int
)

INSERT INTO FOO VALUES 1,2;

SELECT col1, col2 FROM foo;
```

To start we can make a new lib crate `sql_jr_parser`. We will add in nom, [nom_locate](https://github.com/fflorent/nom_locate), and [nom_supreme](https://github.com/Lucretiel/nom-supreme).
`nom_locate` has a nice `LocatedSpan` type to easily track where in the source code a parser ran/threw an error.
`nom_supreme` is a nom utility lib, we will use it mostly for postfix calls on parsers to make the code a little easier to read and [error tree](https://docs.rs/nom-supreme/latest/nom_supreme/error/type.ErrorTree.html)
to help with error formatting

To be completely honest we probably could get by without `nom_locate` and just use `nom_supreme` but if it's good enough for [Amos](https://fasterthanli.me/series/advent-of-code-2022/part-11#nice-parser-errors) it's good enough for me

### Actual parsing

<Note>
nom requires ALOT of imports so will be ignoring most of them in the code snippets
</Note>

First, we need to define some type aliases

```rust
// Use nom_locate's LocatedSpan as a wrapper around a string input
pub type RawSpan<'a> = LocatedSpan<&'a str>;

// the result for all of our parsers, they will have our span type as input and can have any output
// this will use a default error type but we will change that latter
pub type ParseResult<'a, T> = IResult<RawSpan<'a>, T>
```

We will need to parse identifiers for columns and tables so let's make a parser for that

```rust
/// Parse a unquoted sql identifier
pub(crate) fn identifier(i: RawSpan) -> ParseResult<String> {
    map(take_while1(|c: char| c.is_alphanumeric()), |s: RawSpan| {
        s.fragment().to_string()
    })(i)
}
```

Since we made the parser take in a `RawSpan` instead of just a `& str` or `String` we would need to first call `LocatedSpan::new(input_str)` to call our parsers.

### Helper trait

Since we will have a lot of different things we need to parse let's make a trait to make it easier to track what each parser is for.

```rust
/// Implement the parse function to more easily convert a span into a sql
/// command
pub trait Parse<'a>: Sized {
    /// Parse the given span into self
    fn parse(input: RawSpan<'a>) -> ParseResult<'a, Self>;

    /// Helper method for tests to convert a str into a raw span and parse
    fn parse_from_raw(input: &'a str) -> ParseResult<'a, Self> {
        let i = LocatedSpan::new(input);
        Self::parse(i)
    }
}
```

Now anything we want to parse can implement a `Parse` method which lets us compose types/parsers,
and we can add any helper functions into this trait we need for testing or error handling.

### Parsing Create Table

Create table statements need to parse/extract 3 things

- The table name we will create
- The column names
- The types for those columns

So let's make a type + parser for each

```rust
// Using tag_no_case from nom_supreme since its error is nicer
// ParserExt is mostly for adding `.context` on calls to identifier to say what kind of identifier we want
use nom_supreme::{tag::complete::tag_no_case, ParserExt};
// many other imports omitted

/// A colum's type
#[derive(Debug, Clone, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub enum SqlTypeInfo {
    // these are basic for now. Will add more + size max later on
    String,
    Int,
}
// parses "string | int"
impl<'a> Parse<'a> for SqlTypeInfo {
    fn parse(input: RawSpan<'a>) -> ParseResult<'a, Self> {
        // context will help give better error messages later on
        context(
            "Column Type",
            // alt will try each passed parser and return what ever succeeds
            alt((
                map(tag_no_case("string"), |_| Self::String),
                map(tag_no_case("int"), |_| Self::Int),
            )),
        )(input)
    }
}

/// A column's name + type
#[derive(Debug, Clone, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub struct Column {
    pub name: String,
    pub type_info: SqlTypeInfo,
}

// parses "<colName> <colType>"
impl<'a> Parse<'a> for Column {
    fn parse(input: RawSpan<'a>) -> ParseResult<'a, Self> {
        context(
            "Create Column",
            map(
                separated_pair(
                    identifier.context("Column Name"),
                    multispace1,
                    SqlTypeInfo::parse,
                ),
                |(name, type_info)| Self { name, type_info },
            ),
        )(input)
    }
}

/// The table and its columns to create
#[derive(Clone, Debug, Default, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub struct CreateStatement {
    pub table: String,
    pub columns: Vec<Column>,
}

// parses a comma seperated list of column definitions contained in parens
fn column_definitions(input: RawSpan<'_>) -> ParseResult<'_, Vec<Column>> {
    context(
        "Column Definitions",
        map(
            tuple((char('('), comma_sep(Column::parse), char(')'))),
            |(_, cols, _)| cols,
        ),
    )(input)
}

// parses "CREATE TABLE <table name> <column defs>
impl<'a> Parse<'a> for CreateStatement {
    fn parse(input: RawSpan<'a>) -> ParseResult<'a, Self> {
        map(
            separated_pair(
                // table name
                preceded(
                    tuple((
                        tag_no_case("create"),
                        multispace1,
                        tag_no_case("table"),
                        multispace1,
                    )),
                    identifier.context("Table Name"),
                ),
                multispace1,
                // column defs
                column_definitions,
            )
            .context("Create Table"),
            |(table, columns)| Self { table, columns },
        )(input)
    }
}


// I was a test hater earlier but may as well cover the basics...
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create() {
        let expected = CreateStatement {
            table: "foo".into(),
            columns: vec![
                Column {
                    name: "col1".into(),
                    type_info: SqlTypeInfo::Int,
                },
                Column {
                    name: "col2".into(),
                    type_info: SqlTypeInfo::String,
                },
                Column {
                    name: "col3".into(),
                    type_info: SqlTypeInfo::String,
                },
            ],
        };
        assert_eq!(
            CreateStatement::parse_from_raw(
                "CREATE TABLE foo (col1 int, col2 string, col3 string)"
            )
            .unwrap()
            .1,
            expected
        )
    }
}
```

I will skip out on including the parsing for select/insert, but the vibes are similar.

### Pulling it all together

Now that we can parse each of our commands we need to tell nom to try each of them. We can do that with the [alt combinator](https://docs.rs/nom/latest/nom/branch/fn.alt.html) to try each parser and see which one succeeds.

```rust
/// All possible commands
#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub enum SqlQuery {
    Select(SelectStatement),
    Insert(InsertStatement),
    Create(CreateStatement),
}

impl<'a> Parse<'a> for SqlQuery {
    fn parse(input: RawSpan<'a>) -> ParseResult<'a, Self> {
        let (rest, (query, _, _, _)) = context(
            "Query",
            preceded(
                multispace0,
                tuple((
                    alt((
                        // this feels ripe for a derive macro but another time....
                        map(SelectStatement::parse, SqlQuery::Select),
                        map(InsertStatement::parse, SqlQuery::Insert),
                        map(CreateStatement::parse, SqlQuery::Create),
                    )),
                    multispace0,
                    char(';'),
                    multispace0,
                )),
            ),
        )(input)?;

        Ok((rest, query))
    }
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_error() {
        let query = SqlQuery::parse_from_raw("select fart;");
        assert!(query.is_err(), "expected parse to fail, got {query:?}");
    }

    #[test]
    fn test_select() {
        let expected = SelectStatement {
            tables: vec!["t1".to_string(), "t2".to_string()],
            fields: vec!["foo".to_string(), "bar".to_string()],
        };
        assert_eq!(
            SqlQuery::parse_from_raw("select foo, bar from t1,t2;")
                .unwrap()
                .1,
            SqlQuery::Select(expected)
        )
    }
}
```

Now that we have command parsing we can add it to our REPL. First, we need to add our parser crate to our `Cargo.toml` in the REPL crate

```toml:sql_jr_repl/Cargo.toml
...
[dependencies]
...
sql_jr_parser = { path = "../sql_jr_parser" }
...
```

then update our main function

```rust:sql_jr_repl/main.rs
...
    match readline {
            Ok(line) => {
                match SqlQuery::parse_from_raw(line.as_ref()) {
                    Ok(q) => println!("{q:?}"),
                    Err(e) => eprintln!("{e:?}"),
                }
            }
```

Now we can finally type some stuff and have different things come back.

```
>> select col1 from foo;
(LocatedSpan { offset: 21, line: 1, fragment: "", extra: () }, Select(SelectStatement { tables: ["foo"], fields: ["col1"] }))
```

However, when we get an error we just get a debug out, gross... let's fix that.

### Parser Errors

Errors can be a giant rabbit hole to keep improving. For now, as long as we show a span in the source tree and highlight the sad spots I'll be happy.

I will be using [miette](https://github.com/zkat/miette) to format/display errors. It can hook into source errors very easily and can show help, context, and much more.

Our error types will look like

```rust
use miette::Diagnostic;
use nom_supreme::error::{BaseErrorKind, ErrorTree, GenericErrorTree, StackContext};
use thiserror::Error;

#[derive(Error, Debug, Diagnostic)]
#[error("Parse Error")]
pub struct FormattedError<'b> {
    // need 'b since Diagnostic derive uses 'a
    #[source_code]
    src: &'b str,

    #[label("{kind}")]
    span: miette::SourceSpan,

    // will explain this later. TLDR: the parsing error
    kind: BaseErrorKind<&'b str, Box<dyn std::error::Error + Send + Sync + 'static>>,

    #[related]
    others: Vec<FormattedErrorContext<'b>>,
}

#[derive(Error, Debug, Diagnostic)]
#[error("Parse Error Context")]
pub struct FormattedErrorContext<'b> {
    #[source_code]
    src: &'b str,

    #[label("{context}")]
    span: miette::SourceSpan,

    context: StackContext<&'b str>,
}
```

These types can be used as normal rust error types without issue but when used in a miette `Reporter` we can get output like

```
>> select 1 fr

  × Parse Error
   ╭────
 1 │ select 1 fr
   ·          ▲
   ·          ╰── expected "from"
   ╰────

Error:
  × Parse Error Context
   ╭────
 1 │ select 1 fr
   · ▲
   · ╰── in section "Select Statement"
   ╰────
Error:
  × Parse Error Context
   ╭────
 1 │ select 1 fr
   · ▲
   · ╰── in section "Query"
   ╰────
```

The main magic here is the `#[source_code]` macro marking what the passed string was and

```rust
#[label("{kind}")]
span: miette::SourceSpan,

kind: BaseErrorKind<&'b str, Box<dyn std::error::Error + Send + Sync + 'static>>,
```

which tells miette to mark the provided span (the location in the source code) with the error display from `kind`.

Here we use the [error tree](https://docs.rs/nom-supreme/latest/nom_supreme/error/type.ErrorTree.html) type to specify the parsing error.

The error tree type will make it easier to handle errors on "alts" (like our root type). If you tried to parse `select +!@#!@!!`
nom would fail in the select parser but still try the other ones, so it would not know what parser errors to show.
That issue can be fixed slightly with [cut](https://docs.rs/nom/latest/nom/combinator/fn.cut.html) to not try other branches in the alt if we know for sure we are in a select/insert/create/etc.

However, cases like parsing `I like rust` are tough, all the parsers would fail without being cut, so what can we show? Ideally, we would say something like `expected select|create|insert, got ....` which the error tree type will help with (though not now).

To get these errors we first need to update `ParseResult` to use the error tree type as its error type.

```rust
// Alias for later
pub type MyParseError<'a> = ErrorTree<RawSpan<'a>>;

pub type ParseResult<'a, T> = IResult<RawSpan<'a>, T, MyParseError>;
```

The beauty of nom is we don't need to update any code in our existing parsers to change the error type, they were all generic over it.

Now we need to convert the error tree error into our miette error type

```rust
pub fn format_parse_error<'a>(input: &'a str, e: MyParseError<'a>) -> FormattedError<'a> {
    match e {
        // a "normal" error like unexpected charcter
        GenericErrorTree::Base { location, kind } => {
            // the location type is nom_locate's RawSpan type
            // Might be nice to just use our own span/make a wrapper to implement
            // From<OurSpan> for miette::SourceSpan
            let offset = location.location_offset().into();
            FormattedError {
                src: input,
                span: miette::SourceSpan::new(offset, 0.into()),
                kind,
                others: Vec::new(),
            }
        }
        // an error that has a context attached (from nom's context function)
        GenericErrorTree::Stack { base, contexts } => {
            let mut base = format_parse_error(input, *base);
            let mut contexts: Vec<FormattedErrorContext> = contexts
                .into_iter()
                .map(|(location, context)| {
                    let offset = location.location_offset().into();
                    FormattedErrorContext {
                        src: input,
                        span: miette::SourceSpan::new(offset, 0.into()),
                        context,
                    }
                })
                .collect();
            base.others.append(&mut contexts);
            base
        }
        // an error from an "alt"
        GenericErrorTree::Alt(alt_errors) => {
            // get the error with the most context
            // since that parsed the most stuff
            // TODO: figure out what to do on ties
            alt_errors
                .into_iter()
                .map(|e| format_parse_error(input, e))
                .max_by_key(|formatted| formatted.others.len())
                .unwrap()
        }
    }
}
```

Now to make it easy to get this formatted error add the following to our `Parser` trait

```rust
fn parse_format_error(i: &'a str) -> Result<Self, FormattedError<'a>> {
        let input = LocatedSpan::new(i);
        match all_consuming(Self::parse)(input).finish() {
            Ok((_, query)) => Ok(query),
            Err(e) => Err(format_parse_error(i, e)),
        }
    }
```

Now we can finally update our REPL with

```toml:sql_jr_repl/Cargo.toml
...
[dependencies]
# use the workspace version of miette but also use the fancy feature
# to allow for display errors
miette = {workspace = true, features = ["fancy"]}
...
```

```rust
let query = parse_sql_query(line);
match SqlQuery::parse_format_error(line.as_ref()) {
    Ok(q) => println!("{q:?}"),
    Err(e) => {
        let mut s = String::new();
        GraphicalReportHandler::new()
            .render_report(&mut s, &e)
            .unwrap();
        println!("{s}");
    },
}
```

and we finally have some sweet parsing errors.

## Part 1 wrap up

I definitely went overkill (but still feels like not enough...) on getting the parser errors to work nicely,
but our eventual 0 users will appreciate it.

Next post will focus on actually running queries (and addressing any feedback I get on this post).
