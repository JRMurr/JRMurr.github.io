---
title: Nix on steam frame
slug: nix-on-steam-frame
date: 2026-10-04T15:56:21.818Z
tags: ["nix"]
draft: true
summary: Installing nix + home manager on steam frame
layout: PostSimple
---


# TODO
    - Talk about frametop install
    - Fact check everything

I got my steam frame and ofc the first thing i wanted to figure out is getting nix installed on it.
Thankfully since the steam deck is running a similar os setup as the frame all the work people did to get nix on the deck working basically made the frame "just work"


So heres how you can get nix installed and some cool things you can do with it once its setup.




# Install steps


## Nix
```
passwd                                # you need a password setup if you havent already
sudo steamos-readonly disable         # make root file system writable

sudo mkdir -p /etc/tmpfiles.d         # SteamOS ships without it; the installer expects it

curl -fsSL -o nix-installer.sh https://artifacts.nixos.org/nix-installer
less nix-installer.sh                 # give the install a spot check
sh nix-installer.sh install steam-deck --enable-flakes

sudo steamos-readonly enable          # go back to read only root
```


After that nix should be setup. The official installer for the steam-deck works without issue on the frame and handles Steamos's immutable root for you.

This works by keeping the actual nix store at `/home/nix/store` and on boot bind mounting it to `/nix/store`


## Home manager


Just having nix installed is fine but the main reason I love nix so much is declarative config to manage all apps and settings. 
Now nixos on the frame is a little crazy, I'm sure you could figure something out but just using home manager to manage dot files is a good balance for me.

There is not really too much frame specific home manager setup you need to do, the usual stand alone install methods for home manager will work.

I already have a nix flake for my nixos config, so i went with the flake install approach.

Here is an example flake setup for the frame


```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, home-manager, ... }: {
    homeConfigurations.steamos = home-manager.lib.homeManagerConfiguration {
      pkgs = nixpkgs.legacyPackages.aarch64-linux;
      modules = [
        {
          home.username = "steamos";
          home.homeDirectory = "/home/steamos";
          home.stateVersion = "26.05"; 

          targets.genericLinux.enable = true;  # enables some options to make home manager work better on non-nixos setups
        }
      ];
    };
  };
}
```

Then to get home manager setup you can run

```shell
# cd to dir with flake
nix build '.#homeConfigurations."steamos".activationPackage'
HOME_MANAGER_BACKUP_EXT=backup ./result/activate
```

`HOME_MANAGER_BACKUP_EXT=backup` will backup any files (by renaming) that home manager will now manages. This will only really affect the default bashrc that steamos setups up.

That specific command is only needed the first time to get home manager installed.
After its setup you can run

```shell
home-manager switch --flake <path to flake>#steamos
```

to update your config going forward.


# Managing system files

When you run home-manager switch it will ask you to run

`non-nixos-gpu-setup` this command is needed to get gpu drivers working with nix built programs. Most nix made programs look for gpu drives in `/run/opengl-drivers`.

Running that command adds some systemd units to symlink the right drives into `/run/opengl-drivers`. 
This does work, but on reboot you need to run it again due to some boot ordering with when the nix mount is setup. 
Also you need to add the systmd units the steamos's keep list so they stay on a steamos update.


So to handle this I created a simple cli tool that lets me still declare some of the etc files we need declaratively but make sure they stay around on steamos reboot/updates.

I created this tool as its own home manager module that you can find [here](https://github.com/JRMurr/steamos-etc-nix).

To use it you can add that repo as a flake input and in your home manager config you just need to add

```nix
programs.steamos-etc = {
    enable = true;
    # Hold the user session until /nix is mounted.
    waitForNix = true;
    # /run/opengl-driver for Nix-built GUI apps.
    gpuDrivers = true;
};
```

and it will make sure your user session waits for the nix mount.


Then like the `non-nixos-gpu-setup` you run `steamos-etc` to actually setup the files. On homemanager switch a warning wil be displayed if there is any drift.









