---
title: Making a PR to Nixpkgs
slug: updating-a-package-in-nixpkgs
date: 2022-08-02T03:43:05.229Z
tags: ['nix', 'rust']
draft: false
summary: My rough ramblings on how to contribute a small pr to Nixpkgs
images: []
layout: PostLayout
---

# Why

Rust-analyzer was [updated recently](https://rust-analyzer.github.io/thisweek/2022/08/01/changelog-140.html#an-update-on-proc-macros) to better support proc macros when working on nightly rust versions.
I wanted to use this change right away but since I use [NixOS](https://nixos.org/) I needed the [nix pkg repo](https://github.com/NixOS/Nixpkgs) to update its version of rust-analyzer, so I can use it properly.

Edit: You don't need to make a pr to Nixpkgs just to update a version, they are other ways such as using overlays. Majiir on reddit goes over some options [here](https://www.reddit.com/r/NixOS/comments/wec9ob/making_a_pr_to_nixpkgs/iip657n/)

Since the version in Nixpkgs was out of date I decided it was time I finally learn how to make a PR back to Nixpkgs. So what follows are my rough ramblings of the process.
Some of this is rust-analyzer/rust specific, some will be nix-build issues in general, and some will be Nixpkgs PRs in general.

# The steps

For reference [this is the PR](https://github.com/NixOS/Nixpkgs/pull/184693) I made.

## Making the branch

The normal steps when working on an open source project still apply

- Fork the GitHub repo into your account
- Clone the fork locally

For nix one of the first "weird" steps is to try to check out the commit that you are using locally with the following

```sh
$ nixos-version --hash
2b0dd45aca6a260762395ca2e94beab247f455a7
$ git checkout 2b0dd45aca6a260762395ca2e94beab247f455a7
$ git checkout -b 'bump/rust-analyzer'
```

This way your local nix build cache is as up-to-date as possible.

## Changing the nix file

This part will vary depending on the package but if your change is a version update like the one I made the steps are roughly the following.

- Update any `version`/`rev` variable to be the desired value
- change any `sha` variables to `pkgs.lib.fakeSha256;` or just `00000000000000000000000`.
  - This will cause the build to fail but will print the right SHA value.
  - There are "better" ways to get the right SHA, but this is pretty brain-dead, so I usually go this route

Once those steps are done, you can try building the package. For rust-analyzer, this is done by running the following in the root of the nixpkg repo

```sh
$ nix-build -A rust-analyzer
```

This will build `rust-analyzer` and sym-link the output to `./result`, so for my case I can run

```sh
$ ./result/bin/rust-analyzer --version
rust-analyzer 2022-08-01
```

## Testing the build

While just running `nix-build` might be fine, some pkgs have automated tests. While they will be run in CI its good practice to run them locally.

For `rust-analyzer` there is this [test-file](https://github.com/NixOS/Nixpkgs/blob/master/pkgs/development/tools/rust/rust-analyzer/test-neovim-lsp.nix) that uses neovim to verify the LSP is running as expected.

To run this test I can run

```sh
$ nix-build -A rust-analyzer-unwrapped.tests.neovim-lsp
```

For this case if the `./result` file is empty it worked as expected.

## Nixpkgs-review

[nixpkgs-review](https://github.com/Mic92/Nixpkgs-review) is a really handy tool to build a nixpkg pr and make sure all deps of a change still build properly.

To run it while developing you can run

```sh
$ nixpkgs-review wip
```

this will build all changes then give you a `nix-shell` to test out all the builds

If your changes are commited you can also run

```sh
$ nixpkgs-review rev HEAD
```

For the same effect.

## Make the PR!

Do a double check over the [contributing README](https://github.com/NixOS/Nixpkgs/blob/master/CONTRIBUTING.md) and the [submitting changes wiki](https://nixos.org/manual/Nixpkgs/stable/#chap-submitting-changes) pages to make sure you followed any extra steps.

Now you're good to submit the PR! Read over the PR template and once your PR has been submitted a bot will run tests and assign the appropriate reviews.

### Handling feedback

One slightly weird rule is if you have to update the PR after pushing [you should not add more commits](https://nixos.org/manual/Nixpkgs/stable/#submitting-changes-hotfixing-pull-requests).

To handle this you can make a new commit with the changes then run

```sh
$ git rebase -i HEAD~2 # the number 2 here assumes you only had one commit. If you have more do 1+(num commits)

# in the interactive rebase window change all but the top `pick` to `s` for squash
# this will squash all commits into one

# git commit —amend would also work

$ git push --force
```

# Profit

You have now joined the ranks of thankless open source developers! Feel free to enjoy the dopamine of the PR being merged.

If you want some more nix posts I recently wrote a [blog for my job](https://medium.com/immuta-engineering/nix-and-skaffold-for-painless-developer-environments-bec6529ac82f) on how to setup simple nix flakes.

IF you would like a more in depth video walking through this process [this video](https://www.youtube.com/watch?v=fvj8H5yUKu8) by Jon Ringer is quite good!
