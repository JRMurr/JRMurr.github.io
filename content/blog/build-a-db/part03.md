---
title: Building a Simple DB in Rust - Part 3 - Less Basic Execution
seriesTitle: Part 3 - Less Basic Execution
slug: build-a-db/part03
date: 2023-04-04T00:01:55.249Z
tags: ['rust', 'database', 'repl']
draft: false
summary: Cleaning up existing execution logic
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />

# Where we left off

In the last post we ended up with extremely basic query execution. We could parse queries, update our tables in memory, and read full tables back;
all while having decent error messages throughout.

While that was a great milestone it leaves a lot to be desired

- While we parse columns in select queries, we never actually project/use them, so you always get all the columns back
- We aren't validating types on insert, so the column types mean nothing

So those main points are what I want to tackle for this post

<Note>
This post is much less of a tutorial/guide than the previous posts. I needed to cleanup what I have so the changes are pretty straightforward, small, and all over. Check the [repo](https://github.com/JRMurr/SQLJr) for more detailed changes.
</Note>

# Actually selecting columns

For a refresher, here's what the select response looks like

```rust
pub enum ExecResponse<'a> {
    Select(Vec<Row<'a>>),
    Insert,
    Create,
}

pub struct Row<'a> {
    id: usize,
    columns: Rc<ColumnInfo>,
    data: &'a HashMap<String, String>, // reference to the actual row in the table struct
}
```

So the select response is just a `Vec` over rows, each row holding info on the columns of the table and the data for that row.

There's a few things not great about this

- Why return a `Vec` when we could just return an iterator, the consumer is going to iterate over it anyway
- The select response does not return any column info outside of the rows, so empty results would not give any column info
- The data in the row is just a reference to the table, not horrible for `select *` but need to modify it to only hold the columns we care about
  - We probably will update this type over time to reduce space but for now we'll stick with a hash map

To address the first 2 issues, we can just return our existing `TableIter` struct, this is an iterator, and it holds column info

```rust
pub enum ExecResponse<'a> {
    Select(TableIter<'a>),
    Insert,
    Create,
}
```

## For real let's do a select

We didn't actually have a select function on `Table` before, so let's add one that's validates the columns we pass in actually exist

```rust:table.rs
#[derive(Debug, Clone, Default, Serialize, Deserialize, derive_more::From)]
pub struct ColumnInfo {
    columns: Vec<Column>,
}

impl ColumnInfo {
    pub fn iter(&self) -> impl Iterator<Item = &Column> {
        self.columns.iter()
    }

    pub fn find_column(&self, column_name: &String) -> Result<&Column, QueryExecutionError> {
        self.iter()
            .find(|col| col.name == *column_name)
            .ok_or_else(|| QueryExecutionError::ColumnDoesNotExist(column_name.to_owned()))
    }
}

// Also updated Table.columns to be `ColumnInfo` instead of Vec<Column>

impl Table {
    pub fn select(&self, columns: Vec<String>) -> Result<TableIter, QueryExecutionError> {
        let selected_columns = columns
            .into_iter()
            .map(|column_name| {
                self.columns
                    .find_column(&column_name)
                    .map(|col| col.clone())
            })
            .collect::<Result<Vec<_>, _>>()?;

        let col_info: Rc<ColumnInfo> = Rc::new(selected_columns.into());

        Ok(TableIter::new(self.rows.iter(), col_info))
    }
}
```

Since the select function validates all the columns exist, the iterator can avoid the same error checking like so

```rust:table.rs
impl<'a> Iterator for TableIter<'a> {
    type Item = Row<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        self.map_iter.next().map(|(id, data)| {
            let projected_data = data
                .data // the stored row hashmap
                .iter()
                .filter_map(|(key, value)| self.columns.find_column(key).ok().map(|_| (key, value)))
                .collect();

            Row::new(self.columns.clone(), *id, projected_data)
        })
    }
}
```

All the iterator does is go over the stored table's b-tree, for each row it filters the hash map of row data to only the columns we selected.

# Doing type checking

Right now we track column types when you create tables

```sql
CREATE TABLE foo (
    col1 int,
    col2 string
);
```

but we can just throw anything in there

```sql
INSERT INTO foo
    VALUES
        thisIsNotAnInt, 3
```

to have proper type checking we first need to update the insert statement to be type aware (instead of having every value be strings).

So let's make a SQL value type

```rust:parser/value.rs
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Display)]
pub enum Value {
    Number(BigDecimal),
    String(String),
}
```

Here we just make an enum of what types/values we support in our SQL language. Here I decided to have one number representation with `BigDecimal`
instead of having `Int`/`Float` types. Eventually I will, I'm just getting the basics in.

Now we need to parse these values

```rust:parser/value.rs
/// Parse a single quoted string value
fn parse_string_value(input: RawSpan<'_>) -> ParseResult<'_, Value> {
    // TODO: look into https://github.com/rust-bakery/nom/blob/main/examples/string.rs
    // for escaped strings
    let (remaining, (_, str_value, _)) = context(
        "String Literal",
        tuple((
            tag("'"),
            take_until("'").map(|s: RawSpan| Value::String(s.fragment().to_string())),
            tag("'"), // take_until does not consume the ending quote
        )),
    )(input)?;

    Ok((remaining, str_value))
}

/// Parse a numeric literal
fn parse_number_value(input: RawSpan<'_>) -> ParseResult<'_, Value> {
    let (remaining, digits) =
        context("Number Literal", take_while(|c: char| c.is_numeric()))(input)?; // TODO: handle floats

    let digits = digits.fragment();

    Ok((
        remaining,
        Value::Number(BigDecimal::from_str(digits).unwrap()),
    ))
}

impl<'a> Parse<'a> for Value {
    fn parse(input: RawSpan<'a>) -> ParseResult<'a, Self> {
        context(
            "Value",
            preceded(
                multispace0,
                terminated(
                    // peek_then_cut will give better errors so if we see
                    // a quote we knows to only try to parse a string
                    alt((peek_then_cut("'", parse_string_value), parse_number_value)),
                    multispace0,
                ),
            ),
        )(input)
    }
}
```

The parsing logic is mostly straightforward, the main weirdness you might be confused by is why the calls to `.fragment()`? That is because the input to the parse functions is a `RawSpan`, you need to call `fragment()` to get the actual string from the span.

Now when we wants strings we will need to quote them like `"aString"`

Now that we have this value type, we need to replace all our string values with this new type. This change was sorta all over, if you want a good diff this [commit](https://github.com/JRMurr/SQLJr/commit/55d66244a573a371983d75534b99577035ead478#diff-01c60d528deeaabdcb2502648bce756b7aa879d131d966016939ca85de7a039c) has the needed changes for that. This is still probably a little wasteful representation, but it starts us on the path to better types and performance.

We can now check the value on insert and see if it lines up with the given column's data type

```rust:table.rs
impl Table {
    pub fn insert(&mut self, values: Vec<Value>) -> Result<(), QueryExecutionError> {
        let id = self
            .rows
            .last_key_value()
            .map_or(0, |(max_id, _)| max_id + 1);

        let row = values
            .into_iter()
            .zip(self.columns.iter())
            .map(|(value, col)| match (col.type_info, value) {
                (SqlTypeInfo::String, v @ Value::String(_)) => Ok((col.name.to_owned(), v)),
                (SqlTypeInfo::Int, v @ Value::Number(_)) => Ok((col.name.to_owned(), v)), // TODO: when we add floats make sure number is an int
                (_,v) => Err(QueryExecutionError::InsertTypeMismatch(col.type_info, v)),
            })
            .collect::<Result<HashMap<_, _>,_>>()?;

        self.rows.insert(id, row.into());
        Ok(())
    }
}
```

Here it's pretty basic, we match on the tuple of column type and value, if the value and type match up we allow the insert, otherwise error with a type mismatch.
Later on we could add some logic for implicit conversions for things like converting `int`s to `float`s but for now we are going to be strict.

So now we can run

```sql
CREATE TABLE sad (
    col1 int,
    col2 string
);

INSERT INTO sad
    VALUES
        1, 2;
```

and get back

```
 × Value 2 can not be inserted into a String column
```

For the happy path

```sql
CREATE TABLE foo (
    col1 int,
    col2 string
);

INSERT INTO foo
    VALUES
        1, 'aString';

INSERT INTO foo
    VALUES
        4, 'aDiffString with spaces';

SELECT
    col1,
    col2
FROM
    foo;
```

will return

```
+------+-------------------------+
| col1 | col2                    |
+------+-------------------------+
| 1    | aString                 |
+------+-------------------------+
| 4    | aDiffString with spaces |
+------+-------------------------+
```

## Wrap up

This is definitely getting to the point in every personal project where the initial burst of interest starts to wane.
While I would love to focus on more "sexy" features like where clauses, joins, and saving the DB to disk;
I really needed to clean up what I had.

I do plan on focusing on some other side projects for now (and may write some posts on them), but I do plan on focusing more on the DB soon.

If you really want some more I would highly recommend trying this yourself! As you can probably tell from reading this posts, I'm far from a DB expert. Just start somewhere, you would be impressed with how much you can accomplish already and how much you will learn as you go!
