
#!/bin/bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Configuration ─────────────────────────────────────────────────────────
REPO="nahugere/wing"
WING_HOME="$HOME/.wing"
VENV_DIR="$WING_HOME/venv"
BIN_DIR="$HOME/.local/bin"
SYMLINK="$BIN_DIR/wing"
TEMP_DIR="$(mktemp -d)"

# ── Helpers ────────────────────────────────────────────────────────────────
info() {
    printf '%b\n' "${YELLOW}[wing]${NC} $*"
}

success() {
    printf '%b\n' "${GREEN}[wing]${NC} $*"
}

error() {
    printf '%b\n' "${RED}[wing]${NC} $*" >&2
}

cleanup() {
    rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

find_python() {
    local cmd

    for cmd in python3.14 python3.13 python3.12 python3.11 \
               python3.10 python3.9 python3; do
        if command -v "$cmd" >/dev/null 2>&1 &&
           "$cmd" -c \
               'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' \
               >/dev/null 2>&1; then
            command -v "$cmd"
            return 0
        fi
    done

    return 1
}

get_latest_version() {
    local response

    response="$(curl -fsSL \
        "https://api.github.com/repos/${REPO}/releases/latest")" || {
        error "Failed to retrieve the latest release from GitHub."
        return 1
    }

    printf '%s\n' "$response" |
        sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' |
        head -n 1
}

resolve_version() {
    local version="${WING_VERSION:-}"

    if [ -z "$version" ]; then
        version="$(get_latest_version)" || return 1
    fi

    if [ -z "$version" ]; then
        error "Could not determine the release version."
        return 1
    fi

    printf '%s\n' "$version"
}

download_release() {
    local version="$1"
    local archive="$TEMP_DIR/wing.tar.gz"

    info "Downloading Wing ${version}"

    curl -fL --retry 3 \
        -o "$archive" \
        "https://github.com/${REPO}/archive/refs/tags/${version}.tar.gz" || {
        error "Failed to download Wing ${version}."
        return 1
    }

    tar -xzf "$archive" -C "$TEMP_DIR" || {
        error "Failed to extract the release archive."
        return 1
    }
}

find_source_dir() {
    local dir

    dir="$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 \
        -type d -name 'wing-*' -print -quit)"

    if [ -z "$dir" ] || [ ! -f "$dir/pyproject.toml" ]; then
        error "Could not find the Wing source directory."
        return 1
    fi

    if [ ! -f "$dir/requirements.txt" ]; then
        error "The release archive does not contain requirements.txt."
        return 1
    fi

    printf '%s\n' "$dir"
}

check_version() {
    local version="$1"

    if [ -z "$version" ]; then
        error "Could not determine the release version."
        return 1
    fi
}

install_release() {
    local py="$1"
    local version="$2"
    local src_dir

    download_release "$version"
    src_dir="$(find_source_dir)"

    info "Creating virtual environment at $VENV_DIR"
    mkdir -p "$WING_HOME"

    if [ ! -x "$VENV_DIR/bin/python" ]; then
        "$py" -m venv "$VENV_DIR"
    fi

    info "Upgrading pip"
    "$VENV_DIR/bin/python" -m pip install --upgrade pip

    info "Installing dependencies from requirements.txt"
    "$VENV_DIR/bin/python" -m pip install \
        -r "$src_dir/requirements.txt"

    info "Installing Wing ${version}"

    # hatch-vcs uses this override when Git metadata is unavailable.
    export SETUPTOOLS_SCM_PRETEND_VERSION="${version#v}"

    "$VENV_DIR/bin/python" -m pip install \
        "$src_dir" --no-deps

    info "Creating executable symlink"
    mkdir -p "$BIN_DIR"
    ln -sfn "$VENV_DIR/bin/wing" "$SYMLINK"

    success "Wing ${version} installed successfully!"
    info "Executable: $SYMLINK"
    info "Make sure $BIN_DIR is in your PATH."

    "$VENV_DIR/bin/python" -m wing --version
}

# ── Commands ───────────────────────────────────────────────────────────────
cmd_install() {
    local py
    local version

    py="$(find_python)" || {
        error "Python 3.9 or newer was not found. Install Python first."
        exit 1
    }

    version="$(resolve_version)" || exit 1
    check_version "$version"

    info "Using Python: $py"
    install_release "$py" "$version"
}

cmd_update() {
    local version
    local src_dir

    if [ ! -x "$VENV_DIR/bin/python" ]; then
        error "Wing is not installed. Run the install command first."
        exit 1
    fi

    version="$(resolve_version)" || exit 1
    check_version "$version"

    info "Updating Wing to ${version}"

    download_release "$version"
    src_dir="$(find_source_dir)"

    info "Upgrading pip"
    "$VENV_DIR/bin/python" -m pip install --upgrade pip

    info "Updating dependencies"
    "$VENV_DIR/bin/python" -m pip install \
        --upgrade -r "$src_dir/requirements.txt"

    info "Updating Wing"
    export SETUPTOOLS_SCM_PRETEND_VERSION="${version#v}"

    "$VENV_DIR/bin/python" -m pip install \
        --no-deps --force-reinstall "$src_dir"

    info "Refreshing executable symlink"
    mkdir -p "$BIN_DIR"
    ln -sfn "$VENV_DIR/bin/wing" "$SYMLINK"

    success "Wing updated successfully!"
    "$VENV_DIR/bin/python" -m wing --version
}

cmd_uninstall() {
    info "Removing executable symlink"
    rm -f "$SYMLINK"

    info "Removing virtual environment and Wing files"
    rm -rf "$WING_HOME"

    success "Wing uninstalled successfully!"
}

# ── Main ───────────────────────────────────────────────────────────────────
COMMAND="install"

if [ "$#" -gt 1 ]; then
    error "Usage: $0 [--install|--update|--uninstall]"
    exit 1
fi

if [ "$#" -eq 1 ]; then
    case "$1" in
        --install)   COMMAND="install" ;;
        --update)    COMMAND="update" ;;
        --uninstall) COMMAND="uninstall" ;;
        -h|--help)
            printf 'Usage: %s [--install|--update|--uninstall]\n' "$0"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
fi

case "$COMMAND" in
    install)
        cmd_install
        ;;
    update)
        cmd_update
        ;;
    uninstall)
        cmd_uninstall
        ;;
esac
