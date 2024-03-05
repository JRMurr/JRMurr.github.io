#!/usr/bin/env bash

SCRIPT_DIR=$(dirname "$0")
ROOT_DIR_REL="$SCRIPT_DIR/../"
ROOT_DIR=$(realpath "$ROOT_DIR_REL")

pushd $ROOT_DIR

mkdir -p ${ROOT_DIR}/nix/node


# TODO: will it be sad to use node version 18 in the node2nix call? looks like 20 is not supported
# TODO: need to update package.nix somehow to do a fileSet filter to yeet nodeModules
# maybe time to fork nod2nix????
node2nix -18 --development \
    --input ./package.json \
    --lock ./package-lock.json \
    --node-env ./nix/node/env.nix \
    --composition ./nix/node/default.nix \
    --output ./nix/node/package.nix

popd