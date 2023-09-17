---
title: Organizing system configs with NixOS
date: 2023-09-03T16:11:37.626Z
tags: ['NixOS', 'nix', 'guide', 'dotfiles']
draft: false
summary: How I organize and manage my system and user configs with NixOS and homemanager
images: []
layout: PostLayout
---

<TOCInline toc={props.toc} asDisclosure />

Nix and NixOS has been the technology I've been the most excited about in the last few years.
While I have used Linux on my personal desktop and home server in the past, I never did anything complicated.
It was so hard to remember what I did to my system to get it to work the way I wanted.
This led to me keeping my systems very basic and eventually just using windows + docker for everything.
While that setup worked fine, it was hard to customize things... I wanted to rice out my config like everyone on [r/unixporn](https://www.reddit.com/r/unixporn/)

When I found NixOS it was like a lightbulb went off. Now I can feel free to change my config as I please,
not be scared if I break something, and be able to reproduce my system if I need to reinstall or got a new machine.

## What is NixOS

A big point of confusion when using Nix is the difference between Nix, NixPkgs, and NixOS.
[This post](https://www.haskellforall.com/2022/08/stop-calling-everything-nix.html) by [Gabriella Gonzalez](https://twitter.com/GabriellaG439) does a great break down on the differences.
For a high level TLDR, [NixOS](https://NixOS.org/) is a linux distro built on top of [NixPkgs](https://github.com/NixOS/nixpkgs).
NixPkgs uses the [Nix language](https://nix.dev/tutorials/first-steps/nix-language) to define how to build packages.

There is more nuance then that but it will be good enough to get started and for googling the right things.

### A Basic Module

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

### Using NixOS

That example is fine, but what do I actually do? My [NixOS config repo](https://github.com/JRMurr/NixOsConfig) is organized as follows

```shell
❯ exa --tree --level 2
├── common
│  ├── audio.nix
│  ├── autorandr.nix
│  ├── containers.nix
│  ├── default.nix
│  ├── devlopment.nix
│  ├── essentials.nix
│  ├── fonts.nix
│  ├── gestures
│  ├── homemanager
│  ├── kernel.nix
│  ├── myOptions
│  ├── network-shares.nix
│  ├── plymouth.nix
│  ├── programs.nix
│  ├── ssh.nix
│  ├── sudo.nix
│  ├── tailscale.nix
│  ├── users
│  └── xserver.nix
├── default.nix
├── flake.lock
├── flake.nix
├── hosts
│  ├── desktop
│  ├── framework
│  ├── thicc-server
│  └── wsl
├── legacyCommon.nix
├── pkgs
│  ├── caddy-with-plugins
│  ├── default.nix
│  └── overlay.nix
└── README.md
```

The `flake.nix` file is the entry point for everything, it roughly looks like this

```nix:flake.nix
{
  inputs = {
    # ommited
  };
  outputs = { self, nixpkgs, home-manager, wsl, flake-utils, ... }@inputs:
    let
      overlays = [
        inputs.attic.overlays.default
        inputs.agenix.overlays.default
        (import ./pkgs/overlay.nix)
      ];
      defaultModules = [
        { _module.args = { inherit inputs; }; }
        inputs.agenix.nixosModules.default
        home-manager.nixosModules.home-manager
        {
          home-manager.useGlobalPkgs = true;
          home-manager.useUserPackages = true;
        }
      ];
      mkPkgs = system:
        import nixpkgs {
          inherit system overlays;
          config.allowUnfree = true;
        };
      mkSystem = extraModules:
        nixpkgs.lib.nixosSystem rec {
          pkgs = mkPkgs "x86_64-linux";
          system = "x86_64-linux";
          modules = defaultModules ++ extraModules;
        };
    in {
      nixosConfigurations = {
        nixos-john = mkSystem [ ./hosts/desktop ];
        wsl = mkSystem [ wsl.nixosModules.wsl ./hosts/wsl ];
        framework = mkSystem [
          inputs.nixos-hardware.nixosModules.framework
          ./hosts/framework
        ];
        thicc-server = mkSystem [
          ./hosts/thicc-server
          inputs.vscode-server.nixosModule
          inputs.attic.nixosModules.atticd
          ({ config, pkgs, ... }: { services.vscode-server.enable = true; })
        ];
      };
    };
}
```

I trimmed this file down to just the most important bit of the `nixosConfigurations` section in the `outputs`.
That section is a mapping of `hostname => nixosConfigOptions`, so the `framework` key is for my laptop, `thicc-server` is my server, and so on
The `mkSystem` function will add some default modules for setting up [Home Manager](https://github.com/nix-community/home-manager) and [agenix](https://github.com/ryantm/agenix) (will explain those later), and adds in the specified modules for that host.

You may have noticed in the list of modules some elements are file paths like `./hosts/thicc-server`, some are just variables like `inputs.nixos-hardware.nixosModules.framework`, and some are inline functions like `({ config, pkgs, ... }: { services.vscode-server.enable = true; })`.
Each is functionally the same, they all will turn into a module function like I showed at the beginning of this post.
I personally like to put everything into files/folders but when importing other 3rd party modules like home manager and adding options exposed by them, it's sometimes easier to add it inline at the flake

## Diving into my Server Config

I briefly covered how NixOS modules works and how you might organize your systems, but what does a single system look like? So now lets dive into my server (`thicc-server`) config.

The main part of the config lives in the `./hosts/thicc-server` folder, which looks like this

```shell
❯ exa --tree --level 2 ./hosts/thicc-server/
./hosts/thicc-server
├── attic.nix
├── blocky
│  ├── default.nix
│  └── whitelist.txt
├── caddy
│  ├── default.nix
│  ├── options.nix
│  └── reverse-proxies.nix
├── dashy.nix
├── default.nix
├── freshrss.nix
├── hardware-configuration.nix
├── it-tools.nix
├── linkding.nix
├── monitoring
│  ├── default.nix
│  ├── grafana.nix
│  ├── loki.nix
│  └── prometheus.nix
├── mopidy.nix
└── postgres.nix
```

When you reference a folder in nix import, nix will read from the `default.nix` (similar to how JS will import a `index.js` file if you import from a folder).

```nix:hosts/thicc-server/default.nix
{ config, pkgs, ... }: {
  imports = [
    ./hardware-configuration.nix
    ../../common

    ./attic.nix
    ./blocky
    ./caddy
    ./dashy.nix
    ./freshrss.nix
    ./it-tools.nix
    ./monitoring
    ./linkding.nix
    ./mopidy.nix
    ./postgres.nix
  ];

  time.timeZone = "America/New_York";
  networking.hostName = "thicc-server";

  myOptions = {
    graphics.enable = false;
    networkShares.enable = true;
    containers.enable = true;
  };

  boot.loader = {
    systemd-boot.enable = true;
    efi.canTouchEfiVariables = true;
  };

  services.openssh = {
    enable = true;
    settings.PermitRootLogin = "yes";
  };
  virtualisation.docker.enable = true;

  # This value determines the NixOS release from which the default
  # settings for stateful data, like file locations and database versions
  # on your system were taken. It‘s perfectly fine and recommended to leave
  # this value at the release version of the first install of this system.
  # Before changing this value read the documentation for this option
  # (e.g. man configuration.nix or on https://nixos.org/nixos/options.html).
  system.stateVersion = "21.11"; # Did you read the comment?
}
```

So this file does some "core" options like hostname, timezone, enabling some of my custom options (in the `myOptions` section), and it imports the other files in this folder and from `common`

# TODO:

- Show grafana config file
- B/c of that mention the custom caddy option
- Show caddy config stuff
- show off homemanager/agenix somehow
