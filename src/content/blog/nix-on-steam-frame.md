---
title: Nix on the Steam Frame
slug: nix-on-steam-frame
date: 2026-10-04T15:56:21.818Z
tags: ["nix"]
draft: true
summary: Installing nix + home manager on the Steam Frame
layout: PostSimple
---

<TOCInline asDisclosure />

I got my Steam Frame and ofc the first thing I wanted to figure out was getting nix installed on it.
Thankfully the Steam Deck runs a similar OS setup, so all the work people did to get nix working on the deck basically made the frame "just work".

So here's how you can get nix installed and some cool things you can do with it once it's set up.

# Install steps

## Nix
```shell
passwd                                # no password is set by default, need one for sudo
sudo steamos-readonly disable         # make root file system writable

sudo mkdir -p /etc/tmpfiles.d         # The installer expects this path to exist

curl -fsSL -o nix-installer.sh https://artifacts.nixos.org/nix-installer
less nix-installer.sh                 # give the install a spot check
sh nix-installer.sh install steam-deck --enable-flakes

sudo steamos-readonly enable          # go back to read only root
```

After that nix should be set up. The official installer's Steam Deck mode works without issue on the frame and handles SteamOS's immutable root for you.

This works by keeping all of `/nix` at `/home/nix` (which survives SteamOS updates) and on boot bind mounting it to `/nix` with a `nix.mount` systemd unit.

One thing to keep in mind, SteamOS updates replace the root file system. Your store and anything under `/home` is fine, but any edits you make to `/etc/nix/nix.conf` (like adding yourself to `trusted-users`) will need to be redone after an update.

## Home manager

Just having nix installed is fine, but the main reason I love nix so much is managing all my apps and settings declaratively.
Running full NixOS on the frame would be a little crazy. I'm sure you could figure something out, but just using home manager to manage dotfiles is a good balance for me.

Installing home manager itself works the usual standalone way. Getting it to play nice with SteamOS takes a fair bit of frame specific config though, which is most of the rest of this post.

I already have a nix flake for my [NixOS config](https://github.com/JRMurr/NixOsConfig), so I went with the flake install approach.

Here is an example flake setup for the frame. It already has the inputs for the other modules I cover later in the post ([steamos-etc](#managing-system-files) and [frametop](#frametop)). You can drop them if you don't want them.

<Note>
I created steamos-etc-nix and frametop-nix primarily with Claude. You do not need them to use nix/home manager on the frame but they help with quality of life.
</Note>

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # I'll explain these later on in the blog, you can ignore these if you want
    steamos-etc = {
      url = "github:JRMurr/steamos-etc-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    frametop = {
      url = "github:JRMurr/frametop-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, home-manager, ... }@inputs: {
    homeConfigurations.steamos = home-manager.lib.homeManagerConfiguration {
      pkgs = nixpkgs.legacyPackages.aarch64-linux;
      # makes `inputs` available as a module argument in home.nix
      extraSpecialArgs = { inherit inputs; };
      modules = [ ./home.nix ];
    };
  };
}
```

```nix
# home.nix
{ inputs, ... }:
{
  imports = [
    # again these are sorta optional, ignore if you want
    inputs.steamos-etc.homeManagerModules.default
    inputs.frametop.homeManagerModules.default
  ];

  home.username = "steamos";
  home.homeDirectory = "/home/steamos";
  home.stateVersion = "26.05";

  targets.genericLinux.enable = true;  # enables some options to make home manager work better on non-nixos setups

  programs.home-manager.enable = true; # standalone installs need this to get the home-manager cli
}
```

Then to get home manager set up you can run:

```shell
# cd to dir with flake
nix build '.#homeConfigurations."steamos".activationPackage'
HOME_MANAGER_BACKUP_EXT=backup ./result/activate
```
(if you see `User systemd daemon not running. Skipping reload.` in the output, see the [Nested sessions section](#nested-sessions))

`HOME_MANAGER_BACKUP_EXT=backup` will back up (by renaming) any existing files that home manager will now manage.

You only need to build and run `activate` like this the first time, to get home manager installed.
After it's set up you can run

```shell
home-manager switch --flake <path to flake>#steamos -b backup
```

to update your config going forward. Keep the `-b backup` around, SteamOS updates like to put their dotfiles back.

### Nested sessions

One thing that will probably bite you when you run `home-manager switch` is the nested plasma session. Gamescope is the actual session on the frame, it's running the SteamOS dashboard and the "vr stuff".
When you open the "Desktop" app it runs `/usr/bin/steamos-nested-desktop`, which starts plasma *inside* that session. To keep the two from stepping on each other it does roughly:

```shell
export XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR/nested_plasma
dbus-run-session startplasma-wayland
```

So anything you launch from that desktop (and later with frametop, which does the same thing with `.../frametop`) gets a runtime dir of `/run/user/1000/nested_plasma` and its own private D-Bus.
Your user's systemd manager is still at `/run/user/1000` though, so anything that looks for it through those vars can't find it.

Home manager is one of those things. The switch won't fail. It will write all your files and just print:

```
User systemd daemon not running. Skipping reload.
```

This means any new or changed user services won't be started/restarted until your next login.

To fix it, point the switch back at the real session:

```shell
env XDG_RUNTIME_DIR=/run/user/$(id -u) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus home-manager switch --flake <path to flake>#steamos -b backup
```

The same prefix works for the first `./result/activate` too.

You'll hit the same problem with `systemctl --user`, and the same env override fixes it.

This class of issue should not affect you if you connect over ssh or launch a terminal from the SteamOS dashboard directly, since Steam itself runs with the real `/run/user/1000` and bus.

### Showing apps in the launcher

Once you start installing GUI apps with home manager you will notice they don't show up in the VR "+" menu. Two things get in the way:

1. The "+" menu only reads `~/.local/share/applications`, it ignores `XDG_DATA_DIRS` (which is where home manager's `.desktop` files show up).
2. The Steam session's `PATH` doesn't have `~/.nix-profile/bin`, so even if the entry showed up an `Exec=kitty` would fail to launch.

So I link every `.desktop` file from my profile into `~/.local/share/applications`, with the command rewritten to an absolute path:

```nix
{ config, pkgs, ... }:
let
  profileBin = "${config.home.profileDirectory}/bin";

  # The profile's desktop entries with Exec/TryExec pointing at the profile's bin.
  # The profile link rather than a store path, so entries don't change every generation.
  entries = pkgs.runCommand "frame-desktop-entries" { } ''
    mkdir -p $out

    for src in ${config.home.path}/share/applications/*.desktop; do
      awk -v bin=${config.home.path}/bin -v profile=${profileBin} '
        match($0, /^(TryExec|Exec)=/) {
          key = substr($0, 1, RLENGTH)
          rest = substr($0, RLENGTH + 1)
          split(rest, words, " ")
          cmd = words[1]

          if (cmd !~ /\// && system("test -e \"" bin "/" cmd "\"") == 0)
            $0 = key profile "/" cmd substr(rest, length(cmd) + 1)
        }
        { print }
      ' "$src" > "$out/$(basename "$src")"
    done
  '';
in
{
  # Linked file by file (recursive) so Steam's own shortcuts in there stay.
  xdg.dataFile."applications" = {
    source = entries;
    recursive = true;
  };
}
```

The plasma desktop has a similar `PATH` problem. It gets its environment from the systemd user manager, not a login shell, so you need this for launching from its menu to work:

```nix
systemd.user.sessionVariables.PATH = "${config.home.profileDirectory}/bin:/nix/var/nix/profiles/default/bin\${PATH:+:$PATH}";
```

## Managing system files

With `targets.genericLinux.enable`, `home-manager switch` will ask you to run `non-nixos-gpu-setup`. This is needed to get GPU drivers working with nix built programs, since most of them look for GPU drivers in `/run/opengl-driver`.

Running that command adds a tmpfiles rule to symlink the right drivers into `/run/opengl-driver` on boot.
The problem is that rule is itself a symlink into the nix store, and tmpfiles runs before `/nix` is mounted. So on boot the rule can't be read and you're left without drivers.
Also any files you add to `/etc` get dropped on a SteamOS update unless they're on the keep list in `/etc/atomic-update.conf.d/`.

So to handle this I created [steamos-etc](https://github.com/JRMurr/steamos-etc-nix), a home manager module with a small cli that lets you declare the `/etc` files you need and makes sure they survive SteamOS reboots/updates.

The [example flake](#home-manager) above already has it as an input and imports the module, so in your `home.nix` you just need to add:

```nix
programs.steamos-etc = {
  enable = true;
  # Hold the user session until /nix is mounted.
  waitForNix = true;
  # /run/opengl-driver for Nix-built GUI apps.
  gpuDrivers = true;
};
```

`waitForNix` makes your user session wait for the nix mount. Without it your session can start before `/nix` is there, so any store links read at login dangle.
That includes home manager's `environment.d` files (where plasma gets its `PATH` from) and `~/.config/user-dirs.dirs`, which `xdg-user-dirs-update` then helpfully replaces with a regular file.

`gpuDrivers` sets up `/run/opengl-driver` with a real file instead of a store link. It replaces `non-nixos-gpu-setup` entirely (and silences home manager asking you to run it), so you don't need to run that.

Home manager only builds the files; the `steamos-etc` command actually installs them. Home manager activation can't use `sudo`, so this is a separate step you run after every switch:

```shell
home-manager switch --flake <path to flake>#steamos -b backup && steamos-etc
```

(I would make an alias for the above)

It only asks for `sudo` when something actually changed. You don't need `steamos-readonly disable` for this: `/etc` is a writable overlay (kept under `/var`). Its files just get dropped on updates unless they're on the keep list, which is why `steamos-etc` adds every file it manages to `/etc/atomic-update.conf.d/steamos-etc.conf`.

On home manager switch a warning is displayed if `/etc` has drifted from your config, like after a rollback or a SteamOS update resetting `/etc`.

### Tailscale

`steamos-etc` solves more problems than just the GPU drivers. You can use it to set up system services, written like home manager's `systemd.user.services`.
It solves a similar problem to [system-manager](https://github.com/numtide/system-manager), but lets you stay in your home manager config and handles the SteamOS specific issues: `/nix` mounting late on boot and updates wiping `/etc`.

For example here is how you can set up tailscale:

```nix
{ pkgs, ... }:
let
  tailscale = pkgs.tailscale;
in
{
  home.packages = [ tailscale ];

  programs.steamos-etc.services.tailscaled = {
    Unit = {
      Description = "Tailscale node agent";
      Documentation = "https://tailscale.com/docs/";
      Wants = [ "network-pre.target" ];
      After = [
        "network-pre.target"
        "NetworkManager.service"
        "systemd-resolved.service"
      ];
    };

    Service = {
      # 41641 is the default port the nixos tailscale module uses
      ExecStart = "${tailscale}/bin/tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/run/tailscale/tailscaled.sock --port=41641";
      ExecStopPost = "${tailscale}/bin/tailscaled --cleanup";
      Restart = "on-failure";
      Type = "notify";

      RuntimeDirectory = "tailscale";
      RuntimeDirectoryMode = "0755";
      StateDirectory = "tailscale";
      StateDirectoryMode = "0700";
      CacheDirectory = "tailscale";
      CacheDirectoryMode = "0750";
    };

    Install.WantedBy = [ "multi-user.target" ];
  };
}
```

After a switch, `steamos-etc` installs the unit and starts it (because of `Install.WantedBy`, which also starts it on every boot). Then just log in:

```shell
sudo tailscale up --operator=steamos
```

and it should "just work". When the unit changes later (like a nixpkgs bump giving it a new tailscale), `steamos-etc` restarts it for you.

# Frametop

The thing that excited me the most about the Steam Frame was the fact that it's a full linux machine. I wanted to experiment with interesting development flows in VR.

[frametop](https://github.com/DeeJanuz/frametop) greatly expands what you can do on the frame when it comes to managing desktops and programs in VR.
It also has (experimental) eye tracking as a mouse and hand tracking so you can use your frame like a poor man's Apple Vision Pro (I guess not that poor given the frame's price....).

To make it easy to manage frametop with home manager I created [frametop-nix](https://github.com/JRMurr/frametop-nix).

Like steamos-etc, the [example flake](#home-manager) already has the input and imports the module, so you just need to add:

```nix
programs.frametop.enable = true;
```

The `inputs.nixpkgs.follows` on the frametop input matters more than usual here. Frametop's compositor gets Mesa from nixpkgs and the drivers in `/run/opengl-driver` come from your nixpkgs, and those need to be the same Mesa.
(your nixpkgs also needs `wlroots_0_20`, which 26.05 has)

After the first switch, restart SteamVR once so it loads the 3D mouse driver (this closes everything open in VR).

Now you get the multi-screen desktop + 3D mouse. I'm surprised the 3D mouse isn't built into SteamOS. By default your mouse is locked to one window, and you need to use the controller or headset to focus another window before the mouse works there. Frametop's 3D mouse lets you move the mouse across all windows and move windows around in 3D space.

Gaze mode, hand tracking, and remote desktop aren't packaged yet (but I will get them working soon™).

Frametop is my current favorite thing on the frame. Since getting it set up I've been using my frame for basically all my computer tasks.

