{ pkgs ? (import ./pinned_from_flake.nix { }).pkgs, nodejs ? pkgs."nodejs_20" }:
let

  src =
    let
      fs = pkgs.lib.fileset;
      rootDir = ../.;
      trackedfiles = fs.gitTracked rootDir;
      excluded = fs.unions [ ../.vscode ./. ../README.md ../TODO.md ../.github ];

      fileSet = fs.difference trackedfiles excluded;
    in
    fs.toSource {
      root = rootDir;
      fileset = fileSet;
    };

  node2nixOut = import ./node { inherit pkgs nodejs; };

  nodeDependencies = node2nixOut.nodeDependencies;

  blogBuild = pkgs.stdenv.mkDerivation {
    name = "blog-build";
    src = src;
    buildInputs = [ nodejs ];
    buildPhase = ''
      cp --no-preserve=mode -r ${nodeDependencies}/lib/node_modules ./node_modules
      export PATH="${nodeDependencies}/bin:$PATH"
      npm run velite
      IN_NIX=true npm run build


      mkdir -p $out
      cp -r out $out/
    '';
  };

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
{ inherit node2nixOut nodeDependencies blogBuild; }
