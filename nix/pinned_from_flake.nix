{}:
let
  inherit (builtins) fetchTree fromJSON readFile;
  inherit ((fromJSON (readFile ../flake.lock)).nodes) nixpkgs;

  pkgs = import (fetchTree nixpkgs.locked) {
    overlays = [ ];
  };
in
{ inherit pkgs; }
