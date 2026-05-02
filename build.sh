#!/usr/bin/env bash
set -e
repoPath="./"
git -C $repoPath pull || echo "not git repo"
# -----------------------------
# Update version in manifest
# -----------------------------
manifestPath="BP/manifest.json"

# Increment plugin version minor

#prvV=$(jq '.header.version' "$repoPath$manifestPath" | tr -d '\n ' )
#jq  ".header.version[2]+=1" > "$repoPath$manifestPath"
#newV=$(jq '.header.version' "$repoPath$manifestPath" | tr -d '\n ' )

incrementMinorVersion() {
  local filePath=$1;
  local varPath=$2;
  local preV=$(jq "$varPath" "$filePath" | tr -d '\n ' )
  updated=$(jq "$varPath[2] += 1" $filePath)
  echo $updated > $filePath 
  local newV=$(jq "$varPath" "$filePath" | tr -d '\n ' )
  echo "updated $filePath::$varPath from $preV to $newV"
}
  
# --- Step 1: increment header.version[2] ---
incrementMinorVersion "$manifestPath" ".header.version"

newV=$(jq '.header.version' "$repoPath$manifestPath" | tr -d '\n ' )

# --- Step 2: collect changed files ---
# changed in last commit & unstaged changes
changed_files=$(
  {
    git diff --name-only HEAD~1
    git diff --name-only
  } | sort -u
)

# --- Step 3: process modules ---
module_count=$(jq '.modules | length' "$manifestPath")
manifestDir=$(dirname $manifestPath)
for ((i=0; i<module_count; i++)); do

  entry=$(jq -r ".modules[$i].entry // empty" "$manifestPath")

  # Skip modules without .entry
  [[ -z "$entry" ]] && continue

  modulePath="$manifestDir/$entry"

  # Check if file changed
  if echo "$changed_files" | grep -qx "$modulePath"; then
    echo "updating version number for $module Path 《$(jq ".modules[$i].entry" "$manifestPath")》"
    incrementMinorVersion "$manifestPath" ".modules[$i].version"
  fi

done


# -----------------------------
# Update language file build date
# -----------------------------
langbackup=$(mktemp)
langFile="BP/texts/en_US.lang"
cat "$repoPath$langFile" > "$langbackup"


build_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
#@todo improve regex matching for the description string
sed -i -r "s/(§2 )(.*?)( §r)/\1$build_date $newV\3/g" "$repoPath$langFile"


# -----------------------------
# Create mcpack files
# -----------------------------
behaviorPackDir="BP"
behaviorPacked="BP.mcpack"
mcpack=$(realpath $repoPath)
mcpack=$(basename $mcpack)
mcpack="${mcpack//[\/_\-]/}.mcpack"
# Clean old files
rm -f "$behaviorPacked"
rm -f "$mcpack"
curPath=$(pwd)
# Step 1: Zip BP folder contents → BP.mcpack
cd "$repoPath$behaviorPackDir"
zip -r "$curPath/$behaviorPacked" .  > /dev/null 2>&1
cd $curPath

# Step 2: Zip BP.mcpack → genChunk.mcpack
zip -j "$mcpack" "$behaviorPacked" # > /dev/null 2>&1
rm -f "$behaviorPacked"

echo "restoring files"
#git -C $repoPath restore $manifestPath
#git -C $repoPath restore $langFile
mv "$langbackup" "$repoPath$langFile"

# do we also commit here?
git -C $repoPath add "$repoPath$manifestPath"
git -C $repoPath add "$mcpack"
newV=$(echo "$newV" | sed -E 's/[^A-Za-z0-9]+/ /g' | xargs | tr ' ' '.')
git tag $newV
git -C $repoPath commit -m "version bump on build: $newV"
git push --tags
echo "Done. See $mcpack"
