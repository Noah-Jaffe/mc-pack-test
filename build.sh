#!/usr/bin/env bash
set -e
repoPath="./"
skipPull=0
skipPush=0
skipTag=0
 
# Usage help function
usage() {
  echo "Usage: $0 [--no-pull] [--no-bump] [--no-push] [--path='./']"
  echo "Options:"
  echo "  --no-pull      skips pull action. will build from current local files only."
  echo "  --no-tag       skips adding a new tag."
  echo "  --no-push      skips push action. will not push updated build and version to remote."
  echo "  --path <path>  provide a path to the src repo; defaults to './'"
  echo "  -h | --help    shows this helper message"
  exit 1
}

# prompt user to confirm y/n 
confirm() {
  local prompt="$1"
  while true; do
    read -r -p "$prompt [y/N]: " reply
    reply="${reply,,}"    # tolower
    case "$reply" in
      y|yes) return 0 ;;
      n|no|"" ) return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

# download remote tags, delete local tags not in remote
sync_git_tags(){
	local push_local=0
	local delete_local_not_remote=0
	local pull_remote=1
	while [[ $# -gt 0 ]]; do
    case "$1" in
      --push-local|-l) push_local=1; shift ;;
      --delete-local-only|-d) delete_local_not_remote=1; shift;;
      --no-pull-remote|-r) pull_remote=0; shift;;
      --) shift; break ;;
      *) echo "Unknown option: $1" >&2; return 1 ;;
    esac
  done
  if (( $push_local + $delete_local_not_remote == 2 )); then
    echo "cannot choose -l|--push-local && -d|--delete-local-only are mutually exclusive, only one is allowed"
    return 1
  fi
	local localTags=$(git -C $repoPath tag)
	local remoteTags=$(printf '%s\n' "$(git -C $repoPath ls-remote --tags)" | awk '{print $2}' | sed 's#refs/tags/##')
	local localNotRemote=$(comm -23  <(printf '%s\n' "$localTags" | sort) <(printf '%s\n' "$remoteTags" | sort) || true)
	local remoteNotLocal=$(comm -23  <(printf '%s\n' "$remoteTags" | sort) <(printf '%s\n' "$localTags" | sort) || true)
	local message=""
	if [[ ! -z "$localNotRemote" ]] && (( $push_local + $delete_local_not_remote > 0 )); then
    message="$message
    Tags to be $([ $push_local -eq 1 ] && echo "PUSHED" || $([ $delete_local_not_remote -eq 1 ] && echo "DELETED" || echo "IGNORED")) from local work
      $localNotRemote"
  fi
  if [[ ! -z "$remoteNotLocal" ]]; then
    message="$message
    Tags to be $([[] $pull_remote -eq 1 ]] && echo "PULLED" || echo "IGNORED") from remote work
      $remoteNotLocal"
  fi
  if [[ ! -z "$message" ]]; then 
    if confirm "$message"; then
      if [[ $pull_remote -eq 1 ]]; then 
        git -C $repoPath fetch
      fi
      if [[ $push_local -eq 1 ]]; then 
        git -C $repoPath push --tags
      elif [[ $delete_local_not_remote -eq 1 ]]; then
        git -C $repoPath tag --delete $localNotRemote
      fi
    fi
  fi
}

# Increment minor version of a path inside a json file
incrementMinorVersion() {
  local filePath=$1;
  local varPath=$2;
  local preV=$(jq "$varPath" "$filePath" | tr -d '\n ' )
  echo "$(jq -r "$varPath[2] += 1" $filePath)" > $filePath
  local newV=$(jq "$varPath" "$filePath" | tr -d '\n ' )
  preV=$(echo "$preV" | sed -E 's/[^A-Za-z0-9]+/ /g' | xargs | tr ' ' '.')
  newV=$(echo "$newV" | sed -E 's/[^A-Za-z0-9]+/ /g' | xargs | tr ' ' '.')
  echo "Updated version:
  $filePath::$varPath
    $preV -> $newV"
}
  
# Parse flags with getopts
# --options: short flags; --longoptions: long flags; --: separate flags from positional args
PARSED_ARGS=$(getopt --options h --longoptions no-pull,no-tag,no-push,help,path: --name "$0" -- "$@")
if [[ $? -ne 0 ]]; then
  # getopt failed (invalid flags)
  usage
fi
 
# Set positional parameters to parsed arguments
eval set -- "$PARSED_ARGS"
 
# Parse the flags
while true; do
  case "$1" in
    --no-pull) skipPull=1; shift ;;  # Skip pull remote changes before upgrading version
    --no-tag)  skipTag=1; shift ;; # Skip adding a new tag (requires to not skip push)
    --no-push) skipPush=1; shift ;; # Skip pushing new build to remote
    --path) repoPath=$2; shift 2;; # Capture arg with param: set the path to the root mcpack src directory
    -h|--help) usage ;;               # Capture arg with no param: Show help & exit
    --) shift; break ;;               # End of flags (remaining are positional args, and we ignore those for now)
    *) echo "Error: Unexpected flag $1" >&2; usage ;;
  esac
done
 
# Validate args here if needed
if [[ ! -d $repoPath ]]; then 
  echo "--path must resolve to a valid existing directory of a mcpack src directory!"
  exit 1
fi
# Attempt to pull latest updates (if not skipped)
if [[ $skipPull -eq 0 ]]; then
  git -C $repoPath pull || echo "not git repo"
fi
# -----------------------------
# Update version in manifest
# -----------------------------
manifestPath="BP/manifest.json"

# Increment plugin version minor

#prvV=$(jq '.header.version' "$repoPath$manifestPath" | tr -d '\n ' )
#jq  ".header.version[2]+=1" > "$repoPath$manifestPath"
#newV=$(jq '.header.version' "$repoPath$manifestPath" | tr -d '\n ' )


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

if [[ $skipPush -eq 0 ]]; then
  git -C $repoPath add "$repoPath$manifestPath"
  git -C $repoPath add "$mcpack"
  newV=$(echo "$newV" | sed -E 's/[^A-Za-z0-9]+/ /g' | xargs | tr ' ' '.')
  if [[ $skipTag -eq 0 ]]; then
    git tag -f $newV
    sync_git_tags --push-local
  fi
  git -C $repoPath commit -m "version bump on build: $newV"
  git -C $repoPath push --tags
fi
echo "Done.
Updated to $newV
$mcpack 
$(realpath $mcpack)"

