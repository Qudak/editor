#!/usr/bin/env fish

echo "Building the editor package"
echo "==========================="
echo ""


# Check if a target directory is supplied
if not set -q argv[1]
    echo "Usage:./build.fish TARGET_DIRECTORY"
    exit 1
end

echo "Target directoryTET"

set target_dir $argv[1]

# Define the array of schemas
set schemas tlschema tldraw editor utils state store

set src_path ./package.tgz
set tgt_dir $target_dir/editor
set tgt_path $tgt_dir/editor.tgz

if not test -d $tgt_dir
    mkdir -p $tgt_dir
end

cp $src_path $tgt_path

# Iterate over each schema
for schema in $schemas
    # Define source and target paths
    set src_path packages/$schema/package.tgz
    set tgt_dir $target_dir/editor/$schema
    set tgt_path $tgt_dir/$schema.tgz

    # Check if the target directory exists, if not, create it
    if not test -d $tgt_dir
        mkdir -p $tgt_dir
    end

    # Copy the package.tgz file
    cp $src_path $tgt_path
end

