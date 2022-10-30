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
          default = mkShell {
            buildInputs = [ nodeVerion just ];
            shellHook = ''
              # Install global npm packages to `.nix-node` and add bin to the path for cli tools
              mkdir -p .nix-node
              # install node modules to the nix-node folder
              export NODE_PATH=$PWD/.nix-node
              export NPM_CONFIG_PREFIX=$PWD/.nix-node
              export PATH=$NODE_PATH/bin:$PATH
            '';
          };
          CI = mkShell { buildInputs = [ nodeVerion ]; };
        };
      });
}
