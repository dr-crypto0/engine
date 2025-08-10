/**
 * State Manager
 * Manages discovered states and transitions in the exploration graph
 */

import { 
  WebsiteState, 
  StateGraph, 
  StateNode, 
  StateTransition,
  GraphStatistics 
} from '../types';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';

export class StateManager {
  private states: Map<string, WebsiteState>;
  private nodes: Map<string, StateNode>;
  private transitions: Map<string, StateTransition>;
  private stateHashIndex: Map<string, string>; // hash -> stateId
  
  constructor() {
    this.states = new Map();
    this.nodes = new Map();
    this.transitions = new Map();
    this.stateHashIndex = new Map();
  }

  /**
   * Add a new state to the graph
   */
  addState(state: WebsiteState): void {
    // Check if state already exists
    if (this.states.has(state.id)) {
      logger.warn('State already exists', { stateId: state.id });
      return;
    }

    // Add state
    this.states.set(state.id, state);
    
    // Create node
    const node: StateNode = {
      state,
      incomingEdges: [],
      outgoingEdges: [],
      visitCount: 1,
      firstVisitTime: Date.now(),
      lastVisitTime: Date.now(),
      isTerminal: false,
      isError: false
    };
    
    this.nodes.set(state.id, node);
    
    // Index by hash
    const combinedHash = this.computeCombinedHash(state);
    this.stateHashIndex.set(combinedHash, state.id);
    
    logger.debug('State added', { 
      stateId: state.id, 
      url: state.url,
      hash: combinedHash 
    });
  }

  /**
   * Add a transition between states
   */
  addTransition(transition: StateTransition): void {
    // Validate states exist
    if (!this.states.has(transition.fromStateId) || 
        !this.states.has(transition.toStateId)) {
      logger.error('Invalid transition: states do not exist', {
        from: transition.fromStateId,
        to: transition.toStateId
      });
      return;
    }

    // Add transition
    this.transitions.set(transition.id, transition);
    
    // Update nodes
    const fromNode = this.nodes.get(transition.fromStateId);
    const toNode = this.nodes.get(transition.toStateId);
    
    if (fromNode && toNode) {
      fromNode.outgoingEdges.push(transition.id);
      toNode.incomingEdges.push(transition.id);
    }
    
    logger.debug('Transition added', {
      transitionId: transition.id,
      from: transition.fromStateId,
      to: transition.toStateId
    });
  }

  /**
   * Get a state by ID
   */
  getState(stateId: string): WebsiteState | undefined {
    return this.states.get(stateId);
  }

  /**
   * Get a node by state ID
   */
  getNode(stateId: string): StateNode | undefined {
    return this.nodes.get(stateId);
  }

  /**
   * Find a similar state based on hashes
   */
  findSimilarState(state: WebsiteState): WebsiteState | undefined {
    const combinedHash = this.computeCombinedHash(state);
    const existingStateId = this.stateHashIndex.get(combinedHash);
    
    if (existingStateId) {
      return this.states.get(existingStateId);
    }
    
    // If exact match not found, try visual hash only
    for (const [hash, stateId] of this.stateHashIndex.entries()) {
      const existingState = this.states.get(stateId);
      if (existingState && existingState.visualHash === state.visualHash) {
        return existingState;
      }
    }
    
    return undefined;
  }

  /**
   * Get all states
   */
  getAllStates(): WebsiteState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get all transitions
   */
  getAllTransitions(): StateTransition[] {
    return Array.from(this.transitions.values());
  }

  /**
   * Get state count
   */
  getStateCount(): number {
    return this.states.size;
  }

  /**
   * Get transition count
   */
  getTransitionCount(): number {
    return this.transitions.size;
  }

  /**
   * Build and return the complete state graph
   */
  getGraph(): StateGraph {
    const statistics = this.calculateStatistics();
    
    return {
      nodes: this.nodes,
      edges: this.transitions,
      initialStateId: this.findInitialState(),
      currentStateId: '', // Set by engine
      statistics
    };
  }

  /**
   * Calculate graph statistics
   */
  private calculateStatistics(): GraphStatistics {
    const totalStates = this.states.size;
    const totalTransitions = this.transitions.size;
    
    // Calculate max depth
    const maxDepth = this.calculateMaxDepth();
    
    // Calculate average branching factor
    let totalBranches = 0;
    let nodesWithOutgoing = 0;
    
    for (const node of this.nodes.values()) {
      if (node.outgoingEdges.length > 0) {
        totalBranches += node.outgoingEdges.length;
        nodesWithOutgoing++;
      }
    }
    
    const averageBranchingFactor = nodesWithOutgoing > 0 ? 
      totalBranches / nodesWithOutgoing : 0;
    
    // Count cycles
    const cycleCount = this.countCycles();
    
    // Count terminal and error states
    let terminalStates = 0;
    let errorStates = 0;
    let unreachableStates = 0;
    
    for (const node of this.nodes.values()) {
      if (node.outgoingEdges.length === 0) {
        terminalStates++;
      }
      if (node.isError) {
        errorStates++;
      }
      if (node.incomingEdges.length === 0 && 
          node.state.id !== this.findInitialState()) {
        unreachableStates++;
      }
    }
    
    return {
      totalStates,
      totalTransitions,
      maxDepth,
      averageBranchingFactor,
      cycleCount,
      unreachableStates,
      terminalStates,
      errorStates
    };
  }

  /**
   * Calculate maximum depth in the graph
   */
  private calculateMaxDepth(): number {
    const initialState = this.findInitialState();
    if (!initialState) return 0;
    
    const visited = new Set<string>();
    let maxDepth = 0;
    
    const dfs = (stateId: string, depth: number) => {
      if (visited.has(stateId)) return;
      visited.add(stateId);
      
      maxDepth = Math.max(maxDepth, depth);
      
      const node = this.nodes.get(stateId);
      if (node) {
        for (const edgeId of node.outgoingEdges) {
          const edge = this.transitions.get(edgeId);
          if (edge) {
            dfs(edge.toStateId, depth + 1);
          }
        }
      }
    };
    
    dfs(initialState, 0);
    return maxDepth;
  }

  /**
   * Count cycles in the graph
   */
  private countCycles(): number {
    // Simple cycle detection using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    let cycleCount = 0;
    
    const hasCycle = (stateId: string): boolean => {
      visited.add(stateId);
      recursionStack.add(stateId);
      
      const node = this.nodes.get(stateId);
      if (node) {
        for (const edgeId of node.outgoingEdges) {
          const edge = this.transitions.get(edgeId);
          if (edge) {
            if (!visited.has(edge.toStateId)) {
              if (hasCycle(edge.toStateId)) {
                return true;
              }
            } else if (recursionStack.has(edge.toStateId)) {
              cycleCount++;
              return true;
            }
          }
        }
      }
      
      recursionStack.delete(stateId);
      return false;
    };
    
    for (const stateId of this.states.keys()) {
      if (!visited.has(stateId)) {
        hasCycle(stateId);
      }
    }
    
    return cycleCount;
  }

  /**
   * Find the initial state (first added or with no incoming edges)
   */
  private findInitialState(): string {
    // First, try to find state with no incoming edges
    for (const [stateId, node] of this.nodes.entries()) {
      if (node.incomingEdges.length === 0) {
        return stateId;
      }
    }
    
    // Otherwise, return first state
    const firstState = this.states.keys().next().value;
    return firstState || '';
  }

  /**
   * Compute combined hash for state comparison
   */
  private computeCombinedHash(state: WebsiteState): string {
    const data = `${state.visualHash}:${state.structuralHash}:${state.url}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Mark a state as terminal
   */
  markAsTerminal(stateId: string): void {
    const node = this.nodes.get(stateId);
    if (node) {
      node.isTerminal = true;
    }
  }

  /**
   * Mark a state as error
   */
  markAsError(stateId: string): void {
    const node = this.nodes.get(stateId);
    if (node) {
      node.isError = true;
    }
  }

  /**
   * Update visit count for a state
   */
  updateVisitCount(stateId: string): void {
    const node = this.nodes.get(stateId);
    if (node) {
      node.visitCount++;
      node.lastVisitTime = Date.now();
    }
  }

  /**
   * Get shortest path between two states
   */
  getShortestPath(fromStateId: string, toStateId: string): string[] | null {
    if (!this.states.has(fromStateId) || !this.states.has(toStateId)) {
      return null;
    }
    
    // BFS to find shortest path
    const queue: Array<{ stateId: string; path: string[] }> = [
      { stateId: fromStateId, path: [fromStateId] }
    ];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const { stateId, path } = queue.shift()!;
      
      if (stateId === toStateId) {
        return path;
      }
      
      if (visited.has(stateId)) {
        continue;
      }
      visited.add(stateId);
      
      const node = this.nodes.get(stateId);
      if (node) {
        for (const edgeId of node.outgoingEdges) {
          const edge = this.transitions.get(edgeId);
          if (edge && !visited.has(edge.toStateId)) {
            queue.push({
              stateId: edge.toStateId,
              path: [...path, edge.toStateId]
            });
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Export graph to DOT format for visualization
   */
  exportToDOT(): string {
    let dot = 'digraph StateGraph {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box];\n\n';
    
    // Add nodes
    for (const [stateId, state] of this.states.entries()) {
      const node = this.nodes.get(stateId);
      const label = `${state.title || 'Untitled'}\\n${state.url}\\nVisits: ${node?.visitCount || 0}`;
      const color = node?.isError ? 'red' : (node?.isTerminal ? 'green' : 'black');
      dot += `  "${stateId}" [label="${label}", color="${color}"];\n`;
    }
    
    dot += '\n';
    
    // Add edges
    for (const transition of this.transitions.values()) {
      const label = `${transition.interaction.type}\\n${transition.interaction.elementSelector}`;
      dot += `  "${transition.fromStateId}" -> "${transition.toStateId}" [label="${label}"];\n`;
    }
    
    dot += '}\n';
    return dot;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.states.clear();
    this.nodes.clear();
    this.transitions.clear();
    this.stateHashIndex.clear();
  }
}