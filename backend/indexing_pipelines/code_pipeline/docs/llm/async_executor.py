"""
Async batch processing utilities for concurrent summarization.

Provides generic async execution with progress tracking and error handling.
"""

import asyncio
from typing import List, Callable, Awaitable, TypeVar, Dict, Any
from dataclasses import dataclass

T = TypeVar('T')


@dataclass
class BatchResult:
    """Result from a batch processing operation."""
    total: int
    succeeded: int
    failed: int
    skipped: int
    errors: List[str]


async def async_batch_process(
    items: List[T],
    process_func: Callable[[T], Awaitable[bool]],
    verbose: bool = True,
    batch_name: str = "items"
) -> BatchResult:
    """
    Process a batch of items concurrently with progress tracking.

    Args:
        items: List of items to process
        process_func: Async function that processes one item and returns success bool
        verbose: Print progress updates
        batch_name: Name for progress messages (e.g., "definitions", "classes")

    Returns:
        BatchResult with statistics
    """
    total = len(items)
    succeeded = 0
    failed = 0
    skipped = 0
    errors = []

    if verbose:
        print(f"Processing {total} {batch_name}...")

    # Create tasks for all items
    tasks = [process_func(item) for item in items]

    # Process with progress tracking
    for i, task in enumerate(asyncio.as_completed(tasks), 1):
        try:
            success = await task
            if success is True:
                succeeded += 1
            elif success is False:
                failed += 1
            else:  # None or other value means skipped
                skipped += 1

            if verbose and i % 10 == 0:
                print(f"  Progress: {i}/{total} ({succeeded} succeeded, {failed} failed, {skipped} skipped)")

        except Exception as e:
            failed += 1
            errors.append(str(e))
            if verbose:
                print(f"  Error processing item: {str(e)}")

    if verbose:
        print(f"Completed: {succeeded} succeeded, {failed} failed, {skipped} skipped")

    return BatchResult(
        total=total,
        succeeded=succeeded,
        failed=failed,
        skipped=skipped,
        errors=errors
    )


async def async_batch_process_with_tracking(
    items: List[T],
    process_func: Callable[[T, int, int], Awaitable[tuple[bool, str]]],
    verbose: bool = True,
    batch_name: str = "items"
) -> Dict[str, Any]:
    """
    Process a batch of items concurrently with detailed progress tracking.

    This version gives process_func access to progress info and expects
    a tuple of (success, item_name) for better logging.

    Args:
        items: List of items to process
        process_func: Async function(item, index, total) -> (success, name)
        verbose: Print progress updates
        batch_name: Name for progress messages

    Returns:
        Dictionary with detailed statistics
    """
    total = len(items)
    stats = {
        "total": total,
        "succeeded": 0,
        "failed": 0,
        "skipped": 0,
        "errors": []
    }

    if total == 0:
        return stats

    if verbose:
        print(f"Processing {total} {batch_name}...")

    # Create tasks with index tracking
    async def process_with_index(idx: int, item: T):
        try:
            success, name = await process_func(item, idx + 1, total)
            return (success, name, None)
        except Exception as e:
            return (False, f"item_{idx}", str(e))

    tasks = [process_with_index(i, item) for i, item in enumerate(items)]

    # Process all concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Aggregate results
    for result in results:
        if isinstance(result, Exception):
            stats["failed"] += 1
            stats["errors"].append(str(result))
        else:
            success, name, error = result
            if success is True:
                stats["succeeded"] += 1
            elif success is False:
                stats["failed"] += 1
                if error:
                    stats["errors"].append(f"{name}: {error}")
            else:  # None means skipped
                stats["skipped"] += 1

    if verbose:
        print(f"\nBatch processing complete:")
        print(f"  Total: {stats['total']}")
        print(f"  Succeeded: {stats['succeeded']}")
        print(f"  Failed: {stats['failed']}")
        print(f"  Skipped: {stats['skipped']}")
        if stats['errors']:
            print(f"  Errors encountered: {len(stats['errors'])}")

    return stats
