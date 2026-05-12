import kotlin.test.*

// The task:
// 1. Read and understand the Hierarchy data structure described in this file.
// 2. Implement filter() function.
// 3. Implement more test cases.
//
// The task should take 30-90 minutes.
//
// When assessing the submission, we will pay attention to:
// - correctness, efficiency, and clarity of the code;
// - the test cases.

/**
 * A `Hierarchy` stores an arbitrary _forest_ (an ordered collection of ordered trees)
 * as an array of node IDs in the order of DFS traversal, combined with a parallel array of node depths.
 *
 * Parent-child relationships are identified by the position in the array and the associated depth.
 * Each tree root has depth 0, its children have depth 1 and follow it in the array, their children have depth 2 and follow them, etc.
 *
 * Example:
 * ```
 * nodeIds: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
 * depths:  0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2
 * ```
 *
 * the forest can be visualized as follows:
 * ```
 * 1
 * - 2
 * - - 3
 * - - - 4
 * - 5
 * 6
 * - 7
 * 8
 * - 9
 * - 10
 * - - 11
 *```
 * 1 is a parent of 2 and 5, 2 is a parent of 3, etc. Note that depth is equal to the number of hyphens for each node.
 *
 * Invariants on the depths array:
 *  * Depth of the first element is 0.
 *  * If the depth of a node is `D`, the depth of the next node in the array can be:
 *      * `D + 1` if the next node is a child of this node;
 *      * `D` if the next node is a sibling of this node;
 *      * `d < D` - in this case the next node is not related to this node.
 */
interface Hierarchy {
  /** The number of nodes in the hierarchy. */
  val size: Int

  /**
   * Returns the unique ID of the node identified by the hierarchy index. The depth for this node will be `depth(index)`.
   * @param index must be non-negative and less than [size]
   * */
  fun nodeId(index: Int): Int

  /**
   * Returns the depth of the node identified by the hierarchy index. The unique ID for this node will be `nodeId(index)`.
   * @param index must be non-negative and less than [size]
   * */
  fun depth(index: Int): Int

  fun formatString(): String {
    return (0 until size).joinToString(
      separator = ", ",
      prefix = "[",
      postfix = "]"
    ) { i -> "${nodeId(i)}:${depth(i)}" }
  }
}

/**
 * A node is present in the filtered hierarchy iff its node ID passes the predicate and all of its ancestors pass it as well.
 */
fun Hierarchy.filter(nodeIdPredicate: (Int) -> Boolean): Hierarchy {
  // Single linear pass over the DFS-ordered array. Because every descendant of a node
  // appears immediately after it with a strictly greater depth, dropping a failing node
  // is the same as skipping the contiguous run of following entries whose depth exceeds
  // its own. The first entry whose depth is not greater starts a new branch (a sibling
  // or an ancestor's sibling) and we resume normal processing.
  val resultIds = IntArray(size)
  val resultDepths = IntArray(size)
  var resultSize = 0

  // -1 means "not inside an excluded subtree".
  // Otherwise, this is the depth of the excluded subtree's root; entries deeper than this are skipped.
  var excludedRootDepth = -1

  for (i in 0 until size) {
    val d = depth(i)
    if (excludedRootDepth >= 0 && d > excludedRootDepth) {
      continue
    }
    excludedRootDepth = -1

    val id = nodeId(i)
    if (nodeIdPredicate(id)) {
      resultIds[resultSize] = id
      resultDepths[resultSize] = d
      resultSize++
    } else {
      excludedRootDepth = d
    }
  }

  return ArrayBasedHierarchy(
    resultIds.copyOf(resultSize),
    resultDepths.copyOf(resultSize),
  )
}

class ArrayBasedHierarchy(
  private val myNodeIds: IntArray,
  private val myDepths: IntArray,
) : Hierarchy {
  override val size: Int = myDepths.size

  override fun nodeId(index: Int): Int = myNodeIds[index]

  override fun depth(index: Int): Int = myDepths[index]
}

class FilterTest {
  private fun assertFilter(
    inputIds: IntArray,
    inputDepths: IntArray,
    expectedIds: IntArray,
    expectedDepths: IntArray,
    predicate: (Int) -> Boolean,
  ) {
    val actual = ArrayBasedHierarchy(inputIds, inputDepths).filter(predicate)
    val expected = ArrayBasedHierarchy(expectedIds, expectedDepths)
    assertEquals(expected.formatString(), actual.formatString())
  }

  @Test
  fun testFilter() {
    val unfiltered: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
      intArrayOf(0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2))
    val filteredActual: Hierarchy = unfiltered.filter { nodeId -> nodeId % 3 != 0 }
    val filteredExpected: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 5, 8, 10, 11),
      intArrayOf(0, 1, 1, 0, 1, 2))
    assertEquals(filteredExpected.formatString(), filteredActual.formatString())
  }

  @Test
  fun testEmptyHierarchy() {
    assertFilter(
      inputIds = intArrayOf(),
      inputDepths = intArrayOf(),
      expectedIds = intArrayOf(),
      expectedDepths = intArrayOf(),
    ) { true }
  }

  @Test
  fun testAllNodesPass() {
    // Predicate keeps everything: result is identical to the input.
    assertFilter(
      inputIds = intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
      inputDepths = intArrayOf(0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2),
      expectedIds = intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
      expectedDepths = intArrayOf(0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2),
    ) { true }
  }

  @Test
  fun testNoNodesPass() {
    assertFilter(
      inputIds = intArrayOf(1, 2, 3),
      inputDepths = intArrayOf(0, 1, 1),
      expectedIds = intArrayOf(),
      expectedDepths = intArrayOf(),
    ) { false }
  }

  @Test
  fun testFailingRootRemovesEntireTree() {
    // Root 1 fails; despite its descendants passing, the whole tree under 1 is dropped.
    // The other root (10) and its subtree are untouched.
    assertFilter(
      inputIds = intArrayOf(1, 2, 3, 4, 10, 11),
      inputDepths = intArrayOf(0, 1, 2, 1, 0, 1),
      expectedIds = intArrayOf(10, 11),
      expectedDepths = intArrayOf(0, 1),
    ) { it != 1 }
  }

  @Test
  fun testPassingNodeUnderFailingAncestorIsExcluded() {
    // 2 fails, so 3 and 4 are excluded even though they pass (their ancestor 2 fails).
    // 5 (sibling of 2) and its child 6 survive.
    assertFilter(
      inputIds = intArrayOf(1, 2, 3, 4, 5, 6),
      inputDepths = intArrayOf(0, 1, 2, 2, 1, 2),
      expectedIds = intArrayOf(1, 5, 6),
      expectedDepths = intArrayOf(0, 1, 2),
    ) { it != 2 }
  }

  @Test
  fun testDeepestLeafFailing() {
    // Only the deepest leaf fails; its ancestor chain remains intact.
    assertFilter(
      inputIds = intArrayOf(1, 2, 3, 4),
      inputDepths = intArrayOf(0, 1, 2, 3),
      expectedIds = intArrayOf(1, 2, 3),
      expectedDepths = intArrayOf(0, 1, 2),
    ) { it != 4 }
  }

  @Test
  fun testSingleNodePassing() {
    assertFilter(
      inputIds = intArrayOf(42),
      inputDepths = intArrayOf(0),
      expectedIds = intArrayOf(42),
      expectedDepths = intArrayOf(0),
    ) { true }
  }

  @Test
  fun testSingleNodeFailing() {
    assertFilter(
      inputIds = intArrayOf(42),
      inputDepths = intArrayOf(0),
      expectedIds = intArrayOf(),
      expectedDepths = intArrayOf(),
    ) { false }
  }

  @Test
  fun testMultipleRootsMixedOutcomes() {
    // Roots: 1 (passes), 2 (fails -> subtree gone), 3 (passes).
    assertFilter(
      inputIds = intArrayOf(1, 10, 2, 20, 3, 30),
      inputDepths = intArrayOf(0, 1, 0, 1, 0, 1),
      expectedIds = intArrayOf(1, 10, 3, 30),
      expectedDepths = intArrayOf(0, 1, 0, 1),
    ) { it != 2 }
  }

  @Test
  fun testConsecutiveFailingSubtreesAtDifferentDepths() {
    // 2 fails (depth 1) and 7 fails (depth 0). Verifies the skip state resets correctly
    // when one excluded subtree ends and another begins immediately afterwards.
    assertFilter(
      inputIds = intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9),
      inputDepths = intArrayOf(0, 1, 2, 2, 1, 2, 0, 1, 1),
      expectedIds = intArrayOf(1, 5, 6),
      expectedDepths = intArrayOf(0, 1, 2),
    ) { it != 2 && it != 7 }
  }

  @Test
  fun testPredicateNotInvokedOnDescendantsOfExcludedNodes() {
    // Once a node fails, its descendants are skipped without consulting the predicate.
    // This matters for expensive predicates.
    val invoked = mutableListOf<Int>()
    val h: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 3, 4, 5),
      intArrayOf(0, 1, 2, 2, 1),
    )
    h.filter { id ->
      invoked.add(id)
      id != 2  // node 2 fails -> 3 and 4 should never be tested
    }
    assertEquals(listOf(1, 2, 5), invoked)
  }

  @Test
  fun testFilteredResultIsItselfFilterable() {
    // The result of filter() must satisfy the Hierarchy invariants and be re-filterable.
    val base: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
      intArrayOf(0, 1, 2, 3, 1, 0, 1, 0, 1, 1, 2),
    )
    val once = base.filter { it % 3 != 0 }
    val twice = once.filter { it < 10 }
    val expected: Hierarchy = ArrayBasedHierarchy(
      intArrayOf(1, 2, 5, 8),
      intArrayOf(0, 1, 1, 0),
    )
    assertEquals(expected.formatString(), twice.formatString())
  }
}
