---
title: Building Typescript Node Apps With Nix
date: 2022-09-05T23:57:55.477Z
tags: ['nix', 'typescript', 'node']
draft: false
summary: Trying some different nix builders for ts node apps
images: []
layout: PostLayout
---

<TOCInline toc={props.toc} asDisclosure />

## Being a Poser Shill

I recently accepted that I am obsessed with nix. Ask anyone with a remotely technical person with a pulse, and they can probably mention at least 10 times I've told them "but with nix X is way easier/a non issue" (same with rust, but that's for another day...). I love being a shill, it makes for easy punchlines and I get the smug sense of superiority that everyone dreams of.

The issue is, I'm a bit of a poser. I've been using Nix on/off for about 2.5 years but only seriously for the last 10 months.
I've mostly just consumed existing NixOS modules, nix packages, setup basic nix-shells/flakes, and relatively simple nix builders ([like for rust/docker images](/blog/rust-enviorment-and-docker-build-with-nix-flakes)). All of these uses of nix where pretty great, and it definitely made my life easier, but it only went so far to solve some of the challenges I come across in my personal projects/work.

My job primarily involves node web servers written in typescript. All I've done with nix so far at work is set up basic dev environments with node. While it did make our README(s) a little nicer, does not really solve our issues in actually deploying our apps yet. So I decided to become more than just a shill, I need to try to force even more complicated nix builds in front of everyone. Surely then they will realize I was right?

## The APP

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

I made a simple `flake.nix` to set up node then ran

```sh
$ npm run build
$ npm run start
```

The sever is up and is responding.

## Nix Builds

Like usual with nix I first try to see if other people have figured this out already, looking at the [nixpkgs JS docs](https://nixos.org/manual/nixpkgs/stable/#language-javascript), it mentions a few builders like `mkYarnPackage`, [node2nix](https://github.com/svanderburg/node2nix), [npmlock2nix](https://github.com/nix-community/npmlock2nix), and [nix-npm-buildpackage](https://github.com/serokell/nix-npm-buildpackage). These all seemed fine but I couldnt find any good typescript example, or the docs were a little lacking to get started. So I figured why not just do it the dumb way to start and do it manually, what's the worst that can happen?

### The Standard Environment

[stdenv.mkDerivation](https://nixos.org/manual/nixpkgs/stable/#sec-using-stdenv) is what most "high level" builders wrap. It provides you a sandbox environment with some common programs like `coreutils`, `grep`, `awk`, `make`, etc., to build a program. It is very versatile and surprisingly easy to use once you get comfortable with its ideas. I was hopeful I could throw something together, so to start I just focused on the `buildPhase` and a very basic `installPhase` to verify everything was built, I would deal with running it later.

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

The error `getaddrinfo EAI_AGAIN registry.npmjs.org` is a failure to connect to the NPM registry to install the dependencies. What I failed to realize is that the nix sandbox would block outside requests in the builder since they are not fully reproducible. You can disable the nix sandbox, but that would make me an awful shill. So time to try one of these builders

### node2nix

Of all the builders I've seen so far [node2nix](https://github.com/svanderburg/node2nix) seemed like the most mature. It's actually used in the [official nixpkgs repo](https://github.com/NixOS/nixpkgs/tree/master/pkgs/development/node-packages). At a high level `node2nix` will parse your `package.json` or `package-lock.json` and do code-gen to give you nix files that use [fetchers](https://ryantm.github.io/nixpkgs/builders/fetchers/) to download all `node_modules` and build your node app.

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

The `buildPhase` just symlinks the generated `nodeDependencies` and builds the app. The `installPhase` copies the built output into the final derivation. If your familiar with docker files this is sorta like having a build layer than a final layer to copy the outputs to.
One thing nix does for you is patch shebangs to reference the `buildInputs` of the derivation, in this case if you run

```sh
$ cat ./result/bin/example-ts-nix
#!/nix/store/6cdccplrjwga5rd3b2s7xb8zd25hnsix-nodejs-16.17.0/bin/node
"use strict";
...
```

It changed `#!/usr/bin/env node` to `#!/nix/store/6cdccplrjwga5rd3b2s7xb8zd25hnsix-nodejs-16.17.0/bin/node` for us automatically.

**node2nix Pros**

- Simple to follow build process
- Somewhat easy to customize
- Has support for custom registries/private git repos

**node2nix Cons**

- Having to re-run `node2nix` on package.json changes is annoying
- The generated outputs seem to re-build too often, see [here](https://github.com/svanderburg/node2nix/issues/301)
- With the current setup the final build is still using the development `node_modules` which is wasteful

Overall I think `node2nix` is a good start for most node apps. Since its all mostly code-gen It's fast to follow what's going on. I've come across [this template](https://github.com/MatrixAI/TypeScript-Demo-Lib-Native) which seems to have figured out to work around some cons listed, but I have not tried it yet so your mileage may vary.

TODO: look into https://github.com/nix-community/dream2nix/issues/158 and https://www.reddit.com/r/NixOS/comments/vsk4vk/override_nodepackages_with_the_defaultnix_from/
