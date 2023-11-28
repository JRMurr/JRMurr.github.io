---
title: Efficient Nix Derivations with File Sets

date: 2023-11-28T02:00:53.711Z

tags: ['nix', 'nix-pkgs']

draft: false

summary: Using nix's new file set API to make efficient derivations

images: []

layout: PostLayout
---

If you are using Nix to build your own packages you will eventually come across something like

```nix
stdenv.mkDerivation {
    name = "my awesome pkg";
    src = ./.;
    buildPhase = ''
        # I have no idea if this actually works (the gcc call bit)
        # but the vibe is what I care about
        gcc main.c -o my_program
        mkdir -p $out
        cp my_program $out
    '';
}
```

The issue with the above is setting `src = ./.`, which makes **ALL** of the current directory an input to the derivation.
So if you have a readme file in this folder, changing that will cause this derivation to rebuild.

The build only really cares about `main.c` in this case so what can we do to fix this?

TODO: link out to docs at least for old ways? Or maybe just tweag blog

Back in the dark dark times of pre-Nixos 23.11, there were ways to do this kind of filtering but IMO they were kinda confusing and
I never quite got it to work right so I just stuck with `src = ./.`

Now with 23.11 we have [filesets](https://nix.dev/tutorials/file-sets), which makes filtering and adding files much simpler.

## What are file sets

TODO: links + make sure example works
I would recommend checking out the docs or official tutorial, but for a TLDR, you can do the following

```nix
let
    fs = pkgs.lib.fileset;
    baseSrc = fs.unions [ ./Makefile ./src ];
    filterMarkdownFiles = fs.fileFilter (file: hasSuffix ".md" file.name) ./.;
    removedMarkedDown = fs.difference baseSrc filterMarkdownFiles;
in
stdenv.mkDerivation {
    name = "my awesome pkg";
    src = fs.toSource {
        root = ./.;
        fileset = removedMarkedDown;
    };
    buildPhase = ''
       # call make or w/e you want
    '';
}
```

Now with this setup, we have a "base" file set of `[ ./Makefile ./src ]` then with `fs.difference` we can remove all files that are markdown with the `filterMarkdownFiles` filter.

## A Real Example

Recently I started messing around with the language [Roc](https://www.roc-lang.org/). If you haven't heard about it is a new functional language that's heavily inspired by Elm.
It is fast but also very nice to use (though many rough edges since it is pre-0.1.0).

One of its interesting ideas is that Roc needs your app to pick what [platform](https://www.roc-lang.org/platforms) to run on.
A platform would be written in something like rust, zig, c, etc.
The platform provides roc APIs for things like managing memory, making network requests, printing to stdout, and other IO-like actions.
Right now the two most widely used are a [cli platform](https://github.com/roc-lang/basic-cli) and [webserver platform](https://github.com/roc-lang/basic-webserver)

This is really neat but brings an issue for developing a platform along with the roc code needed to define the platform API.
You need to compile the "platform code" (ie rust + some c), do w/e linking is needed for that, then distribute that with the roc source code.

For example, [this](https://github.com/roc-lang/roc/tree/main/examples/platform-switching/rust-platform) is one of the sample platforms

```shell
❯ exa --tree --level 2
.
├── Cargo.lock
├── Cargo.toml
├── host.c
├── main.roc
├── rust-toolchain.toml
└── src
   ├── glue.rs
   ├── lib.rs
   └── main.rs
```

To build this platform you need to run a `cargo build --lib ...` on the rust code, compile the `host.c` file,
link those two object files together, and then finally distribute the linked object file with the roc code.

so after all those steps, it should look something like

```shell
❯ exa --tree <compiled folder>
<compiled folder>
├── linux-x64.o
└── main.roc
```

The naive approach would probably be something like

```nix
let
compiledC = mkDerivation {
    src = ./.;
    # compile the c ...
};
rustBuiltLib = buildRustPackage {
    src = ./.;
    # build the rust
};
in
llvmPkgs.stdenv.mkDerivation rec {
  name = "${pname}-${version}";
  srcs = [
    rustBuiltLib
    compiledC
    ./. # for the roc code
  ];
  sourceRoot = ".";
  buildPhase = ''
    # link the rust and c files
    # copy roc and linked object out
  '';
}
```

while this works, it also sucks. **ANY** change to the files will cause all 3 derivations to be rebuilt.

Now with filesets we can be all cute and fancy

<Note>
This example will have many parts omitted to keep the code easy to follow. 
To see the real code, look at my [roc2nix repo](https://github.com/JRMurr/roc2nix/blob/main/lib/platformBuilders/buildRustPlatform.nix) where this came from
</Note>
First let's define a helper file for filtering files based on their extension

TODO: name this file languageFilters.nix

```nix
{lib}:

# Note i generally don't like doing `with` at the top of a file
# but since this will be only fileSet stuff it should be fine
with lib.fileset;

let
    # helper func to take in a list of allowed
    # returns a function of `file => bool` to be used in a fileFilter.
    # true if file has suffix, false if not
    fileHasAnySuffix = fileSuffixes: file: (lib.lists.any (s: lib.hasSuffix s file.name) fileSuffixes);

    # given a basePath src path, return a fileset of files in that path that are rust files, toml files, or cargo toml/lock
    rustFilter = basePath: (
        let
        mainFilter = fileFilter
            (fileHasAnySuffix [ ".rs" ".toml" ])
            basePath;
        in
        unions [ mainFilter (basePath + "/Cargo.toml") (basePath + "/Cargo.lock") ]
    );

    # given a basePath src path return a fileset with files ending with `.c`
    cFilter = basePath: fileFilter (fileHasAnySuffix [ ".c" ]) basePath;

    # given a basePath src path return a fileset with files ending with `.roc`
    rocFilter = basePath: fileFilter (fileHasAnySuffix [ ".roc" ]) basePath;
in
{
  inherit rustFilter cFilter rocFilter;
}
```

Now with that helper, we can do

TODO: name this buildRustPlatform.nix

```nix
let
fs = lib.fileset;
languageFilters = import ./languageFilters.nix {inherit lib;};

baseDir = ./.;


compiledC = mkDerivation {
    src = fs.toSource {
        root = baseDir;
        fileset = languageFilters.cFilter baseDir;
    };
    # compile the c ...
};
rustBuiltLib = buildRustPackage {
    src = fs.toSource {
      root = baseDir;
      fileset = languageFilters.rustFilter baseDir;
    };
    # build the rust
};
rocCode = fs.toSource {
    root = baseDir;
    fileset = languageFilters.rocFilter baseDir;
};
in
llvmPkgs.stdenv.mkDerivation rec {
  name = "${pname}-${version}";
  srcs = [
    rustBuiltLib
    compiledC
    rocCode
  ];
  sourceRoot = ".";
  buildPhase = ''
    # NOTE: this link could be pulled into its own derivation for even better seperation
    # I only just realized this while making this post...
    $LD -r -L ${rustBuildName}/lib ${cBuildName}/${cHostDest} -lhost -o ${host_dest}

    mkdir -p $out
    cp ${host_dest} $out/${host_dest}
    cp -r ${rocCode}/. $out
  '';
}
```

Now this is about as good as you can get.
The rust and c builds have no dependency on each other so you are free to modify the c without needing to rebuild the rust.

If you only change the roc code, you won't need to do any build (other than linking but in this example that could also be pulled out..).

## Wrap up

Huge shoutout to [Silvan Mosberger](https://github.com/infinisil) for bringing file sets to the main Nix library.

I hope this will help make it easy to make efficient derivations and `*2nix` builders like `roc2nix` be as efficient as if you rolled it yourself.

I had a lot of fun working on [roc2nix](https://github.com/JRMurr/roc2nix/), it was my first time making a "real" nix library and I learned a lot along the way (not just file sets).
If you are interested in learning more about it check out the repo or let me know in the comments and I might make a separate blog diving into that (and hopefully some blogs on roc itself).
