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
    read -r -p "$prompt 
[y/N]: " reply
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

# latest_mod_date — Searches DIR (default: current directory) for files (can be filtered) and prints the most recent modification timestamp in UTC ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ.
# Usage:
#   latest_mod_date [DIR] [--hidden] [GLOB ...]
#   
#  - [DIR] Optional, defaults to current directory ("./"). The directory to be parsed.
#  - [--hidden] Optional. If given, will include results of hidden files and directories.
#  - [GLOB ...] Optional, defaults to no restrictions. If given, will only include files that match any of the given globs, otherwise if none given, then it will match any file with respect to the hidden file filter. 
# Examples
#   latest_mod_date # latest mod time in current dir (ignore hidden)
#   latest_mod_date --hidden # include hidden files and hidden directories
#   latest_mod_date /var/log '*.log' # latest mod time among files matching *.log in /var/log (ignore hidden)
#   latest_mod_date /path/to/dir --hidden '*.conf' '*.service'  # include hidden and matching the given globs in the given directory
#   latest_mod_date "$repoPath" '*.js' # .js files in the repo
latest_mod_date() {
  local dir="."
  local include_hidden=0
  local -a globs=()

  # Parse args
  while (( $# )); do
    case "$1" in
      --hidden) include_hidden=1; shift ;;
      --) shift; while (( $# )); do globs+=("$1"); shift; done; break ;;
      -*)
        printf 'Unknown option: %s\n' "$1" >&2
        return 2
        ;;
      *)
        if [[ -d "$1" && "${dir}" == "." && ${#globs[@]} -eq 0 ]]; then
          dir="$1"
          shift
        else
          globs+=("$1")
          shift
        fi
        ;;
    esac
  done

  local find_cmd=(find -- "${dir}")

  if [[ $include_hidden -eq 0 ]]; then
    find_cmd+=( \( -path '*/.*' -prune \) -o -type f -print )
  else
    find_cmd+=(-type f -print)
  fi

  if (( ${#globs[@]} )); then
    find_cmd+=( -false )
    for g in "${globs[@]}"; do
      find_cmd+=( -o -name "$g" )
    done
  fi

  # get max epoch (float) and convert to integer seconds
  local best
  best=$("${find_cmd[@]}" -printf '%T@ %p\n' 2>/dev/null \
    | awk 'BEGIN{max=0} { if ($1+0>max) max=$1 } END{ if (max>0) printf("%.0f\n", max) }')
  
  if [[ -z $best ]]; then
    return 1
  fi

  # Output in UTC ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)
  if date --version >/dev/null 2>&1; then
    # GNU date: use -u for UTC and --date=@SECONDS with +%FT%TZ
    date -u -d @"$best" '+%FT%TZ'
  else
    # BSD/macOS date: -u for UTC, -r SECONDS, format +%Y-%m-%dT%H:%M:%SZ
    date -u -r "$best" '+%Y-%m-%dT%H:%M:%SZ'
  fi
}

join() {
  local d=${1-} f=${2-}
  if shift 2; then
    printf %s "$f" "${@/#/$d}"
  fi
}

filter_files() {
  local dir="."
  local -a dirs=()
  local show_hidden=0
  local -a include_regex=()
  local -a exclude_regex=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --hidden)
        show_hidden=1
        shift
        ;;
      -i|--include|--includes)
        if [[ -z "$2" || "$2" == --* ]]; then
          printf '%s\n' "filter_files: $1 requires an argument" >&2
          return 2
        fi
        include_regex+=("$2")
        shift 2
        ;;
      -e|--exclude|--excludes)
        if [[ -z "$2" || "$2" == --* ]]; then
          printf '%s\n' "filter_files: $1 requires an argument" >&2
          return 2
        fi
        exclude_regex+=("$2")
        shift 2
        ;;
      --)
        shift; break ;;
      -*)
        printf '%s\n' "filter_files: unknown option: $1" >&2
        return 2
        ;;
      *)
        if [[ -d "$1" ]]; then
          dirs+=("$1")
        else
          printf '%s\n' "ambiguous argument: '$1'" >&2
        fi
        shift
        ;;
    esac
  done
 # :{ # commented out v
  printf '%s\n' "dirs:"
  if (( ${#dirs[@]} )); then
    for d in "${dirs[@]}"; do printf '  %s\n' "$d"; done
  else
    printf '  (none)\n'
  fi

  printf '%s\n' "hidden: $show_hidden"

  printf '%s\n' "include:"
  if (( ${#include_regex[@]} )); then
    for r in "${include_regex[@]}"; do printf '  %s\n' "$r"; done
  else
    printf '  (none)\n'
  fi

  printf '%s\n' "exclude:"
  if (( ${#exclude_regex[@]} )); then
    for r in "${exclude_regex[@]}"; do printf '  %s\n' "$r"; done
  else
    printf '  (none)\n'
  fi
 # } #commented out ^
  
  local file_list=$(find "${dirs[@]}")
  echo "all files $file_list"
  #exclude_regex=('\.(json|lang)$' '/\.[^\.]')
  if [[ $show_hidden -eq 0 ]]; then
    exclude_regex+=('/\.[^\.]')
  fi
  echo "
	exclude: $exclude_regex
	include: $include_regex"
	
	exclude_regex=$(join "|" "${exclude_regex[@]}")
	include_regex=$(join "|" "${include_regex[@]}")
	
	echo "
	exclude: $exclude_regex
	include: $include_regex"
	if [[ ! -z $exclude_regex ]]; then
	  file_list=$(echo "$file_list" | grep -v -E "$exclude_regex")
	fi
	echo "after exclude: $file_list"
	if [[ ! -z $exclude_regex ]]; then
	  file_list=$(echo "$file_list" | grep -E "$include_regex")
	fi
	echo "after include: $file_list"
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
  echo "pulling latest changes"
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


# --- increment header.version[2] ---
echo "updating latest versions in $manifestPath"
incrementMinorVersion "$manifestPath" ".header.version"

newV=$(jq '.header.version' "$repoPath$manifestPath" | tr -d '\n ' )

# --- collect changed files ---
# changed in last commit & unstaged changes
changed_files=$(
  {
    git diff --name-only HEAD~1
    git diff --name-only
  } | sort -u
)

# --- update manifest module versions where applicable ---
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


# --- Update language file to include the current build version so that it appears in the mcpack description ---
echo "updating mcpack description in lang file"
langbackup=$(mktemp)
langFile="BP/texts/en_US.lang"
cat "$repoPath$langFile" > "$langbackup"

# --- mapping for templated variables in the lang file ---
# will replace $langFile's teplated strings (`${<KEY>}`) with the variable names in $langFileVars.
# example:
#    langFile input string: "hello ${NAME}!"
#    langFileVars["NAME"]="you"
#    langFile output string: "hello you!"
declare -A langFileVars

langFileVars["BUILD_DATE"]=$(date -u +"%Y-%m-%dT%H:%M:%SZ") # The build time of the mcpack file
langFileVars["BUILD_VERSION"]=$(echo "$newV" | sed -E 's/[^A-Za-z0-9]+/ /g' | xargs | tr ' ' '.') # mcpack build version
langFileVars["BUILD_COMMIT_HASH"]=$(git log -n 1 --format=%h) # effective commit hash for build (pre-bundle) (aka commit of last change before release) 
langFileVars["LAST_REPO_FILE_MODIFIED_TS"]=$(latest_mod_date "$repoPath") # last repo file date modified, excluding hidden files (aka dont include .env or .git files)
for key in "${!langFileVars[@]}"; do
  echo "LANG var \${$key}='${langFileVars[$key]}'"
  sed -i -r "s/\\\$\{$key\}/${langFileVars[$key]}/g" "$repoPath$langFile"
done




# --- Create mcpack files -- 
echo "creating .mcpack file"
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

