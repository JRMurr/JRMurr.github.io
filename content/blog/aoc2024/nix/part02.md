---
title: Advent Of Code 2024 in Nix - Days 03-06
date: 2024-12-06T01:39:35.847Z
seriesTitle: Days 03-06
slug: aoc2024/nix/part02
tags: ["nix","advent-of-code"]
draft: false
summary: trying to do advent of code in "pure" nix eval
images: []
layout: PostSimple
---


<TOCInline toc={props.toc} asDisclosure />


Ill avoid a lot of the spiel I had in the first post but TLDR this post is going over my attempt to do [Advent of Code](https://adventofcode.com/2024)
in "pure nix" ie the nix eval lang (though I might do some IFD here and there to keep my sanity)

<Note>
As a FYI, I don't think my actual solutions algorithm wise are anything special.
I usually do the first thing that comes to mind that I cant see anything obviously wrong with.

I also am mostly writing this as I solve so sometimes I'll throw things out for part 2....

I'd say about half the time when I go to look at other people's answers I usually see a way smarter approach to the problem.

So if you're here for "smart" algorithms, im sorry.... I can only provide meme nix algorithms
</Note>


# Day 04
[puzzle link](https://adventofcode.com/2024/day/4)


This is an interesting one, you basically need to find all occurences of the string `XMAS` in the puzzle input, it can appear horizontal, vertical, diagonal, backwards, and overlapping.

## Part 01



My first idea is to walk over all points in the 2d grid of characters and look at the "rays" extending from that point in all directions. 
If we make the rays have a length of 4 we can see if the ray contains `XMAS` or `SMAX`.
This has the potential to be really slow so and has some issues with double counting hits (seeing `XMAS` or `SMAX` depending on the starting on X or S)

I think to make this a little better we only need to consider rays facing "right" and "down" at each point. This should avoid duplicates and half the checks over the initial idea.

### Parsing

First we need to parse the string into a 2d grid of characters. I will transform the input into a single list. 
If we track the width we can treat the 1d list as a 2d list which should be slightly better for performance.

```nix
parseToList = text:
    let
      rowStrs = (lib.strings.splitString "\n" (lib.strings.trim text));
      # 2d list of charcters
      rows = builtins.map (lib.stringToCharacters) rowStrs;

      width = builtins.length (builtins.head rows);
    in
    {
      inherit width;
      lst = lib.flatten rows;
    };
```

This func takes in the puzzle input as a string and will return something like 

```nix
# text = "XM\nSA"
{width = 2; lst = ["X" "M" "S" "A"]}
```

<Note>
I could probably just return the string back with new lines removed but lists are cooler....
</Note>

The [stringToCharacters](https://noogle.dev/f/lib/stringToCharacters) func converts a given string into a list with each element being a length 1 string of the chars that made up the original string. Its docs include the following

> note that this will likely be horribly inefficient; Nix is not a general purpose programming language. 
> Complex string manipulations should, if appropriate, be done in a derivation.

So this is giving a lot of confidence...


### Dealing with "Rays"

Since we are treating the grid as a 1d list we can store rays as a list of "offsets" for example look at this grid

```
0  1  2  3  4
5  6  7  8  9
10 11 12 13 14
15 16 17 18 19
20 21 22 23 24
```

here each "cell" is the index it would be in a 1d array, if i want to get the NorthWest to SouthEast diagonal the offsets would be 
`[0 6 12 18]` I can add those numbers to a given starting index and have the indices for that ray.

So the rays I need to track are
- `[0 1 2 3]` Horizontal
- `[0 5 10 15]` Vertical
- `[0 6 12 18]` NorthWest to SouthEast diagonal
- `[0 4 8 12]` NorthEast to SouthWest Diagonal

<Note>
This only work for width 5 but can be easily derived for any width
</Note>


So heres how I generate rays

```nix
 /**
  a % b
*/
modulo = a: b: a - b * builtins.floor (a / b);


/** 
  A ray is an attrset with
  {
   offsets =  <offset idxs>;
   allowed = idx => boolean. Returns true if the full ray can be cast starting at that idx;
  };
*/
getRays = { width, height }:
  let
    getCol = idx: modulo idx width;
    getRow = idx: idx / width;
    horizontal = {
      offsets = builtins.genList (i: i) 4;
      allowed = idx: (getCol idx) <= width - 4;
    };
    vertical = {
      offsets = builtins.genList (i: i * width) 4;
      allowed = idx: (getRow idx) <= height - 4;
    };
    diagSE = {
      offsets = builtins.genList (i: i * (width + 1)) 4;
      allowed = idx: ((getRow idx) <= height - 4) && (getCol idx) <= width - 4;
    };
    diagSW = {
      offsets = builtins.genList (i: i * (width - 1)) 4;
      allowed = idx: ((getRow idx) <= height - 4) && (getCol idx) >= 3;
    };
  in
  {
    inherit horizontal vertical diagSE diagSW;
    all = [ horizontal vertical diagSE diagSW ];
  };
```

This is a little complicated but basically i treat a ray as an attsert with an `offsets` field and an `allowed` field. 

The `offsets` field is a list of index offsets to add to a given cell to get the cells that ray hits when starting at that index.
I use [builtins.genList](https://noogle.dev/f/builtins/genList) to generate the offsets. `genList fn n` is like doing this in haskell
```haskell
take n (map fn [0 ..])
```
it lets you generate a list with a given length, the fn is called with `0,1..n` to generate the returned list.


the `allowed` field is a function that checks if a ray is valid to be sent from that cell. For example if you are on the last cell of a row, 
casting a ray to the right is invalid and should return nothing


Now to actually check if a ray contains `XMAS` or `SAMX` I have
```nix
# given a ray get the list of char it matches (returns list<string> not string)
# if the ray can not be cast from this point return empty list
evalRay = { lst, ray, startIdx }:
  let
    inherit (ray) offsets allowed;
  in
  if allowed startIdx then
    builtins.map (x: builtins.elemAt lst (x + startIdx)) offsets
  else [ ];


validStrings = [ [ "X" "M" "A" "S" ] [ "S" "A" "M" "X" ] ];

rayIsMatch = { lst, ray, startIdx }@args:
  let
    rayChars = evalRay args;
  in
  builtins.length rayChars > 0 && builtins.any (x: x == rayChars) validStrings;
```

the `evalRay` func takes the lst of all cells, the ray, and the star pos. It will check if it can send the ray, 
then it will lookup the chars at the given offsets and return it back. 

`rayisMatch` just checks if the result of `evalRay` is one of the two we want in `validStrings`.


We can then pull it all together with 

```nix
part0 = { text, filePath }:
  let
    parsed = parseToList text;
    inherit (parsed) width lst height;
    rays = getRays { inherit width height; };


    numHitsAtIdx = lib.imap0
      (i: v: if v != "X" && v != "S" then 0 else
      (
        lib.lists.count (ray: rayIsMatch { inherit ray lst; startIdx = i; }) rays.all
      ))
      lst;

    numMatches = lib.lists.foldl' builtins.add 0 numHitsAtIdx;
  in
  numMatches;
```

and it works!
I should really start making my own "lib" for things like `lib.lists.foldl' builtins.add 0 <lst>` I've done that like 5 times now...

## Part 02

Part 02 mixes it up a bit you now need to find sections of the input that make an X of `MAS`...

I think I could adapt my ray approach but probably more effort than it worth...

My current idea is to just scan the input for any `A`, than ill look at the "corners" 
of the A to see if its the center of a valid X shape.

At the very least I can keep the same parsing logic to not start completely over..


First we need to get all the valid `A` indicies. 
We only need to check `A`s not on the edge of the input since any on the edge could not be the center of an X.

```nix
coordToIndex = { x, y, width }:
    x + (y * width);

xVals = lib.lists.range 1 (width - 2);
yVals = lib.lists.range 1 (height - 2);


coordsToCheck = lib.cartesianProduct { x = xVals; y = yVals; };
idxsToCheck = builtins.map ({ x, y }: coordToIndex { inherit x y width; }) coordsToCheck;

AIdxs = builtins.filter (idx: builtins.elemAt lst idx == "A") idxsToCheck;
```

The main workhorse here is [lib.cartesianProduct](https://noogle.dev/f/lib/cartesianProduct). I give it all the X cords not on and edge and same for Y cords. 
It will combine all them together in a list of `{x,y}` pairs. Using my `coordToIndex` helper, I get the index back,
then we can finally filter down to just As by doing a lookup on all those indices.


Then to check if its the right looking X we can do the following


```nix
NWSECorners = [
  (-width - 1)
  (width + 1)
];
NESWCorners = [
  (-width + 1)
  (width - 1)
];

cornerPairs = [ NWSECorners NESWCorners ];

validPairs = [ [ "M" "S" ] [ "S" "M" ] ];


# assumes idx is not on the edge of the input and is an A
isXmas = idx:
  let
    evalOffset = offsets: builtins.map (x: builtins.elemAt lst (x + idx)) offsets;

    cornerIsValid = cornerOffset:
      let
        evaled = evalOffset cornerOffset;
      in
      builtins.elem evaled validPairs;
  in
  builtins.all cornerIsValid cornerPairs;
```

Here I do similar logic to the rays from part 1 were i have a list of index offsets to get the corners around the center point.
I only need to make sure each diagonal is the correct shape so i track each separately. Once I eval the offsets 
I can make sure its a valid corner pair with `builtins.elem evaled validPairs` to make sure its either `[ "M" "S" ]` or ` [ "S" "M" ] `

Finally we do 

```nix
lib.lists.count isXmas AIdxs;
```

and we are done with day 4!


I didn't feel too limited by nix for this problem. 
Having a good type system would probably have helped a bit but its simple enough for now to handle without.



# Day 05
[puzzle link](https://adventofcode.com/2024/day/5)


This feels like one of those problems that can take forver to compute if you don't think hard enough. It doesnt seem to horrible though so first lets parse...

## Part 01

Another common input format I've seen in AOC is the input having different "sections" separated by an empty line.
So I'm gonna start making my own helper lib file if this format shows up in a future day.

```nix
splitEmptyLine = text:
let
  lines = (lib.strings.splitString "\n" (lib.strings.trim text));

  addIfNonEmpty = { acc, lst }:
    if builtins.length lst > 0 then acc ++ [ lst ] else acc;

  reducer = { currLst, acc }: line:
    if line == "" then {
      currLst = [ ];
      acc = addIfNonEmpty { inherit acc; lst = currLst; };
    } else {
      inherit acc;
      currLst = currLst ++ [ line ];
    };

  reduced = builtins.foldl' reducer { currLst = [ ]; acc = [ ]; } lines;

in
addIfNonEmpty { acc = reduced.acc; lst = reduced.currLst; };
```

The core of this is the reducer that goes over each line, it builds up a lists of each line it sees. 
When it gets to an empty line it will add it to a bigger list `acc` of each section of the input.
I need to do one last add to the `acc` list after reducing if we were in the middle of parsing the final section still.


### Handling the Rules

I think to do this problem efficiently you need to transform the ordering pairs into an actual ordered list of all the numbers.
Suprisingly, the std lib has [lib.toposort](https://noogle.dev/f/lib/toposort) which does a topological sort that should get us are sorted list
(I hope). It says is an `n^2` implementation so it might bite me later but we can cross that when we get to it.

So first we need to parse the rules some more, we don't need to do anything crazy at first
```nix
parseRule = ruleStr:
  let
    numStrs = lib.strings.splitString "|" ruleStr;
  in
  {
    less = builtins.head numStrs;
    greater = lib.last numStrs;
  };
```

Im leaving the numbers as strings since I plan on making them keys in an attr set and conversion can make that annoying.


Now to make it easier to lookup the rules I want to group them together in a structure like this 

```
{
  <aNum>  = <Nums the key is less than>
}
```

This should allow for easier lookup of the rules than iterating over each pair.

To do that we can use [groupBy'](https://noogle.dev/f/lib/groupBy%27)
```nix
rules = builtins.map parseRule ruleLines;

# attr set where key is a number, the values are the numbers its less than
ruleMap = lib.lists.groupBy' (lst: x: lst ++ [ x.greater ]) [ ] (x: x.less) rules;

getOrDefault = { key, default, attrs }:
    if builtins.hasAttr key attrs then builtins.getAttr key attrs else default;

getMapping = x: getOrDefault { key = x; attrs = ruleMap; default = [ ]; };
```

The groupby call with group by the `less` field of each rule, on collisions it will 
append the `greater` field to the list of other `greater`s we saw for that key already.

The `getMapping` func is a helper that lets lookup a key in an attrset and get a default value if its not set.

I can than use this to make my own partial comparison func

```nix
compare = a: b:
  let
    aLessThans = getMapping a;
    bLessThans = getMapping b;
  in
  # a is less than b
  if (builtins.elem b aLessThans) then true else
  # b is less than a
  if (builtins.elem a bLessThans) then false else
  # we don't know the ordering
  null
;
```

Here we get the mappings for both values. If we have a hit for this pair we can now for sure the ordering relation. If not we return null.

### Sorting

My initial idea was to sort all the numbers in the `ruleMap` into a list using [lib.toposort](https://noogle.dev/f/lib/toposort) 
and than use that to help check if the update lists are sorted. My assumption was doing the sort once would be faster than sorting each list.
This ran into a problem on the real puzzle input, it looks like the rules can have cycles! This caused toposort to return an error and not be able to sort.

So instead I changed my approach to toposort each update list to see if its already sorted correctly.


```nix
isValidUpdate = { updateLst, compareFn }:
let
  sortRes = lib.toposort compareFn updateLst;
  sorted = if builtins.hasAttr "result" sortRes then sortRes.result else throw "invalid topo call";
in
sorted == updateLst;
```

this func uses toposort to sort the input list and return true if it matches the what was given (ie it was sorted already).

One thing to note is toposort when successful will return something like `{result = <sorted lst>}`, if there were cycles it would return info on that.
So if we dont have `result` I throw an error.


We can than pull it all together with

```nix
part0 = { text, filePath }:
let
  inherit (parseInput text) updates compareFn;

  validUpdates = builtins.filter (updateLst: isValidUpdate { inherit updateLst compareFn; }) updates;

  middleNums = builtins.map (lst: lib.strings.toIntBase10 (getMiddle lst)) validUpdates;

  sum = myLib.sumList middleNums;
in
sum;
```
and part 1 is done!

<Note>
Im starting to build up `myLib` which is just a bunch of helper funcs I've used a few times.

I'll start skipping over the details on those if I feel its not interesting, 
code lives [here](https://github.com/JRMurr/AdventOfCode2024/blob/main/myLib/default.nix) if you want to see them
</Note>

## Part 02

We are setup for success on part 2. We need to sort the invalid lists and do the same middle number summing.

My impl almost does all this already so we only need a few small changes.

```nix
isValidUpdate = { updateLst, compareFn }:
  let
    sortRes = lib.toposort compareFn updateLst;
    sorted = if builtins.hasAttr "result" sortRes then sortRes.result else throw "invalid topo call";
    isSorted = sorted == updateLst;
  in
  { inherit isSorted sorted; };
```

now `isValidUpdate` returns if it was already sorted and the sorted list. This way we can grab the invalid lists and get them sorted more easily.

and we can mostly copy the part0 func to get the invalid updates

```nix
part1 = { text, filePath }:
let
  inherit (parseInput text) updates compareFn;

  sortedWithChecks = builtins.map (updateLst: (isValidUpdate { inherit updateLst compareFn; })) updates;

  invalidUpdates = builtins.filter (x: !x.isSorted) sortedWithChecks;

  sortedInvalids = builtins.map (x: x.sorted) invalidUpdates;

  middleNums = builtins.map (lst: lib.strings.toIntBase10 (getMiddle lst)) sortedInvalids;

  sum = myLib.sumList middleNums;
in
sum;
```

and day 05 is done!


Honestly very surprised how easy this turned out to be. topoSort helped a lot, it somewhat makes sense nix has this in the std lib.
The example showed up dealing with file system paths which probably has a lot of uses in nixpkgs and nixos.



# Day 06

## Part 01


## Part 02