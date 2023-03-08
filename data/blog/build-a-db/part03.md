---
title: Building a Simple DB in Rust - Part 3 - Less Basic Execution
seriesTitle: Part 3 - Less Basic Execution
date: 2023-03-08T04:28:29.986Z
tags: ['rust', 'database', 'repl']
draft: false
summary: Cleaning up existing execution logic
images: []
layout: PostLayout
---

<TOCInline toc={props.toc} asDisclosure />

# Where we left off

In the last post we ended up with extremely basic query execution. We could parse queries, update our tables in memory, and read full tables back;
all while having decent error messages throughout.

While that was a great milestone it leaves a lot to be desired

- While we parse select with selecting queries, we never actually project, so you always get all the columns back
- We aren't validating value types on insert, so the column types mean nothing
- The database is all in memory so restarting loses all data (but its super secure...)

So those main points are what I want to tackle for this post

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
