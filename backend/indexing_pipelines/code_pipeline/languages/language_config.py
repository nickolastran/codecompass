"""
Language Configuration for CodeCompass

Defines which language handlers are enabled for the system.
To add support for a new language:
1. Implement a LanguageHandler subclass in languages/
2. Add an instance to the ENABLED_LANGUAGES list below
"""

from indexing_pipelines.code_pipeline.languages.python_handler import PythonHandler
from indexing_pipelines.code_pipeline.languages.typescript_handler import TypeScriptHandler
from indexing_pipelines.code_pipeline.languages.c_handler import CHandler
from indexing_pipelines.code_pipeline.languages.cpp_handler import CppHandler

# List of enabled language handlers
# Each handler instance provides language-specific parsing and LSP configuration
ENABLED_LANGUAGES = [
    PythonHandler(),
    TypeScriptHandler(),  # Handles .ts, .tsx, .js, .jsx
    CHandler(),           # Handles .c files
    CppHandler(),         # Handles .cpp, .hpp, .cc, .cxx, .h files
    # GoHandler(),        # Uncomment when Go support is ready
    # RustHandler(),      # Uncomment when Rust support is ready
]
