---
title: Making a Chess Engine in Zig
date: 2024-07-28T15:23:42.275Z
tags: ["zig","chess","nix"]
draft: true
summary: Learning zig by making a chess engine
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />

I had the honor of speaking at Systems Distributed at the end of June.
Since it was hosted by TigerBeetle who is one of the largest zig users, a lot of the zig community was there.
After talking to some of them zig seemed more interesting for me to try out.

Around the same time my youtube algorithm got me hooked on chess content.
Im not a good chess player by any means but it started giving me the urge to make my own chess engine.
If I make a good chess engine that should obviously make me a better chess player...

So I decided to merge the two desires together and make my own engine in zig.

This post will be part describing how a chess engine works and part my thoughts on using zig to make it.
This won't really be a tutorial, more of a vibe, but hopefully you learn something!

If your lazy and just wanna read some code it lives [here](https://github.com/JRMurr/ZigFish)
I called it ZigFish since this will obviously match Stockfish in elo....

# How Does a Chess Engine Work?

At its core a chess engine needs to do 3 things
- Know all the rules of chess
- Quickly explore the space of all moves
- Evaluate a position to figure out what moves are good/bad

It needs to do all of those things FAST, chess generally has a move time limit so you don't have infinite time to figure out what move to play.


## Implementing Chess

So the first thing I did was implement all of the chess rules so the engine would be a good boi and play only legal moves.
We can't have it play like [chatgpt where a rook can fly diagonally across the board...](https://youtu.be/rSCNW1OCk_M?si=zjoIu-h-njEsIiYF&t=591)


### A Gui

Before I even started the logic I wanted to have a nice gui to play with, so I found this [zig raylib binding](https://github.com/Not-Nik/raylib-zig).
This way I have something pretty to look at while developing.

This was my first interaction with zig's build system/package management. To add this dependency you can run
```shell
  zig fetch --save https://github.com/Not-Nik/raylib-zig/archive/{commit-sha}.tar.gz
```

This will add the tar ball with its hash to `build.zig.zon` with something like
```zig
 .dependencies = .{
        .@"raylib-zig" = .{
            .url = "https://github.com/Not-Nik/raylib-zig/archive/2d8e856009bf0ee60ef78bde78e32512bdaae714.tar.gz",
            .hash = "1220d32c92222ded6912529bbd502b2e0c5c5c2056c4b709ad0f6924d6524343a2d2",
        },
        // <other deps>
 }
```
So a normal lock format but doesn't rely on any centralized package repo like npm or cargo.

Then you need to tell zig to link in the dep, since raylib is a C dep, zig can actually compile it for you

The `build.zig` file makes a dag for all the different build steps and artifacts. So I can add

```zig
const raylib_dep = b.dependency("raylib-zig", .{
    .target = target,
    .optimize = optimize,
});

const raylib = raylib_dep.module("raylib"); // main raylib module
const raygui = raylib_dep.module("raygui"); // raygui module
const raylib_artifact = raylib_dep.artifact("raylib"); // raylib C library


// the gui executable
const exe = b.addExecutable(.{
    .name = "zigfish-gui",
    .root_source_file = b.path("src/main.zig"),
    .target = target,
    .optimize = optimize,
});

exe.linkLibrary(raylib_artifact);
exe.root_module.addImport("raylib", raylib);
exe.root_module.addImport("raygui", raygui);
```

Its easy to make the `build.zig` "script" a pile of spaghetti like any build system but at least since its all just zig code you can make it have nice abstractions.
I chose the spaghetti route since I'm not smart enough yet to make it nice but it still "just works"

I'll leave out the tedium but overall the process of getting some chess pieces drawn on the board, and some logic to move them around was pretty straightforward.
If your curious feel free to checkout my [spritemanager](https://github.com/JRMurr/ZigFish/blob/d061604cc2f634a19da4863724345a64b373652a/src/graphics/sprite.zig#L41).
Raylib is super simple to use, the simple things are simple. Since chess is just draw some rectangles and a few sprites, it didn't take long to have the board display good to go.

## The logic

So now that I have a chess board to draw, I need to implement all the rules of chess.
This is where the [Chess Programming Wiki](https://www.chessprogramming.org/Main_Page) became my best friend.
It has some many resources to help make your engine.

### Board Representation

The first main decision is how do you [represent the board](https://www.chessprogramming.org/Board_Representation).

The first approach I took was to make a struct like this
```zig
// NOTE: don't need to manually list the values for each enum tag
// I just like doing it...
pub const Color = enum(u1) {
    White = 0,
    Black = 1,
};

pub const Kind = enum(u3) {
    King = 0,
    Queen = 1,
    Bishop = 2,
    Knight = 3,
    Rook = 4,
    Pawn = 5,
};

pub const Piece = struct packed {
    color: Color,
    kind: Kind,
}
```

So a chess Piece is a color, and piece type/kind.

Then you could so something like

```zig
pub const Board = struct {
    squares: [64]?Piece
}
```

So the board is an array of 64 squares (8x8 board). The `?` means the elements of the array are null or a Piece.
Optional types in zig are great! Its just like the `Option` type in rust but more directly built into the language.


This array approach works and I used it for a while but has some downsides.
- You need to loop over the whole array a lot to find all the pieces you care about
- Sliding pieces like rooks, bishops, and queens require you to "walk" each direction which takes time (this will matter a lot doing move generation)
- Its not the cool option I'll explain in a second


#### Bit Boards

So after a little while using this array representation I switched to a [BitBoard](https://www.chessprogramming.org/Bitboards)

The core idea is, since there are 64 squares, you can use a `u64` where each bit represents 1 square. If the bit is set a piece is there.
You then have 6 `u64`s to track each piece type, and 2 more to track the color of those pieces. In my case I had a redundant 9th `u64` just for all occupied squares.

So if I want to know where all the White Pawns are I can do a bitwise intersection of the pawn bitset and the white bitset.

The other benefit is when you apply shifts/masks on the bitset, it will apply to all pieces at once.
For example to figure out all possible squares knights can move to you can do this
```zig
pub fn knightMoves(self: Self) Self {
    // https://www.chessprogramming.org/Knight_Pattern#Multiple_Knight_Attacks
    const mask = self.bit_set.mask;

    const l1 = (mask >> 1) & NOT_FILE_H;
    const l2 = (mask >> 2) & NOT_FILE_GH;
    const r1 = (mask << 1) & NOT_FILE_A;
    const r2 = (mask << 2) & NOT_FILE_AB;
    const h1 = l1 | r1;
    const h2 = l2 | r2;
    return Self.fromMask((h1 << 16) | (h1 >> 16) | (h2 << 8) | (h2 >> 8));
}
```
So a few bitwise operations handle all knights at the same time.
This speed is invaluable when figuring out all the squares the enemy pieces attack. 
This way we can prune moves that would put our own king in check.


Zig has a nice helper in the std lib [std.bit_set.IntegerBitSet](https://ziglang.org/documentation/master/std/#std.bit_set.IntegerBitSet).
This just wraps a unsigned int and has some nice helpers for set union, intersection, and iterating over the set bits.

I wrapped it in my own struct
```zig
pub const BoardBitSet = packed struct {
    const Self = @This();

    bit_set: BitSet,

    // a bunch of funcs...
}
```

So now my `Board` struct looks like

```zig
// Some compile time magic to get the number of tags in an enum
inline fn enumLen(comptime T: type) comptime_int {
    return @typeInfo(T).Enum.fields.len;
}
const NUM_KINDS = enumLen(Kind);
const NUM_COLOR = enumLen(Color);

pub const Board = struct {
    const Self = @This();
    kind_sets: [NUM_KINDS]BoardBitSet,
    color_sets: [NUM_COLOR]BoardBitSet,
    /// redundant set for easy check if a square is occupied
    occupied_set: BoardBitSet,

    active_color: Color = Color.White,


    pub fn getPieceSet(self: *const Self, p: Piece) BoardBitSet {
        const color = self.color_sets[@intFromEnum(p.color)];
        const kind = self.kind_sets[@intFromEnum(p.kind)];

        return color.intersectWith(kind);
    }
}
```

This is where I really started to love zig's comptime.
My `enumLen` helper can introspect the enum type I pass in to get how many possible enum tags there are.
I can then make an array of that size, then use `@intFromEnum` to lookup the index for each tag type in that array.

## Move Generation

Now that we have a board, we can start figuring out the moves.
While each piece's movement rules are pretty simple to humans, there are SO MANY EDGE CASES.

Things like
- En Passant
- Castling
- Pinned Pieces (a piece who is blocking an attack on the king)

Those situations on their own are not horrible, what really caused pain was combos of those situations like

{/* TODO: compile the engine with raylib to work on web and put it here.... */}
Like this position `4k3/8/8/KPp3r1/8/8/8/8 w - c6 0 2` // TODO: show
The black C pawn could technically be captured En Passant but that would reval the rook attack on the king..