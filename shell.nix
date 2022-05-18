# still support `nix-shell` if user does not have nix flakes. flake-compat makes the flake backwards compatible
(import (let lock = builtins.fromJSON (builtins.readFile ./flake.lock);
in fetchTarball {
  url =
    "https://github.com/edolstra/flake-compat/archive/${lock.nodes.flake-compat.locked.rev}.tar.gz";
  sha256 = lock.nodes.flake-compat.locked.narHash;
}) { src = ./.; }).shellNix
