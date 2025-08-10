/**
 * Type definitions for Interaction Discovery System
 */

import { Page, ElementHandle } from 'puppeteer';

export interface DiscoveryConfig {
  maxDepth?: number;                    // Maximum exploration depth
  maxStates?: number;                   // Maximum states to discover
  timeoutPerInteraction?: number;       // Timeout for each interaction
  parallelExplorers?: number;           // Number of parallel explorers
  strategy?: ExplorationStrategyType;   // Exploration strategy
  enableVisualDiff?: boolean;           // Use visual comparison for state detection
  captureScreenshots?: boolean;         // Capture screenshots of each state
  detectHiddenElements?: boolean;       // Try to find hidden elements
  simulateUserBehavior?: boolean;       // Add realistic delays and movements
}

export type ExplorationStrategyType =
  | 'breadth-first'
  | 'depth-first'
  | 'priority-based'
  | 'random-walk'
  | 'guided'
  | 'hybrid';

export interface InteractableElement {
  id: string;
  selector: string;
  type: ElementType;
  bounds: ElementBounds;
  attributes: Record<string, string>;
  computedStyles: Partial<CSSStyleDeclaration>;
  isVisible: boolean;
  isEnabled: boolean;
  confidence: number;                   // 0-1 confidence that element is interactive
  visualSignature?: string;             // Visual hash of the element
}

export type ElementType = 
  | 'button'
  | 'link'
  | 'input'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'textarea'
  | 'canvas'
  | 'video'
  | 'slider'
  | 'toggle'
  | 'dropdown'
  | 'menu-item'
  | 'tab'
  | 'accordion'
  | 'modal-trigger'
  | 'custom';

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface WebsiteState {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  visualHash: string;                   // Hash of visual appearance
  structuralHash: string;               // Hash of DOM structure
  interactableElements: InteractableElement[];
  screenshot?: Buffer;
  viewport: ViewportInfo;
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  consoleMessages: ConsoleMessage[];
  networkRequests: NetworkRequest[];
}

export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  documentHeight: number;
  documentWidth: number;
}

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info';
  text: string;
  timestamp: number;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status?: number;
  timestamp: number;
  responseTime?: number;
}

export interface Interaction {
  id: string;
  type: InteractionType;
  elementId: string;
  elementSelector: string;
  timestamp: number;
  duration: number;
  successful: boolean;
  resultingStateId?: string;
  error?: string;
  metadata?: InteractionMetadata;
}

export type InteractionType = 
  | 'click'
  | 'double-click'
  | 'right-click'
  | 'hover'
  | 'focus'
  | 'blur'
  | 'type'
  | 'select'
  | 'scroll'
  | 'drag'
  | 'key-press'
  | 'wait'
  | 'navigation';

export interface InteractionMetadata {
  text?: string;                        // Text typed or selected
  key?: string;                         // Key pressed
  scrollPosition?: { x: number; y: number };
  dragPath?: Array<{ x: number; y: number }>;
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
}

export interface StateTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  interaction: Interaction;
  probability: number;                  // Likelihood of this transition
  isReversible: boolean;
  conditions?: TransitionCondition[];
}

export interface TransitionCondition {
  type: 'timing' | 'state' | 'network' | 'custom';
  description: string;
  value: any;
}

export interface StateGraph {
  nodes: Map<string, StateNode>;
  edges: Map<string, StateTransition>;
  initialStateId: string;
  currentStateId: string;
  statistics: GraphStatistics;
}

export interface StateNode {
  state: WebsiteState;
  incomingEdges: string[];              // Transition IDs
  outgoingEdges: string[];              // Transition IDs
  visitCount: number;
  firstVisitTime: number;
  lastVisitTime: number;
  isTerminal: boolean;
  isError: boolean;
}

export interface GraphStatistics {
  totalStates: number;
  totalTransitions: number;
  maxDepth: number;
  averageBranchingFactor: number;
  cycleCount: number;
  unreachableStates: number;
  terminalStates: number;
  errorStates: number;
}

export interface ExplorationSession {
  id: string;
  startTime: number;
  endTime?: number;
  config: DiscoveryConfig;
  graph: StateGraph;
  status: ExplorationStatus;
  metrics: ExplorationMetrics;
}

export type ExplorationStatus = 
  | 'initializing'
  | 'exploring'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'timeout';

export interface ExplorationMetrics {
  statesDiscovered: number;
  transitionsFound: number;
  interactionsPerformed: number;
  failedInteractions: number;
  explorationTime: number;
  averageStateDiscoveryTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface ElementDetector {
  detectInteractableElements(page: Page): Promise<InteractableElement[]>;
}

export interface StateComparator {
  compare(state1: WebsiteState, state2: WebsiteState): StateComparison;
}

export interface StateComparison {
  visualSimilarity: number;             // 0-1
  structuralSimilarity: number;         // 0-1
  isIdentical: boolean;
  differences: StateDifference[];
}

export interface StateDifference {
  type: 'visual' | 'structural' | 'content' | 'interaction';
  description: string;
  severity: 'minor' | 'major' | 'critical';
  location?: ElementBounds;
}

export interface InteractionExecutor {
  execute(
    page: Page,
    element: InteractableElement,
    type: InteractionType,
    metadata?: InteractionMetadata
  ): Promise<Interaction>;
}

export interface ExplorationStrategy {
  selectNextInteraction(
    currentState: WebsiteState,
    graph: StateGraph,
    availableInteractions: InteractableElement[]
  ): InteractableElement | null;
}

export interface StateHasher {
  computeVisualHash(screenshot: Buffer): string;
  computeStructuralHash(page: Page): Promise<string>;
}

export interface ExplorationEventMap {
  'stateDiscovered': { state: WebsiteState; isNew: boolean };
  'transitionFound': { transition: StateTransition };
  'interactionCompleted': { interaction: Interaction };
  'interactionFailed': { interaction: Interaction; error: Error };
  'explorationProgress': { 
    statesDiscovered: number; 
    currentDepth: number; 
    queueSize: number 
  };
  'explorationCompleted': { metrics: ExplorationMetrics };
  'error': { error: Error; context: string };
}

export interface PriorityQueue<T> {
  enqueue(item: T, priority: number): void;
  dequeue(): T | undefined;
  peek(): T | undefined;
  size(): number;
  isEmpty(): boolean;
}

export interface VisualDiffResult {
  similarity: number;
  diffImage?: Buffer;
  changedRegions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    changeType: 'added' | 'removed' | 'modified';
  }>;
}

export interface InteractionPattern {
  name: string;
  description: string;
  steps: InteractionStep[];
  applicableElements: (element: InteractableElement) => boolean;
}

export interface InteractionStep {
  type: InteractionType;
  metadata?: InteractionMetadata;
  waitAfter?: number;
  validateResult?: (beforeState: WebsiteState, afterState: WebsiteState) => boolean;
}

// Additional types for CLI and full system integration

export interface InteractionDiscoveryConfig extends DiscoveryConfig {
  url: string;
  maxDuration?: number;
  browserOptions?: {
    headless?: boolean;
    viewport?: { width: number; height: number };
  };
  captureOptions?: {
    screenshots?: boolean;
    videos?: boolean;
  };
}

export interface DiscoveryResult {
  url: string;
  timestamp: number;
  states: DiscoveredState[];
  interactions: DiscoveredInteraction[];
  transitions: DiscoveredTransition[];
  stateGraph?: SerializedStateGraph;
  coverage: number; // 0-1 estimated coverage
  metrics?: ExplorationMetrics;
}

export interface DiscoveredState {
  id: string;
  url: string;
  title?: string;
  screenshot?: string; // Base64 encoded
  possibleInteractions?: InteractableElement[];
  metadata?: Record<string, any>;
}

export interface DiscoveredInteraction {
  id: string;
  type: InteractionType;
  selector: string;
  fromState: string;
  toState?: string;
  successful: boolean;
}

export interface DiscoveredTransition {
  id: string;
  fromState: string;
  toState: string;
  interaction: string;
  count: number;
}

export interface SerializedStateGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label?: string;
  data?: Record<string, any>;
}

export interface GraphEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  data?: Record<string, any>;
}