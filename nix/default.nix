{ pkgs ? (import ./pinned_from_flake.nix { }).pkgs, nodejs ? pkgs."nodejs_20" }:
let
  node2nixOut = import ./node { inherit pkgs nodejs; };

  # rootDir = builtins.toString ../.;


  # runNode2Nix = pkgs.writeShellScriptBin "runNode2Nix" ''
  #   ${pkgs.node2nix}/bin/node2nix -18 --development \
  #     --input ${rootDir}/package.json \
  #     --lock ${rootDir}/package-lock.json \
  #     --node-env ${rootDir}/nix/node/env.nix \
  #     --composition ${rootDir}/nix/node/default.nix \
  #     --output ${rootDir}/nix/node/package.nix
  # '';
in
{ inherit node2nixOut; }
