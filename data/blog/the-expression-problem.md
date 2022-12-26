---
title: The Expression Problem
date: 2022-12-18T20:37:43.232Z
tags: ['functional', 'type classes', 'traits', 'rust', 'typescript']
draft: false
summary: Exploring my Favorite solutition to the expression problem
images: []
layout: PostLayout
---

<TOCInline toc={props.toc} asDisclosure />

For years I could never articulate why certain language features/desgin patterns felt good or bad to me.
I always heard "OOP bad, Functional good" and agreed with it ever since using Ocaml in a compilers class in school.
When people would ask why I liked functional style I would usally say something like "The type systems are really good" or "Pattern matching is awesome" but those answers always felt like they were missing something since they were so surface level. Many non functional languages have good type systems. Pattern matching is being added to many lanaguages.

However, when reading [Crafting Interpreters](https://craftinginterpreters.com/) the problem of needing to add many different operations on expressions was [disscued](https://craftinginterpreters.com/representing-code.html#working-with-trees). The "fundemental problem" is there is not a "simple" way to define language expressions such that is easy to add a new expression type and easy to add a new operation on those expressions. This problem is called the [Expression problem](https://en.wikipedia.org/wiki/Expression_problem)

## The Problem

To me different ways of handling the Expression problem is a major factor in what makes me love/hate certain lanaguges/desgin patterns.
In OOP you can add on a new class and just implement all required interfaces and it should mostly just work. However, if you need to make a new interface for all classes, have fun updating all your classes. In functional programming you mostly likely have some kind of algerbraic data type (ADT) with many variants. Adding new functions is easy, just write the function that handles each case. However, adding a new variant to the ADT will require you to update all your functions.

Theres no way around this problem in all cases. What ever you pick will have downsides.

## The "No Solution" Solution

Personally I just like the functional approach to this argument. If you add some new variant to a type, your ide/compiler is gonna yell at you with all the spots to update. It obviously can take a while to fix but I find joy is slowly lowering the error count until the red lines go away.

In the OOP world with heavy relelience on inhertance it has potential to have less compile time errors and more run time gotchas. "You extended this class but forgot you need to ovveride this method" has bit me many a time.

Though im a biased nerd so take my opinion with a grain of salt.

## A Solution

Now I've said I liked functional style so how would a functional lang solve it? I will use rust since it has a lot of functional ideas and in this case I think traits are my favorite way to express this idea.

<Note className="text-sm">The following examples were taken from https://eli.thegreenplace.net/2018/more-thoughts-on-the-expression-problem-in-haskell/ and translated to rust</Note>

First some code without traits

```rust
enum Expr {
    Literal(usize),
    Add(Box<Expr>, Box<Expr>),
}

impl Expr {
    fn stringIfy(&self) -> String {
        match &self {
            Expr::Literal(lit) => lit.to_string(),
            Expr::Add(lhs, rhs) => {
                let lhs = lhs.stringIfy();
                let rhs = rhs.stringIfy();
                format!("{} + {}", lhs, rhs)
            }
        }
    }

    fn eval(&self) -> usize {
        match &self {
            Expr::Literal(lit) => lit.to_owned(),
            Expr::Add(lhs, rhs) => {
                let lhs = lhs.eval();
                let rhs = rhs.eval();
                lhs + rhs
            }
        }
    }
}
```

Now this code works but think about adding new stuff to it. Adding a new function would not require a change to any existing logic. Just add a new `fn` in the `impl` and you're good. However if we wanted to add a new variant to the expression enum (maybe multiply) we would need to update both the stringify and eval functions.

Using traits we could do

```rust
trait ExprTrait: Eval {} // Eval defined below. We add all our "function" traits to the bounds here

struct Literal(usize);
struct Add<Left, Right>(Box<Left>, Box<Right>);

impl ExprTrait for Literal {}
impl<Left: ExprTrait, Right: ExprTrait> ExprTrait for Add<Left, Right> {}

trait Eval {
    fn eval(&self) -> usize;
}

impl Eval for Literal {
    fn eval(&self) -> usize {
        self.0
    }
}

impl<Left: Eval, Right: Eval> Eval for Add<Left, Right> {
    fn eval(&self) -> usize {
        let lhs = self.0.eval();
        let rhs = self.1.eval();
        lhs + rhs
    }
}

fn main() {
    let res = Add(
        Box::new(Literal(10)),
        Box::new(Add(Box::new(Literal(1)), Box::new(Literal(2)))),
    )
    .eval();
    println!("{}", res) // prints 13
}
```

So you might be thinking "WTF I thought traits were supposed to make the code more maintable not add more generic nerd stuff" and you're not wrong. So what did this buy us? If we wanted to add a new function on expressions we can do the following

```rust
trait ExprTrait: Eval + Stringify {} // update the ExprTrait def from above

trait Stringify {
    fn stringify(&self) -> String;
}

impl Stringify for Literal {
    fn stringify(&self) -> String {
        self.0.to_string()
    }
}

impl<Left: Stringify, Right: Stringify> Stringify for Add<Left, Right> {
    fn stringify(&self) -> String {
        let lhs = self.0.stringify();
        let rhs = self.1.stringify();
        format!("{} + {}", lhs, rhs)
    }
}
```

Its a little bit more code than before but not too much more so its about as easy as before. The difference is now to add a new expression type we only need to add new code, not touch existing.

```rust
struct Mul<Left, Right>(Box<Left>, Box<Right>);

impl<Left: ExprTrait, Right: ExprTrait> ExprTrait for Mul<Left, Right> {}
impl<Left: Eval, Right: Eval> Eval for Mul<Left, Right> {
    fn eval(&self) -> usize {
        let lhs = self.0.eval();
        let rhs = self.1.eval();
        lhs * rhs
    }
}
// ommited the impl for stringify but not hard to imagine what it looks like...
```

## The downsides of traits

One thing we lost in the switch to using a trait to organize all the different ways of using/defining an expression is we lost a concrete expression type. For example lets say we have a parser to get an expression. What would its return type be? `Literal`? `Add<Literal, ..>`? You might say well [impl trait](https://doc.rust-lang.org/rust-by-example/trait/impl_trait.html#as-a-return-type) is a valid return type but trying that would cause issues

```rust
fn parse_expr(is_add: bool) -> impl ExprTrait {
    // imagine this was an actual parser that would return different expressions
    if is_add {
        Add(
            Box::new(Literal(10)),
            Box::new(Mul(Box::new(Literal(8)), Box::new(Literal(2)))),
        )
    } else {
        Literal(123)
    }
}
```

This will cause the following compiler error

```
error[E0308]: `if` and `else` have incompatible types
   --> src/main.rs:101:9
    |
95  |  /     if is_add {
96  |  |         Add(
    |  |_________-
97  | ||             Box::new(Literal(10)),
98  | ||             Box::new(Mul(Box::new(Literal(8)), Box::new(Literal(2)))),
99  | ||         )
    | ||_________- expected because of this
100 |  |     } else {
101 |  |         Literal(123)
    |  |         ^^^^^^^^^^^^ expected struct `Add`, found struct `Literal`
102 |  |     }
    |  |_____- `if` and `else` have incompatible types
    |
    = note: expected struct `Add<Literal, Mul<Literal, Literal>>`
               found struct `Literal`
```

The issue we have is returning an `impl trait` is the compiler must still statically know what the single return type is so it can allocate enough space. However rust does have a way around this, the compiler error above also includes

```
help: you could change the return type to be a boxed trait object
    |
93  | fn parse_expr(is_add: bool) -> Box<dyn ExprTrait> {
    |                                ~~~~~~~          +
help: if you change the return type to expect trait objects, box the returned expressions
    |
96  ~         Box::new(Add(
97  |             Box::new(Literal(10)),
98  |             Box::new(Mul(Box::new(Literal(8)), Box::new(Literal(2)))),
99  ~         ))
100 |     } else {
101 ~         Box::new(Literal(123))
    |
```

The [dyn](https://doc.rust-lang.org/std/keyword.dyn.html) keyword will make the compiler return a trait object insead of a concerte type. While this allows you to wrtie more dynamic code it also makes rust do dyanmic dispatch instead of inlining/monomorphising your code. This is actua

However since rust has amazing macros we can workaround this slightly with [enum dispatch](https://docs.rs/enum_dispatch/latest/enum_dispatch/#)

### Enum Dispatch

## My links

- https://eli.thegreenplace.net/2018/more-thoughts-on-the-expression-problem-in-haskell/
- https://en.wikipedia.org/wiki/Expression_problem
- https://craftinginterpreters.com/representing-code.html#working-with-trees
