'use client';

/**
 * registry.tsx
 * ============
 * The `type` → component map. This is the extension seam: the only type the
 * schema defines and this renderer still does not draw is `screenshot`, which
 * needs a video frame the backend never downloads.
 *
 * Nothing else in the renderer switches on element type.
 */

import type { ReactNode } from 'react';
import BulletList from './BulletList';
import CodeBlock from './CodeBlock';
import Comparison from './Comparison';
import Definition from './Definition';
import Diagram from './Diagram';
import Example from './Example';
import Flowchart from './Flowchart';
import Heading from './Heading';
import ImportantNote from './ImportantNote';
import MindMap from './MindMap';
import Paragraph from './Paragraph';
import StickyFormula from './StickyFormula';
import Summary from './Summary';
import Timeline from './Timeline';
import Unsupported from './Unsupported';
import type {
  BulletListElement,
  CodeBlockElement,
  ComparisonElement,
  DefinitionElement,
  DiagramElement,
  ExampleElement,
  FlowchartElement,
  HeadingElement,
  ImportantNoteElement,
  MindMapElement,
  NotebookElement,
  ParagraphElement,
  StickyFormulaElement,
  SummaryElement,
  TimelineElement,
} from '@/lib/types';

/** Every schema type with a real renderer. `screenshot` is the only omission. */
export const IMPLEMENTED = [
  'heading',
  'definition',
  'bullet_list',
  'important_note',
  'sticky_formula',
  'summary',
  'paragraph',
  'example',
  'code_block',
  'comparison',
  'flowchart',
  'timeline',
  'diagram',
  'mind_map',
] as const;

export function isImplemented(type: string): boolean {
  return (IMPLEMENTED as readonly string[]).includes(type);
}

export interface RenderArgs {
  element: NotebookElement;
  /** Stable per-element seed — same document renders identically every time. */
  seed: string;
  /** True for the tail fragment of a split element. */
  continued?: boolean;
}

export function renderElement({ element, seed, continued }: RenderArgs): ReactNode {
  switch (element.type) {
    case 'heading':
      return <Heading el={element as HeadingElement} seed={seed} />;
    case 'definition':
      return <Definition el={element as DefinitionElement} seed={seed} />;
    case 'bullet_list':
      return (
        <BulletList el={element as BulletListElement} seed={seed} continued={continued} />
      );
    case 'important_note':
      return <ImportantNote el={element as ImportantNoteElement} seed={seed} />;
    case 'sticky_formula':
      return <StickyFormula el={element as StickyFormulaElement} seed={seed} />;
    case 'summary':
      return <Summary el={element as SummaryElement} seed={seed} continued={continued} />;
    case 'paragraph':
      return <Paragraph el={element as ParagraphElement} seed={seed} />;
    case 'example':
      return <Example el={element as ExampleElement} seed={seed} />;
    case 'code_block':
      return <CodeBlock el={element as CodeBlockElement} seed={seed} continued={continued} />;
    case 'comparison':
      return <Comparison el={element as ComparisonElement} seed={seed} continued={continued} />;
    case 'flowchart':
      return <Flowchart el={element as FlowchartElement} seed={seed} continued={continued} />;
    case 'timeline':
      return <Timeline el={element as TimelineElement} seed={seed} continued={continued} />;
    case 'diagram':
      return <Diagram el={element as DiagramElement} seed={seed} />;
    case 'mind_map':
      return <MindMap el={element as MindMapElement} seed={seed} />;
    default:
      return <Unsupported el={element} />;
  }
}
