{
  description = "Dev env for my blog";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodeVerion = pkgs.nodejs-16_x;
      in with pkgs; {
        devShells = {
          # TODO: they are the same deps but nice to have seperate configs
          default = mkShell { buildInputs = [ nodeVerion just ]; };
          CI = mkShell { buildInputs = [ nodeVerion just ]; };
        };
      });
}
