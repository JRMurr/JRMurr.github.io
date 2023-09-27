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
For a high level TLDR, [NixOS](https://NixOS.org/) is a Linux distro built on top of [NixPkgs](https://github.com/NixOS/nixpkgs).
NixPkgs uses the [Nix language](https://nix.dev/tutorials/first-steps/nix-language) to define how to build packages.

There is more nuance than that, but it will be good enough to get started and for googling the right things.

### Quick NixLang overview

For people new to nix I will go over the basics so the NixOS examples aren't completely foreign, if you know a little nix or other functional languages you can probably skip this part.

I like this quote from [zero to nix](https://zero-to-nix.com/concepts/nix-language) to describe the language

> Nix is a pure, functional, lazy, declarative, and reproducible programming language.

NixLang is a lot like Haskell in that it is pure, functional, and lazy.

This example should give a decent vibe of what programming in nix is like

```nix
(let foo = x: y: x; in foo "a" (throw "sad"))
# evals to "a"
```

That example defines a function `(x: y: x;)` which takes two arguments and returns the first, and binds it to the variable `foo` with `let foo =...; in`. This means the variable `foo` is only in scope after the `in`. Finally, we call foo with `foo "a" (throw "sad")`. This resolves to "a". Notice the error is not thrown because nix is lazy, that means if we never "need" to use a variable or expression, it will never be evaluated.

If we swap the order of the arguments to the function like `foo (throw "sad") "b"`, we will get

```
error:
       … while calling the 'throw' builtin

         at «string»:1:29:

            1| (let foo = x: y: x; in foo (throw "sad") "b")
             |                             ^

       error: sad
```

The laziness helps us right very declarative code, describe what you want and if you don't reference something, no worries, it won't affect performance.

One of my favorite features of the nix language is how you can use `attrsets` (objects, hash maps, dicts, etc.). You can create one like

```nix
let foo = {key1="bar"; key2= {nested1 = 1; nested2=2;};};
in
foo.key2.nested1
# resolves to 1
```

at first, they look like normal objects from something like python or JS but my favorite feature of them is the syntax sugar for dealing with nested `attrsets`

```nix
let foo = {
  key1="bar";
  key2.nested1 = 1;
  key2.nested2 = 2;
}; in
foo.key2.nested1
# resolves to 1
```

That snippet creates the same `attrset` as the example above but lets you use "path notation" to create the nested object.
While a basic syntax sugar it makes it very easy to override 1 nested option when merging things together. Without it NixOS would be a big PITA to manage IMO.

The last language feature I'll cover is the `with` block.

```nix
(with { a = 1; b = 2; };
  a + b)
# evals to 3
```

The with block will put all of an `attrsets` key value pairs as variable in scope. This makes it easier to access library functions with something like `with builtins` or `with lib`, so you don't need to prefix everything.

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
Many programs can be installed and configured with NixOS options people have put together. For example to install steam I can add

```nix
{
    programs.steam.enable = true;
}
```

That single line will do a lot of work for you as you can see [here](https://github.com/NixOS/nixpkgs/blob/9075cba53e86dc318d159aee55dc9a7c9a4829c1/nixos/modules/programs/steam.nix#L112).
Enabling steam will also make sure you have OpenGL enabled, open firewall ports, and can be further configured if other steam options are set.

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

### Managing complex services

Where NixOS really shines is how you manage services that need a lot of configuration like Grafana or Prometheus.
People have either done a lot of groundwork for you and exposed a simple interface to get something spun up and if not It's not too hard to make your own abstraction.

For example here is my config to set up Grafana

```nix
{ config, ... }:
let
  myDomain = config.myCaddy.domain;
  grafanaDomain = "grafana.${myDomain}";
  port = 3030;
in {
  services.grafana = {
    enable = true;
    settings = {
      server = {
        http_addr = "0.0.0.0";
        http_port = port;
        domain = grafanaDomain;
      };
    };
    provision.enable = true;
  };
  myCaddy.reverseProxies."grafana".upstream = ":${builtins.toString port}";
}
```

This file is almost like a docker compose where you set some env vars for ports and listening addresses, but I have the benefit of reading from other NixOS options to set variables (and it won't run in a container).

For example at the top I read in `myDomain = config.myCaddy.domain;`, this is an option I set [here](https://github.com/JRMurr/NixOsConfig/blob/main/hosts/thicc-server/caddy/options.nix#L51) that is just a variable holding the domain for my home lab. This way the Grafana domain will change automatically if I decide to change my domain (unlikely but DRY, so it makes me feel good).

I also use `myCaddy.reverseProxies."grafana".upstream` which is another custom option of mine to generate a reverse proxy config in caddy.

To me this is magic, one file has all the config needed to spin up Grafana and set the necessary caddy options for me. If I decide to stop using Grafana, I can delete this file, and It's as if it never existed with no dangling reverse proxies going nowhere.

For some slightly more involved config, see my [Prometheus config](https://github.com/JRMurr/NixOsConfig/blob/main/hosts/thicc-server/monitoring/prometheus.nix#L4), it references some Grafana options to auto register data sources for me.

### Managing secrets

When configuring services you will eventually need to manage secrets somehow. Some services will need an API key or password to function and leaving that in plain text in git or the nix store is a no-no. Up until recently I didn't really care, I didn't configure too many services that needed it, so I would either not care or use some hacky workaround.

# TODO: more links/info. add link to agenix tut

Now I use [agenix](https://github.com/ryantm/agenix) to encrypt my secrets. At a high level agenix is a wrapper around age which uses ssh keys to encrypt and decrypt files. The nice part is you can specify multiple keys to use as encryption and decryption. So for example I can list my user ssh key and the root ssh key for my server. So when adding/editing secrets I just need my private ssh key to decrypt, then using my public keys I can encrypt the data.

agenix adds NixOS options like

```nix
{
  # register the secret
  age.secrets.caddy-cloudflare = {
    file = "${inputs.secrets}/secrets/caddy-cloudflare.age"; # path to encrpyted secret file
    # let the caddy user read the secret
    owner = config.services.caddy.user;
    group = config.services.caddy.group;
  };

  systemd.services.caddy.serviceConfig = {
    # read the secret
    EnvironmentFile = config.age.secrets.caddy-cloudflare.path;
  };
}
```

The first option will tell agenix to decrypt the secret file when building the system config, and it will put the decrypted file at a path only readable by root (or in this case the caddy user since I set those options).

Then you need to use the file, most services in NixOS will have some option to read secrets set at a path, so in this case `systemd.services.caddy.serviceConfig.EnvironmentFile` will have systemd read the path specified on startup.

## Managing Dotfiles with Home Manager

Everything I showed is dope for complex services you would run on a server, but what about dotfiles like my fish, git, and i3 config?

This is where [Home Manager](https://github.com/nix-community/home-manager) comes in. Home Manger gives you the NixOS module system for things that are configured in your user's home directory.

For example this

```nix
{
  home-manager.users.jr = {
    programs.kitty = {
      enable = true;
      shellIntegration.enableFishIntegration = true;
      settings = {
        font_family = "FiraCode Nerd Font";
        bold_font = "auto";
        italic_font = "auto";
        bold_italic_font = "auto";
        enable_audio_bell = false;
        scrollback_lines = -1;
        tab_bar_edge = "top";
        allow_remote_control = "yes";
        shell_integration = "enabled";
        macos_option_as_alt = "yes";
        shell = "fish";
      };
      theme = "Dracula";
    };
  };
}

```

When home manager is run (as a NixOS module or stand alone), it will install [kitty](https://sw.kovidgoyal.net/kitty/) if we don't have it, and generate the kitty config file at `~/.config/kitty/kitty.conf` (for the user `jr` in this example), and since I set `shellIntegration.enableFishIntegration`, it will add lines to my fish config to add kitty completions.

Personally I found Home Manager to be much more useful than "normal" NixOS at first, I had an annoying way of managing my dot files across machines and Home Manager simplified it greatly. It also works for macOS, so you can share cross-platform config easily.

I put most of my Home Manager config into a separate [home manager folder/module](https://github.com/JRMurr/NixOsConfig/tree/main/common/homemanager), I then don't reference the `home-manager.users.<username>` prefix in any of those files. So for example in the kitty config above I only export ` programs.kitty = { ... }` and not `home-manager.users.jr.programs.kitty = {...}`. This lets me share the same home manager config for multiple NixOS users (if I wanted) and standalone home manager on macOS.

For example, my NixOS user has something like

```nix
{
home-manager.users.jr = (import ./hm.nix {});
}
```

this will add all the options in `jr-hm.nix` under `home-manager.users.jr`

and the `hm.nix` file will import my home manager module like so

```nix:hm.nix
{ ... }: {
  imports = [ ../../homemanager ];
  # Everything in this file will be under home-manager.users.<name>
  # https://rycee.gitlab.io/home-manager/options.html

  xdg.enable = true;

  # https://nix-community.github.io/home-manager/release-notes.html#sec-release-22.11-highlights
  home.stateVersion = "18.09";
}
```

To see the real example see [here](https://github.com/JRMurr/NixOsConfig/blob/main/common/users/jr.nix)

### Home Manager on Mac

For macOS once you have nix installed you can follow [this guide](https://nix-community.github.io/home-manager/index.html#ch-nix-flakes) to enable flakes and do some home manager init if you don't have a config already.

For my case since I already had my NixOS flake, I just needed to add a new flake output `homeConfiguration.<macOSUserName>`, see [here](https://github.com/JRMurr/NixOsConfig/blob/556f48bfa290185b595b71c4a8d2124efd0d851f/flake.nix#L170) for my setup.

Then you can run `home-manager switch --flake <pathToFlake>#<macOSUserName>` to install/update your config.

One thing to note when sharing config cross-platform is certain programs/options might not work on macOS, to gate that in your config you can use `pkgs.stdenv.isDarwin` which will be true on macOS and false elsewhere. The `lib.mkIf` function will let you conditionally add settings based on a condition. So for example to disable i3 on macOS you could do

```nix:i3.nix
{pkgs,...}: {
  config = lib.mkIf !pkgs.stdenv.isDarwin {
    xsession.windowManager.i3 = { enable =true; ...}
  };
}
```

## Wrap up

NixOS + Home Manager feels like something from the future (even though nix is like 20 years old....). The freedom you have to change and experiment is amazing. I didn't even go into some other awesome features like system rollback, distributed builds, and making your own configuration options.

If you haven't given NixOS a shot you're missing out!
