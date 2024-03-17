---
title: Building Typescript Node Apps With Nix
slig: building-typescript-node-apps-with-nix
date: 2022-09-06T23:57:55.477Z
tags: ['nix', 'typescript', 'node']
draft: false
summary: Trying some different nix builders for typescript node apps
images: []
layout: PostSimple
---

<TOCInline toc={props.toc} asDisclosure />

## Being a Nix Stan

I recently accepted that I am obsessed with Nix. Ask any remotely technical person with a pulse, and they can probably mention at least 10 times I've told them "But with nix X is way easier/a nonissue" (same with rust, but that's for another day...).

The issue is, that I am a bit of a poser. I've been using Nix on/off for about 2.5 years but only seriously for the last 10ish months.
I've mostly just consumed existing NixOS modules, nix packages, setup basic nix-shells/flakes, and relatively simple Nix builders. All of these uses of Nix were pretty great, and it made my life easier, but it only went so far as to solve some of the challenges I come across in my projects/work.

During my initial nix learning phase, I came across `node2nix` but the codegen step made me think that node and nix just don't get along well, and I never looked further.
My job primarily involves node web servers written in typescript. All I've done with Nix so far at work is set up basic dev environments with node. While it did make our README(s) a little nicer, it does not solve our issues in actually deploying our apps.
Now that I got over the initial hump of adding nix to some of our processes, it's time to make it even better!

If you are not familiar with Nix, [this post](/blog/rust-enviorment-and-docker-build-with-nix-flakes) goes over the basics of Nix and builds a basic Rust app.

## The APP

The source code for the app is [here](https://github.com/JRMurr/example-ts-node-nix)

First I need a basic app to build. I have been using [Fastify](https://www.fastify.io/) recently, so I will attempt to build this basic web server.

```ts:index.ts
#!/usr/bin/env node

import fastify from "fastify";

const server = fastify();

server.get("/ping", async (_request, _reply) => {
  return "pong\n";
});

server.listen({ host: "0.0.0.0", port: 8080 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
```

One important note about the `index.ts` file is the node shebang at the top. This will allow this file to act as a binary/entry point for the server.

I also added a strict tsconfig that outputs to `./dist` and a package.json that looks like

```json:package.json
{
  "name": "example-node-nix",
  "version": "1.0.0",
  "main": "dist/index.js",
  "bin": {
    "example-node-nix": "dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
  },
  "license": "MIT",
  "dependencies": {
    "fastify": "^4.5.3"
  },
  "devDependencies": {
    "@tsconfig/node16": "^1.0.1",
    "@tsconfig/node16-strictest": "^1.0.0",
    "@types/node": "^18.7.14",
    "typescript": "^4.8.2"
  }
}
```

I made a simple `flake.nix` to set up Node then ran

```sh
$ npm run build
$ npm run start
```

The server is up and is responding.

## Nix Builds

Like usual with nix I first try to see if other people have figured this out already, looking at the [nixpkgs JS docs](https://nixos.org/manual/nixpkgs/stable/#language-javascript), it mentions a few builders like `mkYarnPackage`, [node2nix](https://github.com/svanderburg/node2nix), [npmlock2nix](https://github.com/nix-community/npmlock2nix), and [nix-npm-buildpackage](https://github.com/serokell/nix-npm-buildpackage). These all seemed fine, but I couldn't find any good typescript examples, or the docs were a little lacking to get started. So I figured why not just do it the dumb way to start and do it manually, what's the worst that can happen?

### The Standard Environment

[stdenv.mkDerivation](https://nixos.org/manual/nixpkgs/stable/#sec-using-stdenv) is what most "high-level" builders wrap. It provides you with a sandbox environment with some common programs like `coreutils`, `grep`, `awk`, `make`, etc., to build a program. It is very versatile and surprisingly easy to use once you get comfortable with its ideas. I was hopeful I could throw something together, so to start I just focused on the `buildPhase` and a very basic `installPhase` to verify everything was built, I would deal with running it later.

```nix:flake.nix
{
  description = "Sample Nix ts-node build";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    gitignore = {
      url = "github:hercules-ci/gitignore.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, gitignore, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs-16_x;

        # NOTE: this does not work
        appBuild = pkgs.stdenv.mkDerivation {
          name = "example-ts-node";
          version = "0.1.0";
          src = gitignore.lib.gitignoreSource ./.; # uses the gitignore in the repo to only copy files git would see
          buildInputs = [ nodejs ];
          # https://nixos.org/manual/nixpkgs/stable/#sec-stdenv-phases
          buildPhase = ''
            # each phase has pre/postHooks. When you make your own phase be sure to still call the hooks
            runHook preBuild

            npm ci
            npm run build

            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall

            cp -r node_modules $out/node_modules
            cp package.json $out/package.json
            cp -r dist $out/dist

            runHook postInstall
          '';
        };

      in with pkgs; {
        defaultPackage = appBuild;
        devShell = mkShell { buildInputs = [ nodejs ]; };
      });
}
```

I tried `nix build` but I got this error

```
error: builder for '/nix/store/7lis43p7zj10y2cf6inzicjdgzc3b5qs-example-ts-node.drv' failed with exit code 1;
       last 10 log lines:
       > no configure script, doing nothing
       > building
       > npm ERR! code EAI_AGAINler: sill audit bulk request {[0m
       > npm ERR! syscall getaddrinfo
       > npm ERR! errno EAI_AGAIN
       > npm ERR! request to https://registry.npmjs.org/yallist/-/yallist-4.0.0.tgz failed, reason: getaddrinfo EAI_AGAIN registry.npmjs.org
       >
       > npm ERR! Log files were not written due to an error writing to the directory: /homeless-shelter/.npm/_logs
       > npm ERR! You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
       >
       For full logs, run 'nix log /nix/store/7lis43p7zj10y2cf6inzicjdgzc3b5qs-example-ts-node.drv'.
```

The error `getaddrinfo EAI_AGAIN registry.npmjs.org` is a failure to connect to the NPM registry to install the dependencies. What I failed to realize is that the nix sandbox would block outside requests in the builder since they are not fully reproducible. You can disable the nix sandbox, but that would be gross. So time to try one of these builders.

### node2nix

Of all the builders I've seen so far [node2nix](https://github.com/svanderburg/node2nix) seemed like the most mature. It's used in the [official nixpkgs repo](https://github.com/NixOS/nixpkgs/tree/master/pkgs/development/node-packages). At a high level `node2nix` will parse your `package.json` or `package-lock.json` and do code-gen to give you nix files that use [fetchers](https://ryantm.github.io/nixpkgs/builders/fetchers/) to download all `node_modules` and build your node app.

You can install `node2nix` from `nixpkgs` as `pkgs.node2nix`. To run it I have this script

```sh:runNode2Nix.sh
#!/usr/bin/env bash

# You need to re-run this file anytime your package/package-lock.json changes

node2nix -16 --development \
    --input package.json \
    --lock package-lock.json \
    # Put all generated code in the `./nix` directory
    --node-env ./nix/node-env.nix \
    --composition ./nix/default.nix \
    --output ./nix/node-package.nix
```

While node2nix does have helpers in `node-env.nix` to build a node package, those only really run `npm install`, to call our `npm run build` step. Thankfully as described [here](https://github.com/svanderburg/node2nix#using-the-nodejs-environment-in-other-nix-derivations) `node2nix` exposes an output of just the `node_modules` of the dependencies, allowing us to make our own derivation.

```nix:flake.nix
{
  description = "Sample Nix ts-node build";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    gitignore = {
      url = "github:hercules-ci/gitignore.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, gitignore, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs-16_x;

        node2nixOutput = import ./nix { inherit pkgs nodejs system; };
        # NOTE: may want to try https://github.com/svanderburg/node2nix/issues/301 to limit rebuilds
        nodeDeps = node2nixOutput.nodeDependencies;
        app = pkgs.stdenv.mkDerivation {
          name = "example-ts-node";
          version = "0.1.0";
          src = gitignore.lib.gitignoreSource ./.;
          buildInputs = [ nodejs ];
          buildPhase = ''
            runHook preBuild

            # symlink the generated node deps to the current directory for building
            ln -sf ${nodeDeps}/lib/node_modules ./node_modules
            export PATH="${nodeDeps}/bin:$PATH"

            npm run build

            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall

            # Note: you need some sort of `mkdir` on $out for any of the following commands to work
            mkdir -p $out/bin

            # copy only whats needed for running the built app
            cp package.json $out/package.json
            cp -r dist $out/dist
            ln -sf ${nodeDeps}/lib/node_modules $out/node_modules

            # copy entry point, in this case our index.ts has the node shebang
            # nix will patch the shebang to be the node version specified in buildInputs
            # you could also copy in a script that is basically `npm run start`
            cp dist/index.js $out/bin/example-ts-nix
            chmod a+x $out/bin/example-ts-nix

            runHook postInstall
          '';
        };
      in with pkgs; {
        defaultPackage = app;
        devShell = mkShell { buildInputs = [ nodejs node2nix ]; };
      });
}

```

After running `nix build`, the output will be symlinked to `./result` in my case it looks like

```sh
$ exa --tree --level 3 ./result/
./result
├── bin
│  └── example-ts-nix
├── dist
│  └── index.js
├── node_modules -> /nix/store/fdzk00z6bmw50mfqv124lgn9fzjhd7yw-node-dependencies-example-node-nix-1.0.0/lib/node_modules
└── package.json
```

To verify the app worked you can run `./result/bin/example-ts-nix`.

While at first this looks like a lot It's pretty straightforward. `node2nixOutput = import ./nix { inherit pkgs nodejs system; };` calls the generated `default.nix` which exposes many outputs for building. In our case we only use `nodeDeps = node2nixOutput.nodeDependencies;`.

The `buildPhase` just symlinks the generated `nodeDependencies` and builds the app. The `installPhase` copies the built output into the final derivation. If you are familiar with docker files this is sorta like having a build layer than a final layer to copy the outputs to.
One thing nix does for you is patch shebangs to reference the `buildInputs` of the derivation, in this case, if you run

```sh
$ cat ./result/bin/example-ts-nix
#!/nix/store/6cdccplrjwga5rd3b2s7xb8zd25hnsix-nodejs-16.17.0/bin/node
"use strict";
...
```

It changed `#!/usr/bin/env node` to `#!/nix/store/6cdccplrjwga5rd3b2s7xb8zd25hnsix-nodejs-16.17.0/bin/node` for us automatically.

**node2nix Pros**

- Simple to follow the build process
- Somewhat easy to customize
- Has support for custom registries/private git repos

**node2nix Cons**

- Having to re-run `node2nix` on package.json changes is annoying
- The generated outputs seem to re-build too often, see [here](https://github.com/svanderburg/node2nix/issues/301)
- With the current setup, the final build is still using the development `node_modules` which is wasteful

Overall I think `node2nix` is a good start for most node apps. Since it's all mostly code-gen It's easy to follow what's going on. I've come across [this template](https://github.com/MatrixAI/TypeScript-Demo-Lib-Native) which seems to have figured out to work around some cons listed, but I have not tried it yet so your mileage may vary.

### dream2nix

[dream2nix](https://github.com/nix-community/dream2nix) says it's "A framework for automated nix packaging" by mostly standardizing the many "2nix" tools. The [docs](https://nix-community.github.io/dream2nix/) list Rust, Haskell, Python, and Node builders.
For whatever reason I have been skeptical of dream2nix. It looked "too good to be true" so I never really gave it a fair shake. Better late than never, let's try it

```nix:flake.nix
{
  description = "Sample Nix ts-node build";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    gitignore = {
      url = "github:hercules-ci/gitignore.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    dream2nix.url = "github:nix-community/dream2nix";
  };

  outputs = { self, nixpkgs, flake-utils, gitignore, dream2nix, ... }:
    # Note: no need for flake-utils.lib.eachDefaultSystem, dream2nix does it for us
    dream2nix.lib.makeFlakeOutputs {
      systems = flake-utils.lib.defaultSystems;
      config.projectRoot = ./.;
      source = gitignore.lib.gitignoreSource ./.;
    };
}
```

The core idea of dream2nix is that it will find you package.json/package-lock.json to figure out what node deps you need and how to build `npm run build` or w/e else. You can customize it but for most apps, this should "just work".

Running `nix flake show` returns

```
git+file:///home/jr/code/node/example-node-nix
├───devShell
│   ├───aarch64-darwin: development environment 'nix-shell'
│   ├───aarch64-linux: development environment 'nix-shell'
│   ├───i686-linux: development environment 'nix-shell'
│   ├───x86_64-darwin: development environment 'nix-shell'
│   └───x86_64-linux: development environment 'nix-shell'
├───devShells
│   ├───aarch64-darwin
│   │   ├───default: development environment 'nix-shell'
│   │   └───example-node-nix: development environment 'nix-shell'
│   ├───aarch64-linux
│   │   ├───default: development environment 'nix-shell'
│   │   └───example-node-nix: development environment 'nix-shell'
│   ├───i686-linux
│   │   ├───default: development environment 'nix-shell'
│   │   └───example-node-nix: development environment 'nix-shell'
│   ├───x86_64-darwin
│   │   ├───default: development environment 'nix-shell'
│   │   └───example-node-nix: development environment 'nix-shell'
│   └───x86_64-linux
│       ├───default: development environment 'nix-shell'
│       └───example-node-nix: development environment 'nix-shell'
├───packages
│   ├───aarch64-darwin
│   │   ├───default: package 'example-node-nix-1.0.0'
│   │   ├───example-node-nix: package 'example-node-nix-1.0.0'
│   │   └───resolveImpure: package 'resolve'
│   ├───aarch64-linux
│   │   ├───default: package 'example-node-nix-1.0.0'
│   │   ├───example-node-nix: package 'example-node-nix-1.0.0'
│   │   └───resolveImpure: package 'resolve'
│   ├───i686-linux
│   │   ├───default: package 'example-node-nix-1.0.0'
│   │   ├───example-node-nix: package 'example-node-nix-1.0.0'
│   │   └───resolveImpure: package 'resolve'
│   ├───x86_64-darwin
│   │   ├───default: package 'example-node-nix-1.0.0'
│   │   ├───example-node-nix: package 'example-node-nix-1.0.0'
│   │   └───resolveImpure: package 'resolve'
│   └───x86_64-linux
│       ├───default: package 'example-node-nix-1.0.0'
│       ├───example-node-nix: package 'example-node-nix-1.0.0'
│       └───resolveImpure: package 'resolve'
└───projectsJson: unknown
```

dream2nix gave us a dev shell and package build for us, neat. Expecting something to break I ran `nix build` to build the app and got no errors. Looking at `./result` gives

```sh
$ exa --tree --level 3 ./result/
./result
├── bin
│  └── ts-node-nix -> ../lib/node_modules/example-node-nix/dist/index.js
└── lib
   └── node_modules
      └── example-node-nix
```

`ts-node-nix` is a compiled javascript file with the right shebang. Still somewhat shocked running `./result/bin/ts-node-nix` ran the server, and it worked!

This is simply wild, I really expected something to break here and require a manual build step of some kind. One nice thing to note is the [node dev shell](https://nix-community.github.io/dream2nix/guides/getting-started-nodejs.html#development-shell) it gives will copy over the `node_modules` folder for you so you don't need to manually run `npm install`.

To limit my excitement a bit this is a simple build. I need to investigate how well it works with more complicated builds with native node add-ons, mono repo tools like NX, etc. Though the examples in the [README](https://github.com/nix-community/dream2nix#test-the-experimental-version-of-dream2nix) seem promising to allow for easily overriding the builds.

**dream2nix Pros**

- very little code to set up
- generated dev shell is really nice

**dream2nix Cons**

- A bit of a "black box" which could make debugging harder
- It seems to include the full development dependencies in the output

## Conclusion

I came into this thinking building ts node apps with nix would be a pain, and I'm happily surprised it is not. While `node2nix` may be good for highly customizable builds, `dream2nix` is just a delight. I haven't come across a nix utility that just worked like that with minimal messing around.

I've been meaning to give [napi-rs](https://napi.rs/) a shot, so maybe that will be a good test case to see how well `dream2nix` builds rust projects and native node add-ons all in one.

Since you made it to the end here's a `dream2nix` example with a docker build

```nix:flake.nix
{
  description = "Sample Nix ts-node build";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    gitignore = {
      url = "github:hercules-ci/gitignore.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    dream2nix.url = "github:nix-community/dream2nix";
  };

  outputs = { self, nixpkgs, flake-utils, gitignore, dream2nix, ... }:
    let
      dream2nixOutputs = dream2nix.lib.makeFlakeOutputs {
        systems = flake-utils.lib.defaultSystems;
        config.projectRoot = ./.;
        source = gitignore.lib.gitignoreSource ./.;
      };
      customOutput = flake-utils.lib.eachDefaultSystem (system:
        let
          pkgs = import nixpkgs { inherit system; };
          # the dream2nix output for this system
          app = dream2nixOutputs.packages."${system}".example-node-nix;
        in with pkgs; {
          packages.docker = dockerTools.buildImage {
            name = app.packageName;
            copyToRoot = pkgs.buildEnv {
              name = app.packageName;
              paths = [ app ];
              pathsToLink = [ "/bin" "/lib" ];
            };

            # This ensures symlinks to directories are preserved in the image
            keepContentsDirlinks = true;
            config = { Cmd = [ "/bin/ts-node-nix" ]; };
          };
        });

      # deep merge outputs together
    in nixpkgs.lib.recursiveUpdate dream2nixOutputs customOutput;
}
```

You can then run `nix build .#docker` and then run `docker load < result` to load the image into docker. See [here](/blog/rust-enviorment-and-docker-build-with-nix-flakes) for some more info on nix docker builds.
