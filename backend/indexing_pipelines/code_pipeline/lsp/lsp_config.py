"""
LSP Configuration Utilities
Helper functions for generating missing LSP configuration files.
When a repository lacks the necessary config (tsconfig.json, jsconfig.json, compile_commands.json),
these utilities can generate minimal configs to enable LSP functionality.
"""

import json
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Optional


def ensure_jsconfig(repo_root: str) -> Optional[Path]:
    """
    Ensure a jsconfig.json exists for JavaScript/TypeScript projects.
    If neither tsconfig.json nor jsconfig.json exists, creates a minimal
    jsconfig.json to enable typescript-language-server to resolve symbols
    across files.

    Args:
        repo_root: Root directory of the repository

    Returns:
        Path to the created jsconfig.json if one was created, None if config already exists
    """
    root = Path(repo_root)

    # Check if either config already exists
    tsconfig_path = root / "tsconfig.json"
    jsconfig_path = root / "jsconfig.json"

    if tsconfig_path.exists():
        print(f"  [LSP Config] Found existing tsconfig.json")
        return None

    if jsconfig_path.exists():
        print(f"  [LSP Config] Found existing jsconfig.json")
        return None

    # Generate minimal jsconfig.json
    config = {
        "compilerOptions": {
            "target": "ES2020",
            "module": "commonjs",
            "moduleResolution": "node",
            "checkJs": True,
            "allowJs": True,
            "noEmit": True,
            "skipLibCheck": True,
            "esModuleInterop": True,
            "resolveJsonModule": True
        },
        "include": ["**/*"],
        "exclude": ["node_modules", "dist", "build", ".git", "coverage"]
    }

    jsconfig_path.write_text(json.dumps(config, indent=2))
    print(f"  [LSP Config] Generated minimal jsconfig.json at {jsconfig_path}")

    return jsconfig_path

def has_js_ts_files(repo_root: str) -> bool:
    """
    Check if repository contains JavaScript or TypeScript files.
    Quick scan to determine if jsconfig generation is needed.

    Args:
        repo_root: Root directory of the repository

    Returns:
        True if .js, .jsx, .ts, or .tsx files are found
    """
    root = Path(repo_root)
    js_extensions = {".js", ".jsx", ".ts", ".tsx"}

    # Quick check: look for any JS/TS file (stop at first match)
    for pattern in ["*.js", "*.jsx", "*.ts", "*.tsx"]:
        for _ in root.rglob(pattern):
            return True

    return False

def cleanup_generated_config(config_path: Optional[Path]) -> None:
    """
    Remove a generated config file.
    Call this after LSP processing is complete to avoid leaving
    generated files in the repository.

    Args:
        config_path: Path returned by ensure_jsconfig(), or None
    """
    if config_path and config_path.exists():
        config_path.unlink()
        print(f"  [LSP Config] Cleaned up generated {config_path.name}")

# =============================================================================
# C/C++ compile_commands.json Generation
# =============================================================================

# Directories to skip when scanning for C/C++ source files
SKIP_DIRS = {
    "build", "cmake-build-debug", "cmake-build-release", ".build",
    "vendor", "third_party", "external", "deps", "dependencies",
    "node_modules", ".git", ".svn", ".hg",
    "test", "tests", "testing", "benchmark", "benchmarks",
    "__pycache__", ".pytest_cache", ".tox",
}

def ensure_compile_commands(repo_root: str) -> Dict[str, str]:
    """
    Ensure compile_commands.json exists for C/C++ projects.
    Tries multiple strategies in order:
    1. Use existing compile_commands.json
    2. Generate via CMake (if CMakeLists.txt exists)
    3. Generate via Bear + Make (if Makefile exists and bear is installed)
    4. Generate heuristically by scanning source files

    Args:
        repo_root: Root directory of the repository

    Returns:
        Dict with status info: {"status": "found"|"generated", "source": "...", "warning"?: "..."}
    """
    root = Path(repo_root)
    cc_path = root / "compile_commands.json"

    # 1. Already exists?
    if cc_path.exists():
        print(f"  [LSP Config] Found existing compile_commands.json")
        return {"status": "found", "source": "existing", "path": str(cc_path)}

    # 2. Try CMake
    if (root / "CMakeLists.txt").exists():
        result = _generate_compile_commands_cmake(repo_root)
        if result:
            print(f"  [LSP Config] Generated compile_commands.json via CMake")
            return {"status": "generated", "source": "cmake", "path": str(cc_path)}

    # 3. Try Bear + Make
    if (root / "Makefile").exists() and shutil.which("bear"):
        result = _generate_compile_commands_bear(repo_root)
        if result:
            print(f"  [LSP Config] Generated compile_commands.json via Bear")
            return {"status": "generated", "source": "bear", "path": str(cc_path)}

    # 4. Fallback: heuristic generation
    generated_path = _generate_compile_commands_heuristic(repo_root)
    if generated_path:
        print(f"  [LSP Config] Generated compile_commands.json via heuristic scan")
        return {
            "status": "generated",
            "source": "heuristic",
            "path": str(generated_path),
            "warning": "Generated with heuristics - external dependencies won't resolve",
        }
    return {"status": "failed", "source": "none"}

def _generate_compile_commands_cmake(repo_root: str) -> bool:
    """
    Generate compile_commands.json using CMake.
    Creates a temporary build directory, runs CMake with
    CMAKE_EXPORT_COMPILE_COMMANDS=ON, and copies the result.

    Returns:
        True if successful, False otherwise
    """
    root = Path(repo_root)
    cmake_file = root / "CMakeLists.txt"

    if not cmake_file.exists():
        return False

    if not shutil.which("cmake"):
        print(f"  [LSP Config] CMake not found, skipping CMake generation")
        return False

    build_dir = root / ".codecompass_build"
    try:
        build_dir.mkdir(exist_ok=True)

        result = subprocess.run(
            ["cmake", "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON", ".."],
            cwd=build_dir,
            capture_output=True,
            timeout=120,
        )

        if result.returncode == 0:
            src = build_dir / "compile_commands.json"
            dst = root / "compile_commands.json"
            if src.exists():
                shutil.copy(src, dst)
                return True

    except subprocess.TimeoutExpired:
        print(f"  [LSP Config] CMake timed out")
    except Exception as e:
        print(f"  [LSP Config] CMake failed: {e}")
    finally:
        # Clean up build directory
        if build_dir.exists():
            shutil.rmtree(build_dir, ignore_errors=True)
    return False

def _generate_compile_commands_bear(repo_root: str) -> bool:
    """
    Generate compile_commands.json using Bear + Make.
    Bear intercepts compiler calls during make to generate the database.

    Returns:
        True if successful, False otherwise
    """
    root = Path(repo_root)

    if not (root / "Makefile").exists():
        return False

    if not shutil.which("bear"):
        return False

    try:
        # Use make -n (dry run) with bear
        result = subprocess.run(
            ["bear", "--", "make", "-n"],
            cwd=root,
            capture_output=True,
            timeout=120,
        )

        if result.returncode == 0 and (root / "compile_commands.json").exists():
            return True

    except subprocess.TimeoutExpired:
        print(f"  [LSP Config] Bear timed out")
    except Exception as e:
        print(f"  [LSP Config] Bear failed: {e}")
    return False

def _generate_compile_commands_heuristic(repo_root: str) -> Optional[Path]:
    """
    Generate compile_commands.json by scanning source files.
    This is a fallback when CMake/Bear aren't available. It scans for
    C/C++ source files and generates basic compile commands with guessed flags.
    Note: clangd automatically detects MSVC/Windows SDK include paths on Windows,
    so we don't need to manually specify them here.

    Returns:
        Path to generated file, or None if no C/C++ files found
    """
    root = Path(repo_root)
    commands: List[Dict[str, str]] = []

    # Find common include directories
    include_dirs = [str(root)]
    for candidate in ["include", "inc", "src", "lib", "third_party", "external"]:
        candidate_path = root / candidate
        if candidate_path.exists() and candidate_path.is_dir():
            include_dirs.append(str(candidate_path))

    # Scan for source files
    c_extensions = {".c"}
    cpp_extensions = {".cpp", ".cc", ".cxx", ".c++"}

    for src_file in root.rglob("*"):
        # Skip non-source files
        if src_file.suffix.lower() not in c_extensions | cpp_extensions:
            continue

        # Skip excluded directories
        if any(skip_dir in src_file.parts for skip_dir in SKIP_DIRS):
            continue

        # Determine language
        is_cpp = src_file.suffix.lower() in cpp_extensions

        # Build command with reasonable defaults
        compiler = "clang++" if is_cpp else "clang"
        std_flag = "-std=c++17" if is_cpp else "-std=c11"

        flags = [compiler, std_flag]
        flags.extend(f"-I{d}" for d in include_dirs)
        flags.append(f"-I{src_file.parent}")  # Include file's own directory

        commands.append({
            "directory": str(root),
            "file": str(src_file),
            "command": " ".join(flags + ["-c", str(src_file)]),
        })

    if not commands:
        return None

    cc_path = root / "compile_commands.json"
    cc_path.write_text(json.dumps(commands, indent=2))
    return cc_path


def has_c_cpp_files(repo_root: str) -> bool:
    """
    Check if repository contains C or C++ source files.

    Args:
        repo_root: Root directory of the repository

    Returns:
        True if .c, .cpp, .cc, .cxx, or .h files are found
    """
    root = Path(repo_root)
    c_cpp_extensions = {".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hh"}

    for pattern in ["*.c", "*.cpp", "*.cc", "*.cxx", "*.h", "*.hpp"]:
        for f in root.rglob(pattern):
            # Skip excluded directories
            if not any(skip_dir in f.parts for skip_dir in SKIP_DIRS):
                return True
    return False

def cleanup_compile_commands(repo_root: str, was_generated: bool) -> None:
    """
    Clean up generated compile_commands.json and build artifacts.

    Args:
        repo_root: Root directory of the repository
        was_generated: Whether the compile_commands.json was generated by us
    """
    root = Path(repo_root)

    if was_generated:
        cc_path = root / "compile_commands.json"
        if cc_path.exists():
            cc_path.unlink()
            print(f"  [LSP Config] Cleaned up generated compile_commands.json")

    # Clean up CMake build directory if it exists
    build_dir = root / ".codecompass_build"
    if build_dir.exists():
        shutil.rmtree(build_dir, ignore_errors=True)
        print(f"  [LSP Config] Cleaned up CMake build directory")
