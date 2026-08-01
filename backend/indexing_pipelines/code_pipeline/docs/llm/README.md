# LLM Provider Architecture for AI Documentation

This directory contains the pluggable LLM provider architecture for fast, concurrent summarization.

## Overview

The provider pattern allows you to choose between different LLM backends:
- **OpenAI** (cloud API, high quality, costs money)
- **Ollama** (local models, free, requires local Ollama installation)

All providers support **async concurrent execution** for 10-30x faster summarization compared to sequential processing.

## Quick Start

### Using OpenAI (Cloud API)

```bash
# Set your API key
export OPENAI_API_KEY='sk-...'  # Linux/Mac
# or
set OPENAI_API_KEY=sk-...  # Windows

# Run async summarization (FAST mode - default, recommended)
python test_summarization_async.py --provider openai --concurrency 10 --all

# Optional: Run with detailed summaries (slower, more tokens)
python test_summarization_async.py --provider openai --concurrency 10 --all --detailed
```

### Using Ollama (Local)

```bash
# Start Ollama server (in separate terminal)
ollama serve

# Pull a model if you haven't already
ollama pull deepseek-r1

# Run async summarization (free, no API key needed, FAST mode)
python test_summarization_async.py --provider ollama --model deepseek-r1 --concurrency 50 --all
```

## Architecture

### Abstract Base Class

[providers.py](providers.py) - Defines `LLMProvider` interface:
- `async def summarize_definition()` - For methods/functions
- `async def summarize_class()` - For classes
- `async def summarize_file()` - For files
- `async def summarize_module()` - For modules/packages

### Implementations

**[openai_provider.py](openai_provider.py)** - OpenAI API provider
- Uses `AsyncOpenAI` client
- Semaphore-based rate limiting
- Automatic retry with exponential backoff for 429 errors
- Configurable concurrency (default: 10 for Tier 1, 50 for Tier 2)

**[ollama_provider.py](ollama_provider.py)** - Ollama local provider
- Uses `ollama.AsyncClient`
- No rate limits (local execution)
- Higher concurrency (default: 50)
- Supports llama3.2, gemma, mistral, codellama, etc.

### Batch Execution

[async_executor.py](async_executor.py) - Generic async batch processing:
- `async_batch_process()` - Process items concurrently
- `async_batch_process_with_tracking()` - With detailed progress tracking
- Handles errors gracefully
- Returns statistics

## Usage in Code

### Basic Example

```python
import asyncio
from docs.llm import OpenAIProvider
from docs.summarizers.definition_summarizer import async_summarize_definitions
from core.code_indexing import CodeIndexer
from languages.python_handler import PythonHandler

async def main():
    # Build graph
    indexer = CodeIndexer("my_repo", handlers=[PythonHandler()])
    graph = indexer.index_directory()

    # Create provider
    provider = OpenAIProvider(model="gpt-4o-mini", max_concurrent=10)

    try:
        # Run async summarization (FAST!)
        stats = await async_summarize_definitions(graph, provider, verbose=True)
        print(f"Summarized {stats['succeeded']} definitions")
    finally:
        await provider.close()

asyncio.run(main())
```

### Using Ollama

```python
from docs.llm import OllamaProvider

provider = OllamaProvider(
    model="llama3.2",
    host="http://localhost:11434",
    max_concurrent=50
)
```

### From Sync Code

All async functions have `_sync` wrappers:

```python
from docs.llm import OpenAIProvider
from docs.summarizers.definition_summarizer import async_summarize_definitions_sync

# No async/await needed
provider = OpenAIProvider()
stats = async_summarize_definitions_sync(graph, provider)
```

## Performance

### Sequential (Old)
- ~793 definitions in pacai
- ~2 seconds per API call (with detailed summaries)
- **Total: 26+ minutes**

### Async Concurrent (New) - FAST Mode (Default)
- Same 793 definitions
- 10 concurrent requests (OpenAI Tier 1)
- **Short summaries only** (no detailed summaries - not used by pipeline)
- **Total: 1-2 minutes (15-20x faster)**
- 50 concurrent requests (Ollama local)
- **Total: 30-60 seconds (30-40x faster)**

### Async Concurrent - DETAILED Mode (Optional)
- If you need detailed summaries (e.g., for manual review)
- Use `--detailed` flag
- **Total: 2-3 minutes (10x faster)**

## Rate Limits (OpenAI)

### Tier 1 (Default)
- 500 RPM (requests per minute)
- 200,000 TPM (tokens per minute)
- **Recommended concurrency: 10**

### Tier 2
- 5,000 RPM
- 2,000,000 TPM
- **Recommended concurrency: 50**

The providers automatically handle rate limiting with semaphores and retry logic.

## CLI Options

```bash
# Run full pipeline with OpenAI (FAST mode - default)
python test_summarization_async.py --provider openai --all

# Run with detailed summaries (slower, but includes detailed descriptions)
python test_summarization_async.py --provider openai --all --detailed

# Run specific stages
python test_summarization_async.py --provider openai --definitions
python test_summarization_async.py --provider openai --classes
python test_summarization_async.py --provider openai --files
python test_summarization_async.py --provider openai --modules

# Use Ollama with custom model (FAST mode)
python test_summarization_async.py --provider ollama --model deepseek-r1 --concurrency 100

# Quiet mode
python test_summarization_async.py --provider openai --quiet

# Custom repository
python test_summarization_async.py --provider openai --repo /path/to/repo
```

### Key Flags

- `--provider {openai,ollama}` - LLM provider (default: openai)
- `--model MODEL` - Model name (default: gpt-4o-mini or deepseek-r1)
- `--concurrency N` - Concurrent requests (default: 10 for OpenAI, 50 for Ollama)
- `--detailed` - Generate detailed summaries (slower, more tokens). **Default: False (FAST mode)**
- `--all` - Run full pipeline (definitions → classes → files → modules)
- `--definitions` / `--classes` / `--files` / `--modules` - Run specific stages
- `--repo PATH` - Repository path (default: example_repos/pacai)
- `--quiet` - Suppress progress updates

## Adding New Providers

To add a new provider (e.g., Anthropic Claude, Google Gemini):

1. Create new file: `docs/llm/your_provider.py`
2. Subclass `LLMProvider`
3. Implement all async methods
4. Add to `docs/llm/__init__.py`
5. Update test script with new provider option

Example:

```python
from docs.llm.providers import LLMProvider, SummaryResult

class AnthropicProvider(LLMProvider):
    def __init__(self, api_key, model="claude-3-5-sonnet", max_concurrent=10):
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def summarize_definition(self, code, definition_type, name):
        # Implementation here
        pass

    # ... implement other methods
```

## Backward Compatibility

All original sync functions are preserved:
- `summarize_definitions()` - Original sync version
- `async_summarize_definitions()` - New async version
- `async_summarize_definitions_sync()` - Sync wrapper for async version

Use the async versions for production (10-30x faster).
