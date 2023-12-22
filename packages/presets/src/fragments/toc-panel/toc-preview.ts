import type {
  AffineTextAttributes,
  AttachmentBlockModel,
  BlockModels,
  BookmarkBlockModel,
  CodeBlockModel,
  DatabaseBlockModel,
  ImageBlockModel,
  ListBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/blocks';
import { BlocksUtils } from '@blocksuite/blocks';
import { DisposableGroup, noop } from '@blocksuite/global/utils';
import type { DeltaInsert } from '@blocksuite/inline';
import { WithDisposable } from '@blocksuite/lit';
import { css, html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import { SmallLinkedPageIcon } from '../_common/icons.js';
import { placeholderMap, previewIconMap } from './config.js';

type ValuesOf<T, K extends keyof T = keyof T> = T[K];

function assertType<T>(value: unknown): asserts value is T {
  noop(value);
}

export class TOCBlockPreview extends WithDisposable(LitElement) {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .toc-block-preview {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      white-space: nowrap;
      display: flex;
      justify-content: start;
      align-items: center;
      gap: 8px;
    }

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      box-sizing: border-box;
      padding: 4px;
      background: var(--affine-background-secondary-color);
      border-radius: 4px;
      color: var(--affine-icon-color);
    }

    .icon.disabled {
      color: var(--affine-disabled-icon-color);
    }

    .text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;

      font-size: var(--affine-font-sm);
      line-height: 24px;
      height: 24px;
    }

    .text.general,
    .subtype.text,
    .subtype.quote {
      font-weight: 400;
      padding-left: 28px;
    }

    .subtype.h1,
    .subtype.h2,
    .subtype.h3,
    .subtype.h4,
    .subtype.h5,
    .subtype.h6 {
      font-weight: 600;
    }

    .subtype.h1 {
      padding-left: 0;
    }
    .subtype.h2 {
      padding-left: 4px;
    }
    .subtype.h3 {
      padding-left: 12px;
    }
    .subtype.h4 {
      padding-left: 16px;
    }
    .subtype.h5 {
      padding-left: 20px;
    }
    .subtype.h6 {
      padding-left: 24px;
    }

    .toc-block-preview:not(:has(span)) {
      display: none;
    }

    .text span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .linked-page-preview svg {
      width: 1.1em;
      height: 1.1em;
      vertical-align: middle;
      font-size: inherit;
      margin-bottom: 0.1em;
    }

    .linked-page-text {
      font-size: inherit;
      border-bottom: 0.5px solid var(--affine-divider-color);
      white-space: break-spaces;
      margin-right: 2px;
    }

    .linked-page-preview.unavailable svg {
      color: var(--affine-text-disable-color);
    }

    .linked-page-preview.unavailable .linked-page-text {
      color: var(--affine-text-disable-color);
      text-decoration: line-through;
    }
  `;

  @property({ attribute: false })
  block!: ValuesOf<BlockModels>;

  @property({ attribute: false })
  hidePreviewIcon!: boolean;

  @property({ attribute: false })
  disabledIcon = false;

  @property({ attribute: false })
  cardNumber!: number;

  private _textDisposables: DisposableGroup | null = null;

  private _clearTextDisposables = () => {
    this._textDisposables?.dispose();
    this._textDisposables = null;
  };

  private _setTextDisposables = (block: ValuesOf<BlockModels>) => {
    this._clearTextDisposables();
    this._textDisposables = new DisposableGroup();
    block.text?.yText.observe(this._updateElement);
    this._textDisposables.add({
      dispose: () => block.text?.yText.unobserve(this._updateElement),
    });
    this._textDisposables.add(this.block.propsUpdated.on(this._updateElement));
  };

  private _updateElement = () => {
    this.requestUpdate();
  };

  private _TextBlockPreview(block: ParagraphBlockModel | ListBlockModel) {
    const deltas: DeltaInsert<AffineTextAttributes>[] =
      block.text.yText.toDelta();
    if (!deltas?.length) return nothing;
    const iconClass = this.disabledIcon ? 'icon disabled' : 'icon';

    const previewText = deltas.map(delta => {
      if (delta.attributes?.reference) {
        // If linked page, render linked page icon and the page title.
        const refAttribute = delta.attributes.reference;
        const refMeta = block.page.workspace.meta.pageMetas.find(
          page => page.id === refAttribute.pageId
        );
        const unavailable = !refMeta;
        const title = unavailable ? 'Deleted page' : refMeta.title;
        return html`<span
          class="linked-page-preview ${unavailable ? 'unavailable' : ''}"
          >${SmallLinkedPageIcon}
          <span class="linked-page-text"
            >${title.length ? title : 'Untitled'}</span
          ></span
        >`;
      } else {
        // If not linked page, render the text.
        return delta.insert.toString().trim().length > 0
          ? html`<span>${delta.insert.toString()}</span>`
          : nothing;
      }
    });

    return html`<span class="text subtype ${block.type}">${previewText}</span>
      ${!this.hidePreviewIcon
        ? html`<span class=${iconClass}>${previewIconMap[block.type]}</span>`
        : nothing}`;
  }

  override connectedCallback(): void {
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._clearTextDisposables();
  }

  override updated() {
    this.updateComplete
      .then(() => {
        if (
          BlocksUtils.matchFlavours(this.block, [
            'affine:paragraph',
            'affine:list',
          ])
        ) {
          this._setTextDisposables(this.block);
        }
      })
      .catch(console.error);
  }

  renderBlockByFlavour() {
    const { block } = this;
    const iconClass = this.disabledIcon ? 'icon disabled' : 'icon';

    switch (block.flavour as keyof BlockModels) {
      case 'affine:paragraph':
        assertType<ParagraphBlockModel>(block);
        return this._TextBlockPreview(block);
      case 'affine:list':
        assertType<ListBlockModel>(block);
        return this._TextBlockPreview(block);
      case 'affine:bookmark':
        assertType<BookmarkBlockModel>(block);
        return html`
          <span class="text general"
            >${block.title || block.url || placeholderMap['bookmark']}</span
          >
          ${!this.hidePreviewIcon
            ? html`<span class=${iconClass}
                >${previewIconMap['bookmark']}</span
              >`
            : nothing}
        `;
      case 'affine:code':
        assertType<CodeBlockModel>(block);
        return html`
          <span class="text general"
            >${block.language ?? placeholderMap['code']}</span
          >
          ${!this.hidePreviewIcon
            ? html`<span class=${iconClass}>${previewIconMap['code']}</span>`
            : nothing}
        `;
      case 'affine:database':
        assertType<DatabaseBlockModel>(block);
        return html`
          <span class="text general"
            >${block.title.toString().length
              ? block.title.toString()
              : placeholderMap['database']}</span
          >
          ${!this.hidePreviewIcon
            ? html`<span class=${iconClass}>${previewIconMap['table']}</span>`
            : nothing}
        `;
      case 'affine:image':
        assertType<ImageBlockModel>(block);
        return html`
          <span class="text general"
            >${block.caption?.length
              ? block.caption
              : placeholderMap['image']}</span
          >
          ${!this.hidePreviewIcon
            ? html`<span class=${iconClass}>${previewIconMap['image']}</span>`
            : nothing}
        `;
      case 'affine:attachment':
        assertType<AttachmentBlockModel>(block);
        return html`
          <span class="text general"
            >${block.name?.length
              ? block.name
              : placeholderMap['attachment']}</span
          >
          ${!this.hidePreviewIcon
            ? html`<span class=${iconClass}
                >${previewIconMap['attachment']}</span
              >`
            : nothing}
        `;
      default:
        return nothing;
    }
  }

  override render() {
    return html`<div class="toc-block-preview">
      ${this.renderBlockByFlavour()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toc-block-preview': TOCBlockPreview;
  }
}
