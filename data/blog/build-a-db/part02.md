---
title: Building a Simple DB in Rust - Part 2 - Basic Execution
seriesTitle: Part 2 - Basic Execution
date: 2023-01-23T14:01:22.231Z
tags: ['rust', 'database']
draft: false
summary: Building a basic database in rust
images: []
layout: PostLayout
---

<TOCInline toc={props.toc} asDisclosure />

# Feedback from part 1

I got some very nice feedback from the [first part of this series](/blog/build-a-db/part01). The main suggestions were to use some different parsing libraries like [chumsky](https://docs.rs/chumsky/latest/chumsky/) or use an existing SQL parser like [sqlparser-rs](https://github.com/sqlparser-rs/sqlparser-rs).

`chumsky` looks like it handles a lot of the error handling logic I had to do myself while still being defined in rust (no extra language). If I had known of this before I would have used it. Might switch to it later on if our grammar gets more involved. Thanks [@hjvt@hachyderm.io](https://hachyderm.io/@hjvt/109620348134117972) for the recommendation!

`sqlparser-rs` on the other hand looks very well maintained and handles many existing SQL dialects. If this was not a toy project I would have probably started off with this to get going faster without writing any parser logic.

Enough feedback, let's get into actually running queries.

# Execution

To get started on execution let's make a new crate for it with `cargo new sql_jr_execution`. We will need the parser crate for our types we made and some other workspace dependencies.

```toml:sql_jr_execution/Cargo.toml
[package]
name = "sql_jr_execution"
version = "0.1.0"
edition = "2021"

[dependencies]
miette = {workspace = true}
serde = {workspace = true}
sql_jr_parser = { path = "../sql_jr_parser" }
thiserror = {workspace = true}
```

Since we will need to operate on tables, let's start by defining our table type. For now, we will only deal with in memory execution. Soon enough we can handle reading from disk.

```rust:table.rs
use std::collections::{BTreeMap, HashMap};

use serde::{Deserialize, Serialize};
use sql_jr_parser::Column; // See part 1 for this type def. Just column name and sql data type (string or int)


// NOTE: For now just a mapping of col name => data as a str. Will change later
/// A row stored in a table
type StoredRow = HashMap<String, String>;

/// List of column info
type ColumnInfo = Vec<Column>;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(crate) struct Table {
    /// row id to row
    rows: BTreeMap<usize, StoredRow>,

    /// Column info for all columns in the table
    columns: ColumnInfo,
}
```

The `Table` struct is basically just a wrapper around Rust's [Btree](https://doc.rust-lang.org/stable/std/collections/struct.BTreeMap.html#) with some extra column info.

### What is a B-Tree?

A [B-Tree](https://en.wikipedia.org/wiki/B-tree) is a generalized Binary Search Tree (BST). BSTs are great in theory but in practice, they kinda suck for cache locality, nodes only store 1 piece of data, have the potential to be unbalanced, and require a heap allocation for each insertion. In "current year" CPUs are insanely fast, so we need data structures that are better for reducing memory access.

_insert rant about why data oriented design is GOATED here_.

Alexis Beingessner in [Rust Collections Case Study: BTreeMap](https://cglab.ca/~abeinges/blah/rust-btree-case/#what's-a-b-tree?-why's-a-b-tree?) described B-Trees as

> B-Trees take the idea of a BST, and say "lets put some arrays in there; computers love arrays". Rather than each node consisting of a single element with two children, B-Tree nodes have an array of elements with an array of children

I won't go into too much detail on B-Tree implementation, since I'm just using rust's built-in for now. If you're interested here are some good resources on B-Trees.

- [Rust Collections Case Study: BTreeMap](https://cglab.ca/~abeinges/blah/rust-btree-case)
- [Wikipedia](https://en.wikipedia.org/wiki/B-tree)
- [Open Data Structures](http://opendatastructures.org/ods-python/14_2_B_Trees.html)

With that said, let's walk through a basic example

![B-Tree example](https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg)

Here the internal node (the root) has 3 children. All keys $< 7$ are in the left child, keys $> 7$ and $<= 16$ are in the middle, and finally, keys $> 16$ are in the right child.

You can customize the $B$ constant to have nodes store more/fewer keys and have more/fewer children. The average Lookup for a B-tree with $N$ keys is $\mathcal{O}(\log{_2}N)$ which is the same for a BST.

### Why B-Tree?

As I mentioned before B-Trees are great for cache locality. Also, you can make each node the size of a memory/disk block. This way you can minimize reads by chunking up the data more efficiently.

## Actually do stuff

Nerd stuff aside, let's add actual logic for our table

```rust
impl Table {

    // Create a table with the given column definitions
    pub fn new(columns: Vec<Column>) -> Self {
        Self {
            rows: BTreeMap::new(),
            columns,
        }
    }

    /// Insert values (a row) into the table
    ///
    /// assumes the values are in the same order of the columns passed to create
    pub fn insert(&mut self, values: Vec<String>) {
        let id = self
            .rows
            .last_key_value()
            .map_or(0, |(max_id, _)| max_id + 1);

        let row: StoredRow = values
            .into_iter()
            .zip(self.columns.iter())
            .map(|(v, col)| (col.name.to_owned(), v))
            .collect();

        self.rows.insert(id, row);
    }
}
```

Here we create a table with the given column definitions (from the create table sql command). For insert, we get an ID for the new row which is just an ID sequence starting at 0 for the first row. We then insert the values into the B-TreeMap with that ID as the key and the row's values as a hash map of the column name to a string of the value to insert.

Those two functions can handle creating tables (mostly) and inserting data, but how should we handle select? A simple first step is to re-use the [Iterator](https://doc.rust-lang.org/std/iter/trait.Iterator.html) on [BTreeMap](https://doc.rust-lang.org/std/collections/struct.BTreeMap.html#method.iter).

```rust
impl Table {
    pub fn iter(&self) -> std::collections::btree_map::Iter<usize, Row> {
        self.rows.iter()
    }
}
```

This will give us an `Iterator` over `(row_id, row_values)`.

Re-using the iterator from BTreeMap is fine, but I like how many Rust DB libraries have a `Row` trait/struct that gives you extra information. For example, [SQLX](https://github.com/launchbadge/sqlx) has a [Row trait](https://docs.rs/sqlx/latest/sqlx/trait.Row.html) that lets you get column info back for the query you ran, safe/unsafe conversions into rust types, and a few other helpers. So let's make our `Row` struct and iterator, so we can add these features later on.

```rust
use std::{collections::HashMap, rc::Rc};

use crate::table::ColumnInfo; // Vec<Column>

/// A Row in a Query response
#[derive(Debug, Clone)]
pub struct Row<'a> {
    id: usize,
    columns: Rc<ColumnInfo>,
    data: &'a HashMap<String, String>,
}
```

Here I made the decision that this `Row` struct will not own the data it's showing. Therefore, it needs a reference to the data stored in the table. I also want to have the row have access to the `ColumnInfo` from the table. Since every row will be holding a reference to the same `ColumnInfo`, I went with an [RC](https://doc.rust-lang.org/std/rc/index.html) to avoid extra lifetime parameters on the row struct.

Now we can implement `Iterator` for the table. We can just wrap the existing `Iterator` from `BTreeMap` and transform each response into our `Row` struct.

```rust
/// Iterator of [`Row`]s from a table
pub(crate) struct TableIter<'a> {
    /// Underlying iterator over the btree_map
    map_iter: std::collections::btree_map::Iter<'a, usize, StoredRow>,
    /// The columns of the [`Table`]
    columns: Rc<ColumnInfo>,
}

impl<'a> TableIter<'a> {
    pub fn new(
        map_iter: std::collections::btree_map::Iter<'a, usize, StoredRow>,
        columns: Rc<ColumnInfo>,
    ) -> Self {
        Self { map_iter, columns }
    }
}

impl<'a> Iterator for TableIter<'a> {
    type Item = Row<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        self.map_iter
            .next()
            .map(|(id, data)| Row::new(self.columns.clone(), id.clone(), data))
    }
```

Now we can implement the [IntoIterator trait](https://doc.rust-lang.org/std/iter/trait.IntoIterator.html) on `Table` for easy conversion into an iterator.

```rust
impl<'a> IntoIterator for &'a Table {
    type Item = Row<'a>;

    type IntoIter = TableIter<'a>;

    fn into_iter(self) -> Self::IntoIter {
        let col_info = Rc::new(self.columns.clone());

        TableIter::new(self.rows.iter(), col_info)
    }
}
```

now the `iter` method (not necessarily needed) on table can just call the trait method

```rust
impl Table {
  pub fn iter(&self) -> impl Iterator<Item = Row> {
        self.into_iter()
    }
}
```

## Handling SQL Queries

Now that we have a `Table` struct we need to hook up the parsed commands to create, insert, and read from tables.

First we should define the response type for an execution

```rust
use derive_more::Display;

#[derive(Debug, Display)]
pub enum ExecResponse<'a> {
    #[display(fmt = "{_0:?}")] // only show the values not "Select(...)"
    Select(Vec<Row<'a>>),
    Insert,
    Create,
}
```

Here I use the [derive_more](https://docs.rs/derive_more/latest/derive_more/) crate's Display derive macro to avoid writing my own implementation of Display. If you're a real one who's been paying attention, you may have noticed that we did not implement `Display` on `Row` but the `Display` derive still compiles, this is due to us adding `#[display(fmt = "{_0:?}")]` to use the debug format of `Vec<Row>` as the `Display` format. While we won't use it much for select display (more on that later), for the other response cases It's nice to have.

We also should make our own Error type for Query Execution

```rust
use miette::Diagnostic;
use thiserror::Error;

/// Errors during query execution
#[derive(Error, Debug, Diagnostic)]
#[error("Query Execution Error")]
pub enum QueryExecutionError {
    #[error("Table {0} was not found")]
    TableNotFound(String),

    #[error("Table {0} already exists")]
    TableAlreadyExists(String),

    #[error("Column {0} does not exist")]
    ColumnDoesNotExist(String),
}
```

Like in [part1](/blog/build-a-db/part01), we still are using [miette](https://docs.rs/miette/latest/miette/)/[thiserror](https://docs.rs/thiserror/latest/thiserror/) for better looking errors.

Now we can finally actually run some queries. For a quick refresher on the `SqlQuery` type, see [the source code](https://github.com/JRMurr/SQLJr/blob/5324c38bc74cb77d2daf035a0f3d1da3fc7b4c3b/crates/sql_jr_parser/src/ast.rs#L19)

```rust
#[derive(Debug, Default)]
pub struct Execution {
    tables: HashMap<String, Table>,
}

impl Execution {
    pub fn new() -> Self {
        Self {
            tables: HashMap::new(),
        }
    }

    pub fn run(&mut self, query: SqlQuery) -> Result<ExecResponse, QueryExecutionError> {
        match query {
            SqlQuery::Select(mut select) => {
                let table = select.table; // the table name
                let table = self
                    .tables
                    .get(&table)
                    .ok_or(QueryExecutionError::TableNotFound(table))?;
                // not projecting to the selected columns yet
                let rows = table.iter().collect();
                Ok(ExecResponse::Select(rows)))
            }
            SqlQuery::Insert(insert) => {
                let Some(table) = self.tables.get_mut(&insert.table) else {
                    return Err(QueryExecutionError::TableNotFound(insert.table))
                };

                table.insert(insert.values);
                Ok(ExecResponse::Insert)
            }
            SqlQuery::Create(create) => {
                let table = Table::new(create.columns);

                self.tables.insert(create.table, table);
                Ok(ExecResponse::Create)
            }
        }
    }
}
```

Since we handled most of the logic in the `Table`/`Row` structs, the actual execution is mostly just wrapper around the `HashMap` of tables with some basic error handling.

## Bringing it all together

With the `Execution` struct we can handle the parsed commands from our parser but right now we don't have it all hooked up.
We need to unify the parser and execution into one.

Ideally, we would have some new crate for the full "pipeline" from parsing to execution (and probably more steps we will add later), but for now having this logic in the `Execution` crate feels fine.

First, step is to combine the Error types from Parsing and Execution

```rust
use miette::Diagnostic;
use sql_jr_parser::error::FormattedError;
use thiserror::Error;

/// Errors at any point in the SQL "pipeline"
#[derive(Error, Debug, Diagnostic)]
#[error(transparent)]
pub enum SQLError<'a> {
    #[diagnostic(transparent)]
    QueryExecutionError(#[from] QueryExecutionError),

    #[diagnostic(transparent)]
    ParsingError(FormattedError<'a>),
}

// need a manual impl since the error #[from] seems sad on lifetimes
impl<'a> From<FormattedError<'a>> for SQLError<'a> {
    fn from(value: FormattedError<'a>) -> Self {
        SQLError::ParsingError(value)
    }
}
```

Here `#[diagnostic(transparent)]` is similar to `#[error(transparent)]` in `thiserror`, it lets you wrap other errors but still call their `Display` trait when the error is shown.

Now we can have a function that parses and executes the query

```rust
impl Execution {
   pub fn parse_and_run<'a>(&mut self, query: &'a str) -> Result<ExecResponse, SQLError<'a>> {
        let query = parse_sql_query(query)?;

        let res = self.run(query)?;
        Ok(res)
    }
}
```

Which lets our REPL now look like

```rust
fn main() {
  ...
  let mut exec = sql_jr_execution::Execution::new();
  loop {
        let readline = rl.readline(">> ");
        match readline {
          Ok(line) => {
                rl.add_history_entry(line.as_str());
                let line: &str = line.as_ref();
                let res = exec.parse_and_run(line);
                match res {
                    Ok(exec_res) => println!("{exec_res}"),
                    Err(e) => {
                        let mut s = String::new();
                        GraphicalReportHandler::new()
                            .with_cause_chain()
                            .with_context_lines(10)
                            .render_report(&mut s, &e)
                            .unwrap();
                        println!("{s}");
                    }
                }
            }
          // other cases unchanged from part 1
        }
}
```

The happy path in our REPL now looks like

```
>> create table foo (col1 string, col2 string);
Create
>> insert into foo values a,b;
Insert
>> select col1,col2 from foo;
[Row { id: 0, columns: [Column { name: "col1", type_info: String }, Column { name: "col2", type_info: String }], data: {"col1": "a", "col2": "b"} }]
>>
```

## Better display for REPL

The REPL works, but the display for select queries is pretty gross. We can use the [tabled crate](https://github.com/zhiburt/tabled) to format the response as a table. We can run `cargo add tabled` in `crates/sql_jr_repl` to add the crate to the repl.

If you look at the docs for `tabled` many of the first examples involve the `#[derive(Tabled)]` macro on your structs/enums. This does not really work for select queries since the columns are dynamic. Tabled still supports this with the [builder](https://docs.rs/tabled/0.10.0/tabled/builder/struct.Builder.html) to allow us to set the rows + columns dynamically.

Let's add a new file to the REPL crate and handle display there

```rust:crates/sql_jr_repl/display.rs
pub fn display_response(res: ExecResponse) {
    match res {
        ExecResponse::Select(rows) => {
            let mut builder = Builder::default();

            // Get column info from the first row
            let row = rows.get(0).expect("For now assuming we get data back");

            let columns: Vec<String> = row
                .columns() // added helper, see below
                .iter()
                .map(|col| col.name.to_string())
                .collect();
            builder.set_columns(&columns);
            for row in rows.into_iter() {
                builder.add_record(columns.iter().map(|col| row.get(col))); // added a get helper, see below
            }
            println!("{}", builder.build())
        }
        _ => println!("{res}"),
    }
}
```

as noted in a comment I added these helpers to the row struct to make column lookup easier

```rust:crates/sql_jr_execution/row.rs
impl Row {
     pub fn columns(&self) -> &ColumnInfo {
        self.columns.as_ref()
    }

    /// Get a single value from the row
    ///
    /// # Panics
    ///
    /// Panics if the column does not exist
    /// See [`try_get`](Self::try_get) for a non-panicking
    /// version.
    pub fn get(&self, column: &String) -> String {
        self.try_get(column).unwrap()
    }

    /// Get a single value from the row
    pub fn try_get(&self, column: &String) -> Result<String, QueryExecutionError> {
        self.data.get(column).map_or_else(
            || Err(QueryExecutionError::ColumnDoesNotExist(column.to_owned())),
            |val| Ok(val.to_string()),
        )
    }
}
```

now the REPL from the example above would show

```
>> select col1,col2 from foo;
+------+------+
| col1 | col2 |
+------+------+
| a    | b    |
+------+------+
```

`tabled` has many [style options](https://github.com/zhiburt/tabled#style) if we wanted to tweak the look, but this is fine for now.

You probably noticed the line

```rust
//Get column info from the first row
let row = rows.get(0).expect("For now assuming we get data back");
```

in our display function. This obviously would get sad on empty responses. The best decision would be to add/move `ColumnInfo` into `ExecResponse::Select`, so we return something like

```
{columns: Rc<ColumnInfo>, row: Vec<Row>}
```

but I'll save that for the next post.

## Wrap up

Having basic execution feels nice, but the real challenge will be filtering and projecting the data. We have some extra clones and `unwraps`/`expects` we need to handle once we start moving away from this extremely simple happy path but so far the high level design feels good!
