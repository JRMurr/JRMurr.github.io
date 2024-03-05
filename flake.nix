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
        nodeVerion = pkgs.nodejs_20;
        commonDeps = with pkgs; [ nodeVerion just ];
        myNix = import ./nix { inherit pkgs; nodejs = nodeVerion; };
      in
      {
        devShells = {
          default = pkgs.mkShell { buildInputs = commonDeps ++ (with pkgs; [ node2nix myNix.runNode2Nix ]); };
          CI = pkgs.mkShell { buildInputs = commonDeps; };
        };
        # packages = { };
      });
}
