#!/bin/bash
extension_name=$(cat metadata.json | jq '.["uuid"]')
simplified_name=$(echo "$extension_name" | grep -E --only-matching "[^\"]*")
version_number=$(cat metadata.json | jq '.["version"]')
ignored_files=(".git/*" ".gitignore" "install.sh" "package.sh")
zip "$simplified_name$version_number" -r "./" -x "${ignored_files[@]}"
