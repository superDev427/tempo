# Code Review

The implementation uses `ConcurrentHashMap`, which is a reasonable starting point for a concurrent cache. However, there are several issues that would become problematic in a production system under high concurrency and sustained load.

---

## 1. Expired entries are never removed

### Problem

The cache checks whether an entry is expired inside `get()`, but expired entries remain in the map forever.

```kotlin
if (System.currentTimeMillis() - entry.timestamp < ttlMs) {
    return entry.value
}
```

If the entry is expired, the method simply returns `null`.

### Impact

Over time, the map will continue growing even if most entries are no longer valid. In a long-running service with many unique keys, this can eventually lead to excessive memory usage and GC pressure.

### Recommendation

Remove expired entries when detected.

```kotlin
if (System.currentTimeMillis() - entry.timestamp >= ttlMs) {
    cache.remove(key, entry)
    return null
}
```

---

## 2. `get()` is not fully atomic

### Problem

The method performs multiple operations separately:

1. Read entry from map
2. Check timestamp
3. Return value

Another thread can update or remove the same key between those steps.

### Impact

Under concurrency, callers may observe stale values or inconsistent behavior.

For example:

- Thread A reads an entry
- Thread B updates the same key
- Thread A still returns the old value

### Recommendation

Use atomic operations where possible, especially when modifying state.

At minimum, use:

```kotlin
cache.remove(key, entry)
```

instead of unconditional removal.

---

## 3. Cache size is unbounded

### Problem

The cache has no maximum size and no eviction policy.

### Impact

If the application keeps inserting new keys, memory usage can grow indefinitely.

This is particularly dangerous in systems with:

- user-generated keys
- high-cardinality workloads
- long-running processes

### Recommendation

Introduce:

- maximum size limits
- eviction policies
- periodic cleanup

or use a mature caching library such as Caffeine.

---

## 4. Hardcoded TTL

### Problem

The TTL value is fixed:

```kotlin
private val ttlMs = 60000
```

### Impact

The cache cannot be configured for different workloads or environments.

### Recommendation

Make TTL configurable.

```kotlin
class SimpleCache<K, V>(
    private val ttlMs: Long = 60_000
)
```

---

## 5. No validation for invalid TTL values

### Problem

There is no validation for zero or negative TTL values.

### Impact

Invalid TTL values can cause entries to expire immediately, resulting in confusing behavior and unnecessary cache misses.

### Recommendation

Validate constructor arguments.

```kotlin
require(ttlMs > 0) {
    "ttlMs must be positive"
}
```

---

## 6. Uses `System.currentTimeMillis()` for elapsed time measurement

### Problem

The implementation relies on wall-clock time.

```kotlin
System.currentTimeMillis()
```

### Impact

System clock adjustments can affect expiration behavior.

Entries may expire too early or remain valid longer than expected.

### Recommendation

Use `System.nanoTime()` for measuring elapsed time.

---

## 7. `size()` may be misleading

### Problem

`size()` returns the raw map size.

```kotlin
fun size(): Int {
    return cache.size
}
```

Expired entries are still counted.

### Impact

The reported size does not necessarily represent the number of valid cache entries.

### Recommendation

Either:

- clean expired entries before returning size
- or clearly document the behavior

---

# Improved Version

```kotlin
import java.util.concurrent.ConcurrentHashMap

class SimpleCache<K, V>(
    private val ttlMs: Long = 60_000
) {

    init {
        require(ttlMs > 0) {
            "ttlMs must be positive"
        }
    }

    private data class CacheEntry<V>(
        val value: V,
        val timestampNanos: Long
    )

    private val cache = ConcurrentHashMap<K, CacheEntry<V>>()

    fun put(key: K, value: V) {
        cache[key] = CacheEntry(
            value,
            System.nanoTime()
        )
    }

    fun get(key: K): V? {

        val entry = cache[key] ?: return null

        val elapsedMs =
            (System.nanoTime() - entry.timestampNanos) / 1_000_000

        return if (elapsedMs < ttlMs) {
            entry.value
        } else {

            cache.remove(key, entry)

            null
        }
    }

    fun size(): Int {
        cleanupExpiredEntries()
        return cache.size
    }

    private fun cleanupExpiredEntries() {

        val now = System.nanoTime()

        cache.entries.removeIf { (_, entry) ->

            val elapsedMs =
                (now - entry.timestampNanos) / 1_000_000

            elapsedMs >= ttlMs
        }
    }
}
```

---

# Final Notes

The current implementation is acceptable as a simple prototype, but it is not sufficient for a production-grade cache under heavy concurrency.

The biggest concerns are:

- expired entries accumulating indefinitely
- lack of bounded memory usage
- concurrency edge cases
- reliance on wall-clock time

In production systems, it is usually better to use a mature caching library such as Caffeine rather than maintaining custom cache logic.