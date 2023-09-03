---
title: Organizing system configs with NixOS
date: 2023-09-03T16:11:37.626Z
tags: ['NixOS', 'nix', 'guide', 'dotfiles']
draft: false
summary: How I organize and manage my system and user configs with NixOS and homemanager
images: []
layout: PostLayout
---

Nix and NixOS has been the technology I've been the most excited about in the last few years.
While I have used Linux on my personal desktop and home server in the past, I never did anything complicated.
It was so hard to remember what I did to my system to get it to work the way I wanted.
This led to me keeping my systems very basic and eventually just using windows + docker for everything.
While that setup worked fine, it was boring... I wanted to rice out my config like everyone on [r/unixporn](https://www.reddit.com/r/unixporn/)

When I found NixOS it was like a lightbulb went off. Now I can feel free to change my config as I please,
not be scared if I break something, and be able to reproduce my system if I need to reinstall or got a new machine.

## What is NixOS

A big point of confusion when using Nix is the difference between Nix, NixPkgs, and NixOS.
[This post](https://www.haskellforall.com/2022/08/stop-calling-everything-nix.html) by [Gabriella Gonzalez](https://twitter.com/GabriellaG439) does a great break down on the differences.
For a high level TLDR, [NixOS](https://NixOS.org/) is a linux distro built on top of [NixPkgs](https://github.com/NixOS/nixpkgs).
NixPkgs uses the [Nix language](https://nix.dev/tutorials/first-steps/nix-language) to define how to build packages.

There is more nuance then that but it will be good enough to get started and for googling the right things.

### Using NixOS

NixOS lets you organize your system into many [modules](https://NixOS.wiki/wiki/NixOS_modules).
A module is a file or function that either declares options for other modules to use, or sets options defined in other modules.

For example

```nix:hello.nix
# Taken from https://NixOS.wiki/wiki/NixOS_modules#Example
{ lib, pkgs, config, ... }:
with lib;
let
  # Shorter name to access final settings a
  # user of hello.nix module HAS ACTUALLY SET.
  # cfg is a typical convention.
  cfg = config.services.hello;
in {
  # Declare what settings a user of this "hello.nix" module CAN SET.
  options.services.hello = {
    enable = mkEnableOption "hello service";
    greeter = mkOption {
      type = types.str;
      default = "world";
    };
  };

  # Define what other settings, services and resources should be active IF
  # a user of this "hello.nix" module ENABLED this module
  # by setting "services.hello.enable = true;".
  config = mkIf cfg.enable {
    systemd.services.hello = {
      wantedBy = [ "multi-user.target" ];
      serviceConfig.ExecStart = "${pkgs.hello}/bin/hello -g'Hello, ${escapeShellArg cfg.greeter}!'";
    };
  };
}
```

The file above adds the `services.hello` option. When enabled NixOS will make a system service called `hello.service` which will log `Hello <greeter>!`.
The module/options it defined can be used like this

```nix:configuration.nix
{
  imports = [ ./hello.nix ];
  ...
  services.hello = {
    enable = true;
    greeter = "Bob";
  };
}
```

this file imports the module so the `services.hello` exists and can be used. It also set the `greeter` option we defined so the `hello.service` will log `Hello Bob!`

There are many options defined in the NixOS [standard library](https://nixos.org/manual/nixos/stable/options).
Many programs can be installed and configured with nixos options people have put together. For example to install steam I can add

```nix
{
    programs.steam.enable = true;
}
```

That single line will do a lot of work for you as you can see [here](https://github.com/NixOS/nixpkgs/blob/9075cba53e86dc318d159aee55dc9a7c9a4829c1/nixos/modules/programs/steam.nix#L112).
Enabling steam will also make sure you have opengl enabled, open firewall ports, and can be further configured if other steam options are set.

That is the magic of NixOS to me, many people have spent time figuring out all the edge cases/things you would normally need to do if you just installed a package and automates it all away for you.

The [search page](https://search.nixos.org/options) is a great reference to find options defined in the standard library.
