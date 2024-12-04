---
title: Advent Of Code in Nix
date: 2024-12-04T00:58:00.978Z
seriesTitle: Part 1 - Day 1 to ...
slug: aoc2024/nix/part01
tags: ["nix","advent-of-code"]
draft: false
summary: trying to do advent of code in "pure" nix eval
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />


This year has been a long one for me, I gave my first talk, got married (2 days ago as i write this..), and I'm expecting my first kid in May. 
Now that the stress of wedding planning is over, and im still childless, its time to add a new kind of pain to my life.

**Doing Advent of Code in pure nix**


By "pure nix" I mean only using the nix evaluation language. TLDR i will require that `nix eval <my code>` returns the answer to each problem for advent of code. This definition allows for [IFD or import from derivation](https://nix.dev/manual/nix/2.23/language/import-from-derivation), this is somewhat intentional. You need technically need IFD to import nix pkgs which is fine. The kind of IFD thats bad is doing something like

```nix
let
  drv = derivation {
    name = "hello";
    builder = "/bin/sh";
    args = [ "-c" "echo -n hello > $out" ];
    system = builtins.currentSystem;
  };
in
"${builtins.readFile drv} world"
```

here the nix evaluation would need to build the derivation drv to finish evaluation, this is something you generally want to avoid since nix blocks the eval thread while this derivation is being built. 

For my case in AOC, this is probably fine but goes against the spirt of my self imposed challenge. But after a few days of doing this I might give up and allow myself using derivations as poor mans caching or to use some coreutil programs to simplify my nix logic.


This series of posts will assume you sorta understand nix's syntax but if you understand any functional lang it shouldn't be too hard to follow.


So no more yapping lets get into it


# Repo setup

To init my repo I have some flake templates I like to get started with

```shell
# apply the template in https://github.com/JRMurr/NixOsConfig/tree/main/templates/common to the current directory
nix flake --refresh init --template github:JRMurr/NixOsConfig#common
```

my common template is pretty simple, the main thing it adds is a flake with nixos-unstable as the pkgs input and [flake-utils](https://github.com/numtide/flake-utils). It also adds an `.envrc` for [direnv](https://direnv.net/) to load the flake. Finally it includes [just](https://github.com/casey/just) which is a nice command runner, I don't always need it but its nice to have.


## Day template

Most puzzles for advent of code follow the same format. 2 parts and have an example input you can use to check your answer. So I like to make a template for each day with a standard structure to make my life easy, I just copy that folder to start a new day and im good to go. I selted on this structure

```nix
{ pkgs ? import ../locked.nix }:
let

  lib = pkgs.lib;

  part0 = text: "TODO P1";

  part1 = text: "TODO P2";

  solve = text: {
    "0" = part0 text;
    "1" = part1 text;
  };
in
{
  example = solve (builtins.readFile ./in.example);
  real = solve (builtins.readFile ./in);
}
```

The ` pkgs ? import ../locked.nix` line references this file at the repo root
```nix
let

  lockFile = builtins.fromJSON (builtins.readFile ./flake.lock);

  pkgsInfo = lockFile.nodes.nixpkgs;

  nixTar = builtins.fetchTarball {
    name = pkgsInfo.original.ref;
    url = "https://github.com/nixos/nixpkgs/archive/${pkgsInfo.locked.rev}.tar.gz";
    sha256 = pkgsInfo.locked.narHash;
  };

in
(import nixTar) { }
```
this just makes it easy to use the same locked nixpkgs input the flake does in standalone nix files. 


I copy this file into a subdir for each day called `day01`, `day02`, etc. I then made a small helper script called [run-day](https://github.com/JRMurr/AdventOfCode2024/blob/main/runDay.nix#L83) that basically lets me do

```shell
run-day --day 01 --part 1 --useExample false
```

this way i can easily run any day/part with/without examples. I could have exposed all of these as `apps` in my flake to let me do `nix run .#day01...` but I would need to update that each day which is not horrible but annoying.


So to init each day I use this script

```nix
writeShellApplication {
  name = "init-day";
  runtimeInputs = [ git aoc-cli ];
  text = ''
    REPO_ROOT=$(git rev-parse --show-toplevel)
    cd "$REPO_ROOT"

    # Check if a day argument is provided
    if [ -z "$1" ]; then
      echo "Usage: $0 <day>"
      exit 1
    fi

    # Ensure the day argument is a two-digit number
    day=$(printf "%02d" "$1")

    # Set the directory name
    day_dir="day$day"

    # Check if the directory already exists
    if [ -d "$day_dir" ]; then
      echo "Directory '$day_dir' already exists. Exiting."
      exit 1
    fi

    cp -r _template "$day_dir"
    
    # download the input for the day 
    aoc download -o --day "$day" \
        --input-file ./"$day_dir"/in \
        --year 2024 \
        --input-only
  '';
}
```

Now i can run `init-day <day number>` and it will copy the template dir and download the input using the [aoc-cli](https://github.com/scarvalhojr/aoc-cli). 

One thing to note if your doing AOC, please gitignore you puzzle input files, see the last bit here https://adventofcode.com/2024/about, TLDR the puzzle inputs are not free to share.


# Day 01

Day 1 is usually pretty easy and this year is no different. TLDR you are a file with 2 columns of numbers and you need to parse each column into its own list.

## Part 1



In part 1 we need to sort each list and find the differences between the numbers are the same indexs in each list.

To get started I pulled up [noogle](https://noogle.dev/), its the best way to search/find nix functions in the std lib. You can search by name or by input/output types of functions. Its not as good as [hoogle](https://hoogle.haskell.org/) but given nix's lack of static types its the best we got.

I first came across [splitString] (https://noogle.dev/f/lib/strings/splitString) which lets me split each of input with
```nix
# text here is the input file as a string
lib.strings.splitString "\n" text
```

Now on each of these lines i need to split into the left and right numbers so I made

```nix
splitPair = str:
  let
    split = lib.strings.splitString " " str;
  in
  {
    left = lib.strings.toIntBase10 (builtins.head split);
    right = lib.strings.toIntBase10 (lib.last split); #lib.last is more efficient than tail since tail walks the whole list
  }
;
```

the first split would turn the string `3   4` into `["3" "" "" "4"]`, so after grabbing the first and last elements of the list, I can convert them to numbers with [lib.strings.toIntBase10](https://noogle.dev/f/lib/strings/toIntBase10)


now to get the left and right numbers into their own list I can do 

```nix
pairStrs = lib.strings.splitString "\n" text;

pairs = builtins.map splitPair pairStrs;
left = builtins.map (p: p.left) pairs;
right = builtins.map (p: p.right) pairs;
```

This feels inefficient since we walk the list of pairs twice, once to make each list but it works so don't care enough to make it better



Now we need to sort the lists so we can do the pairwise difference in ascending order. There is a [sort](https://noogle.dev/f/lib/sort) function but it runs the comparison many times as it sorts so it can be slow (at least according to the docs...)

So I used [sortOn](https://noogle.dev/f/lib/lists/sortOn) which takes a "key function" to transform each element of the list and that transformatoned input is used to sort


```nix
sortLst = lst: (lib.lists.sortOn (x: x) lst);
```

so in my case i use the identity function `(x: x)` since i dont need to transform the numbers to sort.


Now to actually compute the difference I have one last small hurdle. There doesnt seem to be an absolute value func in the std lib... So i made my own

```nix
abs = x: if x < 0 then x * -1 else x;
```

Theres probably smarter ways to do this but, again it works so who cares...


to combine it all together, I need to get the absolute difference of each pair of sorted elements in the left and right lists, then i need to sum up all the differences. This is basically a zip to combine the two sorted lists together, map them to get the difference, then reduce to add them all up

this can be down with
```nix
combined = lib.zipListsWith (l: r: (abs (l - r))) sortedLeft sortedRight;
answer = lib.lists.foldl' builtins.add 0 combined;
```

and thats all we need for part one


## Part 2

For part2 its not too much different. Now we need to see how often numbers in the left list appear in the right list.

I factored out the parsing of the left and right lists into its own function


```nix
parseInput = text:
    let
      pairStrs = lib.strings.splitString "\n" (lib.strings.trim text);
      splitPair = str:
        let
          split = lib.strings.splitString " " str;
        in
        {
          left = lib.strings.toIntBase10 (builtins.head split);
          right = lib.strings.toIntBase10 (lib.last split);
        }
      ;

      pairs = builtins.map splitPair pairStrs;
      left = builtins.map (p: p.left) pairs;
      right = builtins.map (p: p.right) pairs;
    in
    { inherit left right; };
```

The simplest thing to do would be something like 

```nix
# get the number of times elem appears in the right list and multiply the count by elem
scoreElem = elem: (lib.lists.count (x: x == elem) right) * elem;
scores = builtins.map scoreElem left
answer = lib.lists.foldl' builtins.add 0 scores;
```

but this just screams slow. Its an n^2 alg, we need to loop over the right list for each element of the left list. Also the same number can appear multiple times in the left list so we will need to re-do work for duplicates.

So instead I decided to "pre-compute" all scores in the right list. I did this with a [groupBy](https://noogle.dev/f/lib/groupBy')

```nix
elemScores = lib.lists.groupBy' builtins.add 0 (x: "${toString x}") right;
```

so this groupby will walk over the right list and map the element to a string so it can be a key in an attr set (a dictionary/hashmap). 
It will apply the `builtins.add` function to the old value for that key when their is a key collision. The scoring function the problem wants is to multiple the value by its count, so adding the values together on collision will end us up with the same result.

now to pull it all together

```nix
getScore = x: if builtins.hasAttr "${toString x}" elemScores then builtins.getAttr "${toString x}" elemScores else 0;

scores = builtins.map getScore left;
answer = lib.lists.foldl' builtins.add 0 scores;
```

and with that day 1 is done.

# Nix Tips

So if you want to get better at nix here are some tips

- Look over everything in the [lib.debug namespace](https://nixos.org/manual/nixpkgs/unstable/#sec-functions-library-debug)
  - [traceSeq](https://nixos.org/manual/nixpkgs/unstable/#function-library-lib.debug.traceSeq) is very useful for "printf debugging"
- Get a good language server, I currently use [nil](https://github.com/oxalica/nil) but [nixd](https://github.com/nix-community/nixd) is good too
  - Adds basic autocomplete (sometimes...)
  - Jump to def...
- When you have a stack trace try to avoid the verbsoe stack trace at first, generally the issue is usally the first line of the trace or the last line
