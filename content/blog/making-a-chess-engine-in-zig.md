---
title: Making a Chess Engine in Zig
date: 2024-07-28T15:23:42.275Z
tags: ["zig","chess","nix"]
draft: false
summary: Learning zig by making a chess engine
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />


TODO:
- Explain eval more
  - update eval with isolated/passed pawn
  - update eval with better "phase" support opening vs endgame position scoring
- Search in a thread/cancellation
- Implement and explain using opening books
  - parsing done need to actually use
- Explain uci impl? (might be boring)
- Talk about chat gpt?
- Explain fen?
- nix build stuff for fastchess
- Iframe broken for lichess (its something with headers so might only matter locally)
- More uci so can run on lichess

I had the honor of [speaking at Systems Distributed](https://www.youtube.com/watch?v=whqMdAD5JTc) at the end of June.
Since it was hosted by TigerBeetle who is one of the largest zig users, a lot of the zig community was there.
After talking to some of them, zig seemed more interesting for me to try out.

Around the same time my youtube algorithm got me hooked on chess content.
Im not a good chess player by any means but it started giving me the urge to make my own chess engine.
If I make a good chess engine that should obviously make me a better chess player...

So I decided to merge the two desires together and make my own engine in zig.

This post will be part describing how a chess engine works and part my thoughts on using zig to make it.
This won't really be a tutorial, more of a vibe, but hopefully you learn something!

If your lazy and just wanna read some code it lives [here](https://github.com/JRMurr/ZigFish)
I called it ZigFish since this will obviously match Stockfish in elo....


<Chess/>
# How Does a Chess Engine Work?

At its core a chess engine needs to do 3 things
- Know all the rules of chess
- Quickly explore the space of all moves
- Evaluate a position to figure out what moves are good/bad

It needs to do all of those things FAST, chess generally has a move time limit so you don't have infinite time to figure out what move to play.


So the first thing I did was implement all of the chess rules so the engine would be a good boi and play only legal moves.
We can't have it play like [chatgpt where a rook can fly diagonally across the board...](https://youtu.be/rSCNW1OCk_M?si=zjoIu-h-njEsIiYF&t=591)


## A Gui

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
Raylib is super nice to use, the simple things are simple. Since chess is just draw some rectangles and a few sprites, it didn't take long to have the board display good to go.

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
- Sliding pieces like rooks, bishops, and queens require you to "walk" each direction which takes time (this will matter a lot during move generation)
- Its not the cool option I'll explain in a second


#### Bit Boards

So after a little while using this array representation I switched to a [BitBoard](https://www.chessprogramming.org/Bitboards)

The core idea is, since there are 64 squares, you can use a `u64` where each bit represents 1 square. If the bit is set a piece is there.
You then have 6 `u64`s to track each piece type, and 2 more to track the color of those pieces. In my case I had a redundant 9th `u64` just for all occupied squares.

So if I want to know where all the White Pawns are I can do a bitwise intersection of the pawn bitset and the white bitset.

The other benefit is when you apply shifts/masks on the bitset, it will apply to all pieces at once.
For example to figure out all possible squares knights can move to you can do this
{/* TODO: call out adding numbers for directional shifts */}
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

### Move Generation

Now that we have a board, we can start figuring out the moves.
While each piece's movement rules are pretty simple to humans, there are SO MANY EDGE CASES.

Things like
- En Passant
- Castling
- Pinned Pieces (a piece who is blocking an attack on the king)

Those situations on their own are not horrible, what really caused pain was combos of those situations like

Like this (really dumb) position

{ /* 

<IFrame width="600" height="400" src="https://lichess.org/embed/game/eJXA7KVE?theme=auto&bg=auto#12"/>

*/ }

The black F pawn could technically be captured En Passant but that would reval the rook attack on the king..


#### Sliding Moves

The sliding pieces can eat up a lot of time. The queen can "see" up to 27 squares if its at the center of the board.
So if you have a "naive" algorithm that "walks" the 8 directions you can go that can eat up a lot of the move generation time.

So this is where BitBoards can help a lot. I went with what the chess wiki calls the ["Classical Approach"](https://www.chessprogramming.org/Classical_Approach).

At its core, I precompute the 8 rays on each square. A ray is all the potential squares a piece could slide to along a column, row, or diagonal in both directions.

So for example here are some of the rays for the b4 square (stolen from the chess wiki, have i mentioned how dope it is yet...)
```
East (+1)           North (+8)           NorthEast (+9)      NorthWest (+7)
. . . . . . . .     . . . 1 . . . .      . . . . . . . 1     . . . . . . . .
. . . . . . . .     . . . 1 . . . .      . . . . . . 1 .     1 . . . . . . .
. . . . . . . .     . . . 1 . . . .      . . . . . 1 . .     . 1 . . . . . .
. . . . . . . .     . . . 1 . . . .      . . . . 1 . . .     . . 1 . . . . .
. . . R 1 1 1 1     . . . R . . . .      . . . B . . . .     . . . B . . . .
. . . . . . . .     . . . . . . . .      . . . . . . . .     . . . . . . . .
. . . . . . . .     . . . . . . . .      . . . . . . . .     . . . . . . . .
. . . . . . . .     . . . . . . . .      . . . . . . . .     . . . . . . . .
```

Now I can use the ray as a mask to see any potential blockers along the ray.

So for example
```
occupied         &  NorthWest(g2)       {a8, c6}
1 . 1 1 1 1 1 1     1 . . . . . . .     1 . . . . . . .
1 . 1 1 1 1 1 1     . 1 . . . . . .     . . . . . . . .
. 1 1 . . . . .     . . 1 . . . . .     . . 1 . . . . .
. . . . . . . .     . . . 1 . . . .     . . . . . . . .
. . . . . . . .  &  . . . . 1 . . .  =  . . . . . . . .
. . . . . . 1 .     . . . . . 1 . .     . . . . . . . .
1 1 1 1 1 1 B 1     . . . . . . . .     . . . . . . . .
1 1 1 1 1 . 1 1     . . . . . . . .     . . . . . . . .
```

Once the ray mask is applied to the occupied board shown here only 2 squares remain (a8 and c6).
{/* TODO: explain bit scan and positive/negative rays bit more */}
Since this this ray is going in a positive direction on the board, if you find the first LSB set, that will get you the blocker of the ray.

So in this case, we will find c6. So any square "behind" c6 will not be accessible for this piece. 
We can use the same NorthWest ray on c6 and "subtract" its ray from the ray original ray we computed on g2

```
NorthWest(c6)   xor  NorthWest(g2)   =  final northWest Attacks
1 . . . . . . .      1 . . . . . . .    . . . . . . . . 
. 1 . . . . . .      . 1 . . . . . .    . . . . . . . . 
. . . . . . . .      . . 1 . . . . .    . . 1 . . . . . 
. . . . . . . .      . . . 1 . . . .    . . . 1 . . . . 
. . . . . . . .      . . . . 1 . . .    . . . . 1 . . . 
. . . . . . . .      . . . . . 1 . .    . . . . . 1 . . 
. . . . . . . .      . . . . . . . .    . . . . . . . . 
. . . . . . . .      . . . . . . . .    . . . . . . . . 
```

So with an intersection, a bit scan, and an xor I have all the possible squares a piece could slide to along that ray!

##### Zig Comptime

These rays could be computed as needed, they aren't horribly expensive but are not free.
It would be great to store all rays ahead of time.
Thankfully zig's comptime logic is great. You can have any pure zig code run at compile time and output whatever you want!
So I compute all rays at compile time, the rays are just statically stored in the produced executable.

I compute the rays by first computing all the "lines" for each square. A Line is just both directions of a ray combined

```zig
// https://www.chessprogramming.org/On_an_empty_Board#By_Calculation_3
// given a square index, get all squares on its rank (row)
pub fn rankMask(sq: u32) MaskInt {
    return RANK_0 << toShiftInt(sq & 56);
}

// get all squares on the same file (column) as the square passed in
pub fn fileMask(sq: u32) MaskInt {
    return FILE_A << toShiftInt(sq & 7);
}

inline fn mainDiagonalMask(sq: u32) MaskInt {
    const sq_i32 = @as(i32, @intCast(sq));

    const diag: i32 = (sq_i32 & 7) - (sq_i32 >> 3);
    return if (diag >= 0)
        MAIN_DIAG >> (toShiftInt(diag) * 8)
    else
        MAIN_DIAG << (toShiftInt(-diag) * 8);
}

inline fn antiDiagonalMask(sq: u32) MaskInt {
    const sq_i32 = @as(i32, @intCast(sq));
    const diag: i32 = 7 - (sq_i32 & 7) - (sq_i32 >> 3);
    return if (diag >= 0)
        ANTI_DIAG >> (toShiftInt(diag) * 8)
    else
        ANTI_DIAG << (toShiftInt(-diag) * 8);
}

pub const Line = enum {
    Rank,
    File,
    MainDiag,
    AntiDiag,

    // sq is the "index" of the square on the board, so a1 is 0, b1 is 1, etc
    pub fn computeLine(self: Line, sq: u32) BoardBitSet {

        const mask = switch (self) {
            .Rank => rankMask(sq),
            .File => fileMask(sq),
            .MainDiag => mainDiagonalMask(sq),
            .AntiDiag => antiDiagonalMask(sq),
        };

        return BoardBitSet.fromMask(mask);
    }
};
```

With this setup, I can stores all lines for each square in an array thats computed at compile time

```zig
pub const Lines = [64][NUM_LINES]BoardBitSet;

pub fn computeLines() Lines {
    @setEvalBranchQuota(64 * NUM_LINES * 100 + 1);
    var moves: [64][NUM_LINES]BoardBitSet = undefined;

    inline for (0..64) |idx| {
        inline for (utils.enumFields(Line)) |f| {
            const line_idx = f.value;
            const line: Line = @enumFromInt(line_idx);

            moves[idx][line_idx] = line.computeLine(idx);
        }
    }
    return moves;
}

pub const LINES = computeLines(); // this is a top level variable so it just runs at compile time
```

I then can "split" the lines in half to get the corresponding rays

```zig
pub const Dir = enum(u3) {
    North = 0,
    South = 1,
    West = 2,
    East = 3,
    NorthWest = 4,
    NorthEast = 5,
    SouthWest = 6,
    SouthEast = 7,

    pub fn computeRay(self: Dir, sq: u32) BoardBitSet {
        // https://www.chessprogramming.org/On_an_empty_Board#Rays_by_Line
        const line = self.toLine();

        const square_bitset = BoardBitSet.initWithIndex(sq);
        const single_bit = square_bitset.bit_set.mask;

        const line_attacks = precompute.LINES[sq][@intFromEnum(line)];

        var ray_mask: MaskInt = undefined;
        if (self.isPositive()) {
            const shifted = single_bit << 1;
            // creates a mask where all bits to the left of the original single bit (including the bit itself)
            // are set to 0 and all bits to the right are set to 1.
            ray_mask = 0 -% shifted;
        } else {
            // creates a mask where all bits to the right of the single bit are set to 1
            // and all bits to the left (including the bit itself) are set to 0.
            ray_mask = single_bit -| 1;
        }

        return BoardBitSet.fromMask(line_attacks.bit_set.mask & ray_mask);
    }
}
```

I also store these rays at compile time so I only pay the compute cost once!


## Search

So now that I have a (mostly) bug free implementation of chess, I can start working on searching through moves to find the best moves to play.

Move search works roughly like this

- Get all valid moves for this position
- play a move, and recursively search the new position until some depth is hit
- evaluate the deepest positions (give it a score)
- Play the move the gives you the highest score

What I described is basically [minimax search](https://www.chessprogramming.org/Minimax).
The main extra piece is you need to assume the other player will also be making the best moves for them.
If theres a checkmate you could possibly reach in 2 moves, that would score well but if it requires the other player to play "dumb" moves you should not really consider it.

So to get the score for non-leaf nodes, you will pick the min score when its the opponents turn, and the max if its your turn.

Minimax is a good searching algorithm but its pretty slow. It requires you to check every possible node in the search tree.
Thankfully with a small tweak we can make it much more efficient. That change is [Alpha-Beta search](https://www.chessprogramming.org/Alpha-Beta)

Alpha beta search would help us in this kind of situation
- The first move we examine to our depth limit is neutral, ie the position is pretty balanced for both sides
- The second move leads to black being able to capture our queen right away. Since this is so much worse than the first move we can stop searching this sub tree right now

To do the above we track 2 values, alpha and beta. Alpha is the lower bound for us, if a position gets lower than alpha we can ignore it. Beta is an upper bound, if we could get into a position thats really good, the other player won't allow us to play that move so theres not point to explore that either.

The [wikipedia page](https://en.wikipedia.org/wiki/Alpha%E2%80%93beta_pruning) for alpha-beta pruning has some good examples if your more interested, but TLDR this is an easy to implement search algorithm that is pretty fast and it will give the same answer as normal minimax search.

### Evaluation

There are many ways you can evaluate a chess position but the simplest thing to do first is to sum up the piece values for each player then subtract your piece values from the opponent's piece score.




### Move ordering

To help see more pruning, I need to sort the moves we examine so "better" moves are examined first. This way we should see more cutoffs for the worse moves.



## Testing

As I worked on more and more search improvements I ran into an issue. How do I know if the engine is getting better at playing chess? I could play against it after each change, but I suck...
So the best approach is to have every change to the engine play an older version of itself. If the newer version beats the older one more often than not, the change was probably a good one.

Thankfully [Fastchess](https://github.com/Disservin/fastchess) exists, it will make "tournaments" where a random position is given to 2 engines and they both play as white and black in that position to see who wins.
It gives a basic report that looks roughly like
```text
Results of new vs old (0.1/move, NULL, NULL, popularpos_lichess.epd):
Elo: 220.12 +/- 17.71, nElo: 244.54 +/- 15.23
LOS: 100.00 %, DrawRatio: 35.60 %, PairsRatio: 15.51
Games: 2000, Wins: 1552, Losses: 431, Draws: 17, Points: 1560.5 (78.03 %)
Ptnml(0-2): [36, 3, 356, 14, 591], WL/DD Ratio: inf
```
So in this run, the new version have the engine has won 1552 / 2000 games. So this version of the engine is much better than the older one. You can go more into specific elo ratings to see how much a change
affects elo but win/lose ratio is good enough for me...


### UCI

To use fastchess I need my engine to support the [UCI](https://gist.github.com/DOBRO/2592c6dad754ba67e6dcaec8c90165bf) protocol. This is a pretty basic protocol, it sends simple text commands over stdin to the process.
You then need to respond with basic text commands.

I messed with parsing a few times when working on the engine. I eventually used [mecha](https://github.com/Hejsil/mecha) for parsing [pgn](https://www.chess.com/terms/chess-pgn) later on,
but when I implemented UCI I stuck with the std lib for simplicity. So the parsing logic looked roughly like this

```zig
fn ParseRes(comptime T: anytype) type {
    return struct { parsed: T, rest: TokenIter };
}

//https://gist.github.com/DOBRO/2592c6dad754ba67e6dcaec8c90165bf
pub const CommandKind = enum {
    Uci,
    Debug,
    IsReady,
    SetOption,
    Register,
    UciNewGame,
    Position,
    Go,
    Stop,
    PonderHit,
    Quit,

    fn asStr(self: CommandKind) []const u8 {
        return switch (self) {
            .Uci => "uci",
            .Debug => "debug",
            .IsReady => "isready",
            .SetOption => "setoption",
            .Register => "register",
            .UciNewGame => "ucinewgame",
            .Position => "position",
            .Go => "go",
            .Stop => "stop",
            .PonderHit => "ponderhit",
            .Quit => "quit",
        };
    }

    pub fn fromStr(str: []const u8) !ParseRes(CommandKind) {
        var iter = std.mem.tokenizeScalar(u8, str, ' ');

        const command_str = iter.next() orelse {
            return error.EmptyInput;
        };

        inline for (Utils.enumFields(CommandKind)) |f| {
            const kind: CommandKind = @enumFromInt(f.value);
            if (std.mem.eql(u8, command_str, kind.asStr())) {
                return .{ .parsed = kind, .rest = iter };
            }
        }

        return error.InvalidCommand;
    }
};
```

So just a basic enum where I map each variant to what the protocol describes. In `fromStr` I use the amazing helper [std.mem.tokenizeScalar](https://ziglang.org/documentation/master/std/#std.mem.tokenizeScalar).
This is great for basic parsing, it will split the string on a space in this case (and consume multiple spaces if they are all together). The iterator would then just return all words.
I have a generic type `ParseRes(T)` that returns the parsed token and the rest of the string.

Error handling is super easy, marking the return type as `!T` is sorta like `Result<T, any>` but better. Zig will infer the error type for you, so I can just make errors "on the fly" and zig will do the work for me.
Error handling and optionals in zig are soooooo nice. They are built right into the syntax of the language so they are really easy to use and make the golden path a breeze. Error handling in rust is nice but its annoying to need to basically always pull in `anyhow`/`thiserror` to make them come close to how zig handles it.


I then parse the rest of the protocol with this

```zig
pub const Command = union(CommandKind) {
    Uci,
    Debug: bool,
    IsReady,
    SetOption: OptionArgs,
    Register,
    UciNewGame,
    Position: PositionArgs,
    Go: GoArgs,
    Stop,
    PonderHit,
    Quit,


     pub fn fromStr(allocator: Allocator, str: []const u8) !ParseRes(Command) {
        const commandKindRes = try CommandKind.fromStr(str);
        const kind = commandKindRes.parsed;
        var iter = commandKindRes.rest;

        const command: Command = switch (kind) {
            .Uci, .IsReady, .Register, .UciNewGame, .Stop, .PonderHit, .Quit => |k| blk: {
                inline for (Utils.unionFields(Command)) |f| {
                    // type checking gets sad should only hit void because of the switch but needs to explicitly skip
                    if (f.type != void) {
                        continue;
                    }
                    if (std.mem.eql(u8, f.name, @tagName(k))) {
                        break :blk @unionInit(Command, f.name, {});
                    }
                }
                std.debug.panic("No match on EmptyCommandArgs for: {s}", .{@tagName(k)});
            },
            // many other variants.... look on github if you care https://github.com/JRMurr/ZigFish/blob/a591ff34c994fb8e8dabafbe9d834fc5c2aa7ed8/src/uci/commands.zig#L208
        };

        return .{ .parsed = command, .rest = iter };
    }
}
```


I omitted the non-void commands since thats just more special case parsing. For the void commands (ie commands that are a single word), I can do more comptime magic to convert the enum of `CommandKind` to the corresponding variant in `Command`.



### Forcing Nix into yet another blog post

So now that we have UCI working we can run fast chess. The issue though is you need full executables for both versions you are comparing against.
I could keep old versions around on my computer, check out old versions of the repo manually, etc. Thats all boring. Im a nix nerd lets do something cool.

So I made a script with nix that will, build fast-chess, build 2 arbitrary versions of my engine, and run them against each other. 

So first off, fast-chess was not in nix pkgs already so we needed to build it

```nix
stdenv.mkDerivation rec {
  pname = "fast-chess";
  version = "v0.9.0";

  src = fetchFromGitHub {
    owner = "Disservin";
    repo = "fast-chess";
    rev = "09858ce817b471408ee9439fa502c9ce4a63dd43";
    sha256 = "sha256-RUHVwutazOiIw6lX7iWGKANWJIaivlzmoxVuj9LQPUc=";
  };


  enableParallelBuilding = true;

  meta.mainProgram = "fast-chess";

  installPhase = ''
    ls -la
    mkdir -p $out/bin

    cp fast-chess $out/bin
  '';

}
```

Thats it..., nix will automatically call make files setup in a standard way. So this will build fastchess with gcc and all i needed to do was add my own install phase since the fast-chess makefile didn't specify that.

#### Nix build for zig engine

To build the zig code required a little bit more work.

First off, since I included some third party deps to the engine, I need to fetch those in nix. Thankfully [zon2nix](https://github.com/nix-community/zon2nix) makes this pretty easy.

You point it at your `build.zig.zon` file and it will output a file like

```nix:deps.nix
# generated by zon2nix (https://github.com/nix-community/zon2nix)

{ linkFarm, fetchzip }:

linkFarm "zig-packages" [
  {
    name = "122002d98ca255ec706ef8e5497b3723d6c6e163511761d116dac3aee87747d46cf1";
    path = fetchzip {
      url = "https://github.com/raysan5/raygui/archive/4b3d94f5df6a5a2aa86286350f7e20c0ca35f516.tar.gz";
      hash = "sha256-+UVvUOp+6PpnoWy81ZCqD8BR6sxZJhtQNYQfbv6SOy0=";
    };
  }
  # many other fetches
]
```

When you go to use zig in a nix derivation you can set the output of the `deps.nix` as you zig cache so zig will just pull the deps from there instead of doing a network call to fetch them.

```nix
{ stdenvNoCC, callPackage, zig, lib }:
let
  rootDir = ../../.; # relative path to the repo root
  fs = lib.fileset;
  # grab only zig files to use as the src code for the derivation
  # this way if I update things like a readme a re-build won't happen
  fileHasAnySuffix = fileSuffixes: file: (lib.lists.any (s: lib.hasSuffix s file.name) fileSuffixes);
  zigFiles = fs.fileFilter (fileHasAnySuffix [ ".zig" ".zon" ]) rootDir;

in

stdenvNoCC.mkDerivation {
  name = "zigfish";
  version = "main";
  src = fs.toSource {
    root = rootDir;
    fileset = zigFiles;
  };
  nativeBuildInputs = [ zig ];
  dontInstall = true; # don't run the default installPhase, our build phase will install
  buildPhase =
    let
      buildArgs = [
        "--cache-dir $(pwd)/.zig-cache"
        "--global-cache-dir $(pwd)/.cache" # we will sym link the deps to this path in the build phase
        "-Doptimize=ReleaseSafe"
        "--prefix $out" # tells zig to put its outputs in the nix generated $out folder
      ];
    in
    ''
      mkdir -p .cache
      # The magic bit that pulls in the deps from the other file
      ln -s ${callPackage ./deps.nix { }} .cache/p
      # zig build install is set to build+install the uci version of the engine
      zig build install ${builtins.concatStringsSep " " buildArgs}
    '';
```

So this derivation will build the "current" version of the engine. Since I expose this derivation in the [flake of my repo](https://github.com/JRMurr/ZigFish/blob/0607861d50e0b6ac553da3e2f713966e886300e6/flake.nix#L62)
I can easily build any version with the command

```shell
nix build "github:JRMurr/ZigFish?rev=<commit>"
```

this will fetch that version from github and run the build and give me the uci executable.


To automate this a bit I used nix to make a shell script that calls nix.....


```nix
{ writeShellScriptBin, jq, nix, lib, git }:
let
  getExe = lib.getExe;
in
writeShellScriptBin "buildAtCommit" ''
  set -euo pipefail

  FLAKREF="github:JRMurr/ZigFish?rev=$1"
  if [[ "$1" == "curr" ]]; then
    # uses git to point at the repo root regardless of where i am in the repo
    REPO_ROOT=$(${getExe git} rev-parse --show-toplevel)
    FLAKREF="$REPO_ROOT"/.
  fi

  PATH=$(${getExe nix} build --no-link $FLAKREF --json | ${getExe jq} --raw-output '.[0].outputs.out')

  echo $PATH/bin/zigfish-uci
''
```

This script is a small helper that takes in a commit or `curr` to build the specified old version or what ever I currently have on disk.
It then will echo the path of the built exe.


#### The fast-chess script

Now that we have everything building we can finally make a script to run fast-chess 

```nix
{ writeShellScriptBin
, buildAtCommit # the build script shown above
, lib
, git
, fastchess # the derivation for fastchess shown above...above...
,
}:
let
  getExe = lib.getExe;
  pgnOutFile = "$OUT_DIR/pgnout.pgn";
  logFile = "$OUT_DIR/log.txt";
 
  fastArgs = "omitted.. see https://github.com/JRMurr/ZigFish/blob/0607861d50e0b6ac553da3e2f713966e886300e6/nix/runFast.nix#L20"

in
writeShellScriptBin "runFast" ''
  set -euxo pipefail
  DEFAULT_COMMIT="2f327523e2afa9cdc73c7d5186088c2e29d881db"
  COMMIT="''${1:-$DEFAULT_COMMIT}"

  REPO_ROOT=$(${getExe git} rev-parse --show-toplevel)
  cd $REPO_ROOT
  OUT_DIR=$(realpath ''${REPO_ROOT})/fastchess-out

  mkdir -p $OUT_DIR
  rm -f ${logFile}
  rm -f ${pgnOutFile}

  # builds old and new version and sets their path to these bash vars
  NEW_ENGINE=$(${getExe buildAtCommit} "curr")
  OLD_ENGINE=$(${getExe buildAtCommit} "$COMMIT")

  ${getExe fastchess} ${fastArgs} # calls fast chess
''
```

I exposed the derivation that produces this shell script on my flake as well as
```nix:flake.nix
packages = {
  default = myPkgs.zigfish.uciBuild;
  runFast = myPkgs.runFast;
};
```

so with 
```shell
nix run .#runFast
```

this will call that script and kick off the fast-chess tournament of the bot on my local checkout of the repo vs an older commit.

