/**
 * Type definitions for Molecular Decomposition System
 */

import { Tensor3D, Tensor4D } from '@tensorflow/tfjs-node-gpu';

/**
 * Detected element from computer vision analysis
 */
export interface DetectedElement {
  id: string;
  boundingBox: BoundingBox;
  type: ElementType;
  confidence: number;
  visualFeatures: VisualFeatures;
  children?: DetectedElement[];
  parent?: string;
  depth: number;
  zIndex?: number;
}

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  center: { x: number; y: number };
}

/**
 * Element types detected by vision model
 */
export type ElementType =
  | 'button'
  | 'text'
  | 'image'
  | 'input'
  | 'textarea'
  | 'select'
  | 'link'
  | 'container'
  | 'navigation'
  | 'header'
  | 'footer'
  | 'sidebar'
  | 'card'
  | 'list'
  | 'table'
  | 'video'
  | 'icon'
  | 'logo'
  | 'menu'
  | 'form'
  | 'checkbox'
  | 'radio'
  | 'unknown';

/**
 * Visual features extracted from element
 */
export interface VisualFeatures {
  colors: ColorPalette;
  typography?: Typography;
  spacing: Spacing;
  borders?: BorderInfo;
  shadows?: ShadowInfo[];
  texture?: TextureInfo;
  opacity: number;
}

/**
 * Color information
 */
export interface ColorPalette {
  primary: Color;
  secondary?: Color;
  background: Color;
  foreground?: Color;
  accent?: Color[];
  gradient?: GradientInfo;
}

/**
 * Color representation
 */
export interface Color {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  alpha: number;
}

/**
 * Gradient information
 */
export interface GradientInfo {
  type: 'linear' | 'radial' | 'conic';
  colors: Color[];
  angle?: number;
  stops?: number[];
}

/**
 * Typography information
 */
export interface Typography {
  fontSize: number;
  fontWeight: number;
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textDecoration?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

/**
 * Spacing information
 */
export interface Spacing {
  margin: BoxModel;
  padding: BoxModel;
  gap?: number;
}

/**
 * Box model measurements
 */
export interface BoxModel {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Border information
 */
export interface BorderInfo {
  width: BoxModel;
  style: string;
  color: Color;
  radius?: BoxModel;
}

/**
 * Shadow information
 */
export interface ShadowInfo {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: Color;
  inset?: boolean;
}

/**
 * Texture analysis
 */
export interface TextureInfo {
  type: 'solid' | 'pattern' | 'noise' | 'gradient';
  complexity: number;
  dominantPattern?: string;
}

/**
 * Molecular structure representing element hierarchy
 */
export interface MolecularStructure {
  root: DetectedElement;
  elements: Map<string, DetectedElement>;
  hierarchy: ElementHierarchy;
  relationships: ElementRelationship[];
  layoutGrid?: LayoutGrid;
  behavioralHints: BehavioralHint[];
}

/**
 * Element hierarchy representation
 */
export interface ElementHierarchy {
  levels: Map<number, DetectedElement[]>;
  maxDepth: number;
  parentChildMap: Map<string, string[]>;
  siblingGroups: SiblingGroup[];
}

/**
 * Sibling group information
 */
export interface SiblingGroup {
  parentId: string;
  elements: DetectedElement[];
  layout: 'horizontal' | 'vertical' | 'grid' | 'mixed';
  spacing: number;
  alignment: string;
}

/**
 * Element relationships
 */
export interface ElementRelationship {
  type: RelationshipType;
  source: string;
  target: string;
  confidence: number;
  metadata?: any;
}

/**
 * Types of element relationships
 */
export type RelationshipType = 
  | 'contains'
  | 'siblings'
  | 'aligned'
  | 'grouped'
  | 'linked'
  | 'overlaps'
  | 'near';

/**
 * Layout grid detection
 */
export interface LayoutGrid {
  columns: number;
  rows: number;
  gutterWidth: number;
  gutterHeight: number;
  cells: GridCell[];
}

/**
 * Grid cell information
 */
export interface GridCell {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  elementId?: string;
}

/**
 * Behavioral hints from visual analysis
 */
export interface BehavioralHint {
  elementId: string;
  type: BehaviorType;
  confidence: number;
  evidence: string[];
}

/**
 * Types of behaviors that can be inferred
 */
export type BehaviorType = 
  | 'clickable'
  | 'hoverable'
  | 'draggable'
  | 'editable'
  | 'scrollable'
  | 'expandable'
  | 'selectable'
  | 'focusable';

/**
 * Configuration for molecular decomposition
 */
export interface MolecularDecompositionConfig {
  modelPath?: string;
  confidenceThreshold?: number;
  maxElements?: number;
  enableOCR?: boolean;
  enableDepthAnalysis?: boolean;
  enableBehaviorInference?: boolean;
  gpuAcceleration?: boolean;
}

/**
 * Vision model interface
 */
export interface VisionModel {
  loadModel(modelPath: string): Promise<void>;
  detectElements(image: Buffer | Tensor3D): Promise<BoundingBox[]>;
  classifyElement(crop: Buffer | Tensor3D): Promise<{ type: ElementType; confidence: number }>;
  extractText(crop: Buffer | Tensor3D): Promise<string>;
  extractFeatures(crop: Buffer | Tensor3D): Promise<VisualFeatures>;
}

/**
 * Property extraction result
 */
export interface PropertyExtractionResult {
  colors: ColorPalette;
  typography?: Typography;
  spacing: Spacing;
  layout: LayoutInfo;
  style: StyleInfo;
}

/**
 * Layout information
 */
export interface LayoutInfo {
  display: string;
  position: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gridTemplate?: string;
}

/**
 * Style information
 */
export interface StyleInfo {
  borderRadius?: number;
  boxShadow?: ShadowInfo[];
  transform?: string;
  filter?: string;
  backdropFilter?: string;
}

/**
 * Training data format
 */
export interface TrainingData {
  image: Buffer;
  annotations: Annotation[];
  metadata?: any;
}

/**
 * Annotation for training
 */
export interface Annotation {
  boundingBox: BoundingBox;
  type: ElementType;
  attributes?: Record<string, any>;
}

/**
 * Model performance metrics
 */
export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  perClassMetrics: Map<ElementType, ClassMetrics>;
}

/**
 * Per-class performance metrics
 */
export interface ClassMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  support: number;
}

/**
 * Decomposition result
 */
export interface DecompositionResult {
  structure: MolecularStructure;
  elements: DetectedElement[];
  properties: Map<string, PropertyExtractionResult>;
  confidence: number;
  processingTime: number;
  warnings?: string[];
}

/**
 * Export format options
 */
export interface ExportOptions {
  format: 'json' | 'uwr' | 'html' | 'svg';
  includeVisualFeatures?: boolean;
  includeHierarchy?: boolean;
  includeBehavioralHints?: boolean;
  prettyPrint?: boolean;
}