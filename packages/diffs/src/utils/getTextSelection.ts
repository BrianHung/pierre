import type { AnnotationSide } from '../types';

/**
 * Extended ShadowRoot interface with getSelection() method.
 * Note: ShadowRoot.getSelection() is supported in:
 * - Chrome 53+
 * - Firefox 127+
 * - Safari 13.1+
 */
interface ShadowRootWithSelection extends ShadowRoot {
  getSelection(): Selection | null;
}

/**
 * Type guard to check if ShadowRoot has getSelection method.
 */
function hasShadowRootSelection(
  shadowRoot: ShadowRoot
): shadowRoot is ShadowRootWithSelection {
  return 'getSelection' in shadowRoot && typeof (shadowRoot as ShadowRootWithSelection).getSelection === 'function';
}

export interface TextSelection {
  // Line numbers (1-based, from data-line attribute)
  startRow: number;
  endRow: number;

  // Column offsets (0-based character position within line)
  startCol: number;
  endCol: number;

  // Selected text content
  text: string;

  // Diff side (for FileDiff only)
  side?: AnnotationSide;
  endSide?: AnnotationSide;

  // Bounding box of selection
  getBoundingClientRect(): DOMRect;

  // Native Range object - clone if storing beyond callback scope
  range: Range;

  // Floating UI compatible virtual element
  virtualElement: {
    getBoundingClientRect: () => DOMRect;
  };
}

interface LinePosition {
  lineNumber: number;
  column: number;
  side?: AnnotationSide;
}

/**
 * Gets the native text selection from within a shadow DOM container
 * and converts it to line/column coordinates.
 *
 * @param fileContainer - The container element (with shadow root)
 * @returns TextSelection object with row/col/text/rect, or null if no selection
 */
export function getTextSelection(
  fileContainer: HTMLElement | undefined
): TextSelection | null {
  if (fileContainer?.shadowRoot == null) {
    return null;
  }

  // Check if ShadowRoot.getSelection() is supported
  if (!hasShadowRootSelection(fileContainer.shadowRoot)) {
    return null;
  }

  // Get selection from shadow DOM
  const selection = fileContainer.shadowRoot.getSelection();
  if (selection == null || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  // If selection is collapsed (just a cursor), return null
  if (range.collapsed) {
    return null;
  }

  // Get start and end positions
  const startPos = getLinePosition(range.startContainer, range.startOffset);
  const endPos = getLinePosition(range.endContainer, range.endOffset);

  if (startPos == null || endPos == null) {
    return null;
  }

  return {
    startRow: startPos.lineNumber,
    startCol: startPos.column,
    endRow: endPos.lineNumber,
    endCol: endPos.column,
    text: range.toString(),
    side: startPos.side,
    endSide: startPos.side !== endPos.side ? endPos.side : undefined,
    getBoundingClientRect: () => range.getBoundingClientRect(),
    range,
    virtualElement: {
      getBoundingClientRect: () => range.getBoundingClientRect(),
    },
  };
}

/**
 * Walks up the DOM tree to find the line number and calculates
 * the column position within that line.
 */
function getLinePosition(node: Node, offset: number): LinePosition | null {
  let currentNode: Node | null = node;
  let lineElement: Element | null = null;
  let contentColumn: Element | null = null;

  // Walk up to find the line element (has data-line attribute)
  while (currentNode != null) {
    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const element = currentNode as Element;

      // Find the content column if we haven't yet
      if (contentColumn == null && element.hasAttribute('data-column-content')) {
        contentColumn = element;
      }

      // Check if this is a line element
      if (element.hasAttribute('data-line')) {
        lineElement = element;
        break;
      }
    }
    currentNode = currentNode.parentNode;
  }

  if (lineElement == null || contentColumn == null) {
    return null;
  }

  const lineNumber = parseInt(
    lineElement.getAttribute('data-line') ?? '',
    10
  );

  if (isNaN(lineNumber)) {
    return null;
  }

  // Determine side from data-line-type or parent data-code
  let side: AnnotationSide | undefined;
  const lineType = lineElement.getAttribute('data-line-type');
  if (lineType === 'change-addition' || lineType === 'context-expanded') {
    side = 'additions';
  } else if (lineType === 'change-deletion') {
    side = 'deletions';
  } else {
    // Check parent for data-code attribute
    let parent: Element | null = lineElement.parentElement;
    while (parent != null) {
      if (parent.hasAttribute('data-code')) {
        const codeAttr = parent.getAttribute('data-code');
        if (codeAttr === 'deletions' || codeAttr === 'additions') {
          side = codeAttr as AnnotationSide;
        }
        break;
      }
      parent = parent.parentElement;
    }
  }

  // Calculate column position within the content
  const column = calculateColumnOffset(contentColumn, node, offset);

  return {
    lineNumber,
    column,
    side,
  };
}

/**
 * Calculates the character offset within a line's content column.
 * Uses Range API to get text content from line start to selection point.
 */
function calculateColumnOffset(
  contentColumn: Element,
  targetNode: Node,
  targetOffset: number
): number {
  try {
    const range = document.createRange();
    range.setStart(contentColumn, 0);
    range.setEnd(targetNode, targetOffset);
    return range.toString().length;
  } catch {
    // Fallback if range creation fails (shouldn't happen in practice)
    return 0;
  }
}
