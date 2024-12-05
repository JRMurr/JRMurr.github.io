---
title: Advent Of Code 2024 in Nix
date: 2024-12-04T00:58:00.978Z
seriesTitle: Part 1
slug: aoc2024/nix/part01
tags: ["nix","advent-of-code"]
draft: false
summary: trying to do advent of code in "pure" nix eval
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />


This year has been a long one for me, I gave my first talk, got married (last week...), and I'm expecting my first kid in May. 
Now that the stress of wedding planning is over, and im still childless, its time to add a new kind of pain to my life.

**Doing Advent of Code in pure nix**

<Note>
If your lazy, you can see my code [here](https://github.com/JRMurr/AdventOfCode2024) and If your nix curious I included some nix tips at the end
</Note>


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


# Is Nix Lang Good?

One of my hottest takes is that the nix language is actually pretty good for its use case. That is defining declarative builds. Working with attrsets (hashmaps) is really nice for common use cases like nested attributes, merging, and default missing values.

The main issues with the language IMO are 

- Confusing error messages
- No static types
- No top tier LSP (yet..)


<Note>
I'd add a small negative of limited std lib but its honestly decent for the main use case of defining builds, its only really gonna bite me in this challenge. 
</Note>

The error messages are the biggest pain issue. Once you do enough nix work you sorta get a vibe for a how to parse error messages, its generally the first or last that matters. If its a nixos module type error, I wish you the best....


No types is also sad, nix is pretty heavily dynamic so not sure what kind of typescript would work well here. I think having something like python or typescript "optional" types would go a long to improve the editor expereince when its simple

Sorta related to types, there is not a great LSP that "just works" for nix. The two I'be tried are [nil](https://github.com/oxalica/nil) and [nixd](https://github.com/nix-community/nixd). Both are make life way better for simple stuff but if you need to reference something defined in a different file they arent always useful. They both have promise to make life better so heres to hopping...





Enough yapping lets go into it


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
[puzzle link](https://adventofcode.com/2024/day/1)


Day 1 is usually pretty easy and this year is no different. TLDR you are a file with 2 columns of numbers and you need to parse each column into its own list.

<Note>
I wrote this after I finished day 1 so it doesn't include some of the sadness I hit along the way, will try to write as I go for the rest.
</Note>

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
    right = lib.strings.toIntBase10 (lib.last split);
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


# Day 02
[puzzle link](https://adventofcode.com/2024/day/2)


This seems to be a common format of "split input by lines and do a check". So i'll skip a little bit of the parsing details (look at the code if you are curious)

## Part 1

For the first part we need to see if a line (list of nums) is safe if it is all increasing or all decrasing and each adjacent change is in `1 <= change <= 3`.

The main challenge here is figuring out how to easily look at all adjacent pairs. Skimming through the std lib I don't see an obvious way so ill make this helper

```nix
getAdjPairs = lst:
    let
      tailLst = lib.lists.drop 1 lst;
    in
    lib.lists.zipListsWith (a: b: [ a b ]) lst tailLst;
#  getAdjPairs [1 2 3 4 5] ==  [ [ 1 2 ] [ 2 3 ] [ 3 4 ] [ 4 5 ] ]
```

so here we make a new list witch is the same as the given `lst` but with its first element removed (`tailLst`), we can then zip the orginal list with the tail list to see each adjacent pair.


Now we can just get the diff of all these pairs and with a basic `lib.lists.all` make sure all the safety checks apply. 


```nix
diffPair = pair: builtins.head pair - lib.lists.last pair;

isPos = num: num > 0;


isSafe = nums:
  let
    diffs = builtins.map diffPair (getAdjPairs nums);
    # true if the first diff is positive
    firstDiffDir = isPos (builtins.head diffs);

    checkDiff = diff: if (diff > 3 || diff < 1) then false else
    (
      # make sure direction is same as first diff
      firstDiffDir == isPos diff
    );
  in
  builtins.all checkDiff diffs;

part0 = text:
    let
      lines = builtins.map parseLine (lib.strings.splitString "\n" (lib.strings.trim text));
    in
    lib.lists.count isSafe lines;
```

This mostly seems good but when I ran on the example input I got a `1` instead of `2` so I was messing up my safety check somehow.

I updated the `isSafe` func with some debugging info

```nix
isSafe = nums:
  let
    diffs = builtins.map diffPair (getAdjPairs nums);
    # true if the first diff is positive
    firstDiffDir = isPos (builtins.head diffs);

    checkDiff = diff: if (diff > 3 || diff < 1) then false else
    (
      # make sure direction is same as first diff
      firstDiffDir == isPos diff
    );

    res = builtins.all checkDiff diffs;
  in
  lib.debug.traceSeq { inherit res nums diffs; } res;
```

`lib.debug.traceSeq` logs the first value (deeply) and returns the second value, when i ran again i noticed I was getting this on the last example input

```
trace: { diffs = [ -2 -3 -1 -2 ]; nums = [ 1 3 6 7 9 ]; res = false; }
```

I forgot to look at the absolute difference in `(diff > 3 || diff < 1)` so it was failing thinking the diff was too small. I can re-use my abs function from day 1 and update the check func to be 
```nix
checkDiff = diff:
  let
    absDiff = abs diff;
  in
  if (absDiff > 3 || absDiff < 1) 
  then false 
  else firstDiffDir == isPos diff;
```

and part 1 is done.

## Part 2

Part 2 adds a small twist where a row can be safe is removing at most 1 number from the original list makes the remaining numbers appear safe.

The most straightforward way to do this would be brute force, go through the list and remove numbers to see if it becomes safe. This would probably not complete in a timely fashion on the real input so im not going to consider it.


I think a slightly better approach would be to first check if removing 1 single number could even help. If we think it could try the brute force approach on the numbers we think could impact.

To do this we can track the indices of failed diffs.

- No failures, return true
- If theres a single failure, try to remove both numbers to see if the rest would be safe
- If there are 2 failures and the indices are adjacent, we can remove the number in both those diffs to see if the rest of the list would be safe
- otherwise still return false

I think the above 2 conditions are sufficient but I will add in one extra check due to how my current `checkDiff` impl works

- If there are `>= (len diffs - 2)` failures, try removing the first two numbers.

Im adding this since i check if all diffs are increasing or decreasing by comparing with the first diff. If the first diff is the outlier in increasing or decreasing my impl would count the rest of the diffs as failing. I need the `-2` since if the second number is the orignal list is whats causing the sadness its possible the first 2 diffs are good but the rest fail.


So with that sorta weird logic here is an updated `isSafe` func for part 2 (i just copied a new one)

```nix
isSafeP2 = nums:
    let
      diffs = builtins.map diffPair (getAdjPairs nums);
      # true if the first diff is positive
      firstDiffDir = isPos (builtins.head diffs);

      checkDiff = diff:
        let
          absDiff = abs diff;
        in
        if (absDiff > 3 || absDiff < 1) then false else
        (
          # make sure direction is same as first diff
          firstDiffDir == isPos diff
        );

      resWithIdx = lib.lists.imap0 (idx: diff: { inherit idx diff; safe = checkDiff diff; }) diffs;

      failures = builtins.filter (x: !x.safe) resWithIdx;

      numFailures = builtins.length failures;

      isNoFailure = numFailures == 0;

      idxsToRemove =
        if (numFailures == 1)
        then
          (
            let
              failureIdx = (builtins.head failures).idx;

            in
            [ failureIdx (failureIdx + 1) ]
          )
        else if (numFailures == 2) then
          (
            let
              firstFailureIdx = (builtins.head failures).idx;
              secondFailureIdx = (lib.lists.last failures).idx;
            in
            if firstFailureIdx + 1 == secondFailureIdx then [
              secondFailureIdx
            ] else [ ]
          )
        else if (numFailures >= (builtins.length diffs - 2)) then [ 0 1 ]
        else [ ];


      checkWithRemoved = removeIdx:
        let
          removedLst = removeAtIndex removeIdx nums;
        in
        isSafe removedLst;

      couldRemove = lib.lists.any checkWithRemoved idxsToRemove;


      res = isNoFailure || couldRemove;
    in
    res;
```


this is a little gross but thanks to laziness of nix it doesn't always evaluate everything.

The first main change is 

```nix
resWithIdx = lib.lists.imap0 (idx: diff: { inherit idx diff; safe = checkDiff diff; }) diffs;
```

Here i map over the diffs with `imap0` to get the 0 based index for each diff, i return an attrset of `{idx, diff, safe}`. The `diff` is not used but its nice for debugging.

I can then get only the failures with 
```nix
failures = builtins.filter (x: !x.safe) resWithIdx;
```

now the most complicated part
```nix
idxsToRemove =
  if (numFailures == 1)
  then
    (
      let
        failureIdx = (builtins.head failures).idx;

      in
      [ failureIdx (failureIdx + 1) ]
    )
  else if (numFailures == 2) then
    (
      let
        firstFailureIdx = (builtins.head failures).idx;
        secondFailureIdx = (lib.lists.last failures).idx;
      in
      if firstFailureIdx + 1 == secondFailureIdx then [
        secondFailureIdx
      ] else [ ]
    )
  else if (numFailures >= (builtins.length diffs - 2)) then [ 0 1 ]
  else [ ];
```

this a little spooky looking but its just following the logic i described above. This returns indicies to attempt to remove to see if the remaining list would be safe

```nix
checkWithRemoved = removeIdx:
    let
      removedLst = removeAtIndex removeIdx nums;
    in
    isSafe removedLst;

couldRemove = lib.lists.any checkWithRemoved idxsToRemove;
```

loops over the possible removes and `couldRemove` would be true if any of them would make the list safe.


And with that it works!



So far nix has not been too annoying to do the problems in. The main challenge is just thinking of a good answer to the actual problem... Thats mostly because the first days are easy but also that AOC are decent problems that usually don't have answers you can just grab from a std lib.



# Day 03
[puzzle link](https://adventofcode.com/2024/day/3)



So looking at day 3, I take back what I just said above...

The problem for today is basically a parser. At least for part1 I could probably do something like a regex match all with
```
mul\((\d{1,3}),(\d{1,3})\)
```

but nix only has [builtins.match](https://noogle.dev/f/builtins/match) which has regex support but requires the regex to exactly match the given string

<Note>
I might be doing somthing dumb but even this basic example doesn't seem to work
```
nix-repl> builtins.match "mul\(2,4\)" "mul(2,4)"
null
```
probably something with posix regex syntax that im not used too..
</Note>


So im at a crossroads, I could do one of the following

- Do some manual parsing, maybe split on `mul` and see if can figure out anything useful
- Cry
- Use IFD to use ripgrep to do the regex match for me


I think I will go the IFD route mostly because 

- Its probably more interesting for you to see
- I really don't want to do the string parsing myself...

I'll be a good boi and only use IFD for finding matches, I'll try to do the rest in pure nix

## Part 1

So first we need to figure out how to properly call ripgrep to return all the matches, this seems to be what we want

```shell
$ rg --only-matching --no-line-number "mul\((\d{1,3}),(\d{1,3})\)" day03/in.example
mul(2,4)
mul(5,5)
mul(11,8)
mul(8,5)
```

I could do more to only return the capturing groups but I don't want this only to be a ripgrep solution...

Now we can wrap this up in its own derivation to use in nix

```nix
callRg = filePath:
  let
    rgPath = "${pkgs.ripgrep}/bin/rg";
  in
  pkgs.runCommandLocal "call-rg" { } ''
    ${rgPath} --only-matching --no-line-number "mul\((\d{1,3}),(\d{1,3})\)" ${filePath} > $out
  '';

part0 = { text, filePath }:
  let
    matches = builtins.readFile (callRg filePath);

  in
  matches;
```

here we use [runCommandLocal](https://nixos.org/manual/nixpkgs/unstable/#trivial-builder-runCommand) to let us write a basic bash script to have nix call ripgrep on the specified input file. I pipe the output of `rg` to `$out` which is the nice special var for where to place any outputs of a derivation. The path will be something like `nix/store/<hash>-call-rg`, and that path is what `runCommand` "returns" back to the nix evaluation system. When we use `builtins.readFile` we are doing IFD to cause the nix evaluator to pause while it realizes the derivation to get the results of the rip grep call. 

<Note>
One cool thing of doing IFD for this is the actual call to rip-grep is cached across runs, nix knows that the run-command only depends on the text of the run-command script, rip-grep, and the value of `filePath`, so since we aren't changing it we just get the same result back almost instantly.
</Note>

on the example input `matches` ends up being `"mul(2,4)\nmul(5,5)\nmul(11,8)\nmul(8,5)\n"` which we can now manipulate using pure nix pretty easily.

```nix
# mulStr should look like "mul(2,4)"
doMul = mulStr:
  lib.trivial.pipe mulStr [
    # clean the string to remove the non-digit chars
    (lib.strings.removePrefix "mul(")
    (lib.strings.removeSuffix ")")
    # split the numbers
    (lib.strings.splitString ",")
    # convert to an actual number
    (builtins.map lib.strings.toIntBase10)

    # do the multiplication (fold with acc as 1 to make it easy)
    (lib.lists.foldl' (x: y: x * y) 1)
  ];

part0 = { text, filePath }:
  let
    matches = builtins.readFile (callRg filePath);
    matchLines = (lib.strings.splitString "\n" (lib.strings.trim matches));
    muls = builtins.map doMul matchLines;
  in
  (lib.lists.foldl' builtins.add 0 muls);
```

Here i used [lib.trivial.pipe](https://noogle.dev/f/lib/trivial/pipe) to avoid having to make a bunch of intermediate variables for cleaning and transforming the `mulStrs` 

And it works! 

Its hard to say exactly how much a perf impact IFD has here, the real answer completed in about 500ms, if i add a space to the rip-grep runCommand to cause a cache miss its about 700ms.


## Part 2

Only a small twist for part 2, you need to also look for `do()|don't()`. If theres a `don't` you need to ignore the muls until the next `do`.

I think we can just modify the rip-grep call to also look for those and handle this logic in nix.

```nix
callRgP2 = filePath:
  let
    rgPath = "${pkgs.ripgrep}/bin/rg";
  in
  pkgs.runCommandLocal "call-rg" { } ''
    ${rgPath} --only-matching --no-line-number "(mul\((\d{1,3}),(\d{1,3})\))|(do\(\))|(don't\(\))" ${filePath} > $out 
  '';

part1 = { text, filePath }:
  let
    matches = builtins.readFile (callRgP2 filePath);
    matchLines = (lib.strings.splitString "\n" (lib.strings.trim matches));

    trimFn = { lst, addAllowed }: x:
      let
        command = builtins.head (lib.strings.splitString "(" x);
        addAllowed' = if command == "do" then true else if command == "don't" then false else addAllowed;
        lst' = if command == "mul" && addAllowed then (lst ++ [ x ]) else lst;
      in
      { lst = lst'; addAllowed = addAllowed'; };

    trimmedMuls = (lib.lists.foldl' trimFn { lst = [ ]; addAllowed = true; } matchLines).lst;

    muls = builtins.map doMul trimmedMuls;
  in
  (lib.lists.foldl' builtins.add 0 muls);
```

here I updated the regex to include the do and don't lines. Before doing the same multiplication logic as before i fold over the list of matches and track if im currently allowing adds or not. If the command is a do i set addAllowed to true, if its don't i set it false, otherwise i leave it alone. I then only add mul lines if im in add mode. 

I can then basically do the same logic as part 1 and im good to go


This was a fun solution, using riprep made my life so much nicer on this day that i might just allow myself more IFD going forward.... Feel free to yell at me on twitter if you think I should not...

For now this is where ill stop this post of the series. Ill keep going for at least the next few days of AOC but will probably stay a few days behind..

# Nix Tips

So if you want to get better at nix here are some tips

- [Noogle](https://noogle.dev/) is fantastic
- Look over everything in the [lib.debug namespace](https://nixos.org/manual/nixpkgs/unstable/#sec-functions-library-debug)
  - [traceSeq](https://nixos.org/manual/nixpkgs/unstable/#function-library-lib.debug.traceSeq) is very useful for "printf debugging"
- Get a good language server, I currently use [nil](https://github.com/oxalica/nil) but [nixd](https://github.com/nix-community/nixd) is good too
  - Adds basic autocomplete (sometimes...)
  - Jump to def...
- When you have a stack trace try to avoid the verbsoe stack trace at first, generally the issue is usally the first line of the trace or the last line
