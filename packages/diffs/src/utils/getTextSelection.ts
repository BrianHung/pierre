import type { AnnotationSide } from '../types';

interface ShadowRootWithSelection extends ShadowRoot {
  getSelection(): Selection | null;
}

function hasShadowRootSelection(
  shadowRoot: ShadowRoot
): shadowRoot is ShadowRootWithSelection {
  return (
    'getSelection' in shadowRoot &&
    typeof (shadowRoot as ShadowRootWithSelection).getSelection === 'function'
  );
}

export interface TextSelection {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  text: string;
  side?: AnnotationSide;
  endSide?: AnnotationSide;
  getBoundingClientRect(): DOMRect;
  range: Range;
}

interface LinePosition {
  lineNumber: number;
  column: number;
  side?: AnnotationSide;
}

/**
 * Gets text selection from shadow DOM and converts to line/column coordinates.
 */
export function getTextSelection(
  fileContainer: HTMLElement | undefined
): TextSelection | null {
  if (fileContainer?.shadowRoot == null) {
    return null;
  }

  if (!hasShadowRootSelection(fileContainer.shadowRoot)) {
    return null;
  }

  const selection = fileContainer.shadowRoot.getSelection();
  if (selection == null || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (range.collapsed) {
    return null;
  }

  const startPos = getLinePosition(range.startContainer, range.startOffset);
  const endPos = getLinePosition(range.endContainer, range.endOffset);

  if (startPos == null || endPos == null) {
    return null;
  }

  return {
    startRow: startPos.lineNumber,
    startColumn: startPos.column,
    endRow: endPos.lineNumber,
    endColumn: endPos.column,
    text: range.toString(),
    side: startPos.side,
    endSide: startPos.side !== endPos.side ? endPos.side : undefined,
    getBoundingClientRect: () => range.getBoundingClientRect(),
    range,
  };
}

/**
 * Walks up the DOM tree to find line number and column position.
 */
function getLinePosition(node: Node, offset: number): LinePosition | null {
  let currentNode: Node | null = node;
  let lineElement: Element | null = null;
  let contentColumn: Element | null = null;

  while (currentNode != null) {
    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const element = currentNode as Element;

      if (
        contentColumn == null &&
        element.hasAttribute('data-column-content')
      ) {
        contentColumn = element;
      }

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

  const lineNumber = parseInt(lineElement.getAttribute('data-line') ?? '', 10);

  if (isNaN(lineNumber)) {
    return null;
  }

  let side: AnnotationSide | undefined;
  const lineType = lineElement.getAttribute('data-line-type');
  if (lineType === 'change-addition' || lineType === 'context-expanded') {
    side = 'additions';
  } else if (lineType === 'change-deletion') {
    side = 'deletions';
  } else {
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

  const column = calculateColumnOffset(contentColumn, node, offset);

  return {
    lineNumber,
    column,
    side,
  };
}

/**
 * Calculates character offset within a line's content column.
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
    return 0;
  }
}
