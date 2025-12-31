import {
  type TextSelection,
  getTextSelection,
} from '../utils/getTextSelection';

export interface TextSelectionOptions {
  onTextSelectionChange?(selection: TextSelection | null): void;
}

/**
 * Manages native text selection events within shadow DOM.
 */
export class TextSelectionManager {
  private fileContainer: HTMLElement | undefined;
  private handleSelectionChange: (() => void) | undefined;

  constructor(private options: TextSelectionOptions = {}) {}

  setOptions(options: TextSelectionOptions): void {
    this.options = { ...this.options, ...options };
    this.removeEventListener();
    if (this.options.onTextSelectionChange != null) {
      this.attachEventListener();
    }
  }

  cleanUp(): void {
    this.removeEventListener();
    this.fileContainer = undefined;
  }

  setup(fileContainer: HTMLElement): void {
    if (this.fileContainer !== fileContainer) {
      this.cleanUp();
    }
    this.fileContainer = fileContainer;

    const { onTextSelectionChange } = this.options;
    if (onTextSelectionChange != null) {
      this.attachEventListener();
    } else {
      this.removeEventListener();
    }
  }

  private attachEventListener(): void {
    if (
      this.handleSelectionChange != null ||
      this.fileContainer?.shadowRoot == null
    ) {
      return;
    }

    const { onTextSelectionChange } = this.options;
    if (onTextSelectionChange == null) {
      return;
    }

    this.handleSelectionChange = () => {
      const selection = getTextSelection(this.fileContainer);
      onTextSelectionChange(selection);
    };

    this.fileContainer.shadowRoot.addEventListener(
      'selectionchange',
      this.handleSelectionChange
    );
  }

  private removeEventListener(): void {
    if (
      this.handleSelectionChange != null &&
      this.fileContainer?.shadowRoot != null
    ) {
      this.fileContainer.shadowRoot.removeEventListener(
        'selectionchange',
        this.handleSelectionChange
      );
      this.handleSelectionChange = undefined;
    }
  }
}
