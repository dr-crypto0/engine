/**
 * Exploration Strategist
 * Implements different strategies for exploring website states
 */

import { 
  WebsiteState, 
  StateGraph, 
  InteractableElement,
  ExplorationStrategyType 
} from '../types';
import { logger } from '../utils/logger';

export class ExplorationStrategist {
  private strategy: ExplorationStrategyType;
  private exploredElements: Set<string>;
  private priorityScores: Map<string, number>;

  constructor(strategy: ExplorationStrategyType) {
    this.strategy = strategy;
    this.exploredElements = new Set();
    this.priorityScores = new Map();
  }

  /**
   * Select next state to explore from queue based on strategy
   */
  selectNext(queue: Array<{ state: WebsiteState; depth: number }>): { state: WebsiteState; depth: number } {
    if (queue.length === 0) {
      throw new Error('Queue is empty');
    }

    switch (this.strategy) {
      case 'breadth-first':
        return this.breadthFirstSelection(queue);
      
      case 'depth-first':
        return this.depthFirstSelection(queue);
      
      case 'priority-based':
        return this.priorityBasedSelection(queue);
      
      case 'random-walk':
        return this.randomWalkSelection(queue);
      
      case 'guided':
        return this.guidedSelection(queue);
      
      case 'hybrid':
        return this.hybridSelection(queue);
      
      default:
        return queue.shift()!; // Default to FIFO
    }
  }

  /**
   * Select next interaction from available elements
   */
  selectNextInteraction(
    currentState: WebsiteState,
    graph: StateGraph,
    availableElements: InteractableElement[]
  ): InteractableElement | null {
    if (availableElements.length === 0) {
      return null;
    }

    // Filter out already explored elements in this state
    const stateElementKey = (element: InteractableElement) => 
      `${currentState.id}:${element.selector}`;
    
    const unexploredElements = availableElements.filter(
      element => !this.exploredElements.has(stateElementKey(element))
    );

    if (unexploredElements.length === 0) {
      // All elements explored in this state
      return null;
    }

    // Select based on strategy
    let selected: InteractableElement;
    
    switch (this.strategy) {
      case 'priority-based':
        selected = this.selectByPriority(unexploredElements);
        break;
      
      case 'random-walk':
        selected = this.selectRandom(unexploredElements);
        break;
      
      case 'guided':
        selected = this.selectGuided(unexploredElements, currentState);
        break;
      
      default:
        // Default: select first unexplored element
        selected = unexploredElements[0];
    }

    // Mark as explored
    this.exploredElements.add(stateElementKey(selected));
    
    return selected;
  }

  /**
   * Breadth-first selection (FIFO)
   */
  private breadthFirstSelection(
    queue: Array<{ state: WebsiteState; depth: number }>
  ): { state: WebsiteState; depth: number } {
    return queue.shift()!;
  }

  /**
   * Depth-first selection (LIFO)
   */
  private depthFirstSelection(
    queue: Array<{ state: WebsiteState; depth: number }>
  ): { state: WebsiteState; depth: number } {
    return queue.pop()!;
  }

  /**
   * Priority-based selection
   */
  private priorityBasedSelection(
    queue: Array<{ state: WebsiteState; depth: number }>
  ): { state: WebsiteState; depth: number } {
    // Calculate priority scores if not already done
    queue.forEach(item => {
      if (!this.priorityScores.has(item.state.id)) {
        const score = this.calculateStatePriority(item.state, item.depth);
        this.priorityScores.set(item.state.id, score);
      }
    });

    // Sort by priority (highest first)
    queue.sort((a, b) => {
      const scoreA = this.priorityScores.get(a.state.id) || 0;
      const scoreB = this.priorityScores.get(b.state.id) || 0;
      return scoreB - scoreA;
    });

    return queue.shift()!;
  }

  /**
   * Random walk selection
   */
  private randomWalkSelection(
    queue: Array<{ state: WebsiteState; depth: number }>
  ): { state: WebsiteState; depth: number } {
    const index = Math.floor(Math.random() * queue.length);
    return queue.splice(index, 1)[0];
  }

  /**
   * Guided selection (heuristic-based)
   */
  private guidedSelection(
    queue: Array<{ state: WebsiteState; depth: number }>
  ): { state: WebsiteState; depth: number } {
    // Prefer states with more unexplored elements
    queue.sort((a, b) => {
      const unexploredA = this.countUnexploredElements(a.state);
      const unexploredB = this.countUnexploredElements(b.state);
      return unexploredB - unexploredA;
    });

    return queue.shift()!;
  }

  /**
   * Hybrid selection (combines strategies)
   */
  private hybridSelection(
    queue: Array<{ state: WebsiteState; depth: number }>
  ): { state: WebsiteState; depth: number } {
    // Use different strategies based on exploration progress
    const totalExplored = this.exploredElements.size;
    
    if (totalExplored < 10) {
      // Early exploration: breadth-first
      return this.breadthFirstSelection(queue);
    } else if (totalExplored < 50) {
      // Mid exploration: priority-based
      return this.priorityBasedSelection(queue);
    } else {
      // Late exploration: random walk to find edge cases
      return this.randomWalkSelection(queue);
    }
  }

  /**
   * Calculate priority score for a state
   */
  private calculateStatePriority(state: WebsiteState, depth: number): number {
    let score = 0;

    // Prefer states with more interactive elements
    score += state.interactableElements.length * 10;

    // Prefer shallower states (to explore breadth)
    score += (10 - depth) * 5;

    // Prefer states with forms
    const hasForm = state.interactableElements.some(
      el => el.type === 'input' || el.type === 'textarea' || el.type === 'select'
    );
    if (hasForm) score += 20;

    // Prefer states with navigation elements
    const hasNav = state.interactableElements.some(
      el => el.type === 'link' || el.attributes.role === 'navigation'
    );
    if (hasNav) score += 15;

    // Penalize error states
    if (state.url.includes('error') || state.title.toLowerCase().includes('error')) {
      score -= 30;
    }

    return score;
  }

  /**
   * Select element by priority
   */
  private selectByPriority(elements: InteractableElement[]): InteractableElement {
    // Calculate priority for each element
    const elementScores = elements.map(element => ({
      element,
      score: this.calculateElementPriority(element)
    }));

    // Sort by score (highest first)
    elementScores.sort((a, b) => b.score - a.score);

    return elementScores[0].element;
  }

  /**
   * Calculate priority score for an element
   */
  private calculateElementPriority(element: InteractableElement): number {
    let score = element.confidence * 100;

    // Priority by element type
    const typePriority: Record<string, number> = {
      'button': 50,
      'link': 40,
      'input': 35,
      'select': 30,
      'checkbox': 25,
      'radio': 20,
      'textarea': 15,
      'custom': 10
    };

    score += typePriority[element.type] || 0;

    // Prefer visible elements
    if (element.isVisible) score += 20;

    // Prefer enabled elements
    if (element.isEnabled) score += 10;

    // Prefer elements with meaningful text
    const text = element.attributes.text || element.attributes.ariaLabel || '';
    if (text.length > 0 && text.length < 50) {
      score += 15;
    }

    // Prefer elements with specific keywords
    const importantKeywords = ['submit', 'next', 'continue', 'login', 'search', 'add', 'create'];
    const elementText = text.toLowerCase();
    if (importantKeywords.some(keyword => elementText.includes(keyword))) {
      score += 25;
    }

    // Deprioritize logout/exit actions
    const avoidKeywords = ['logout', 'exit', 'cancel', 'close'];
    if (avoidKeywords.some(keyword => elementText.includes(keyword))) {
      score -= 20;
    }

    return score;
  }

  /**
   * Select random element
   */
  private selectRandom(elements: InteractableElement[]): InteractableElement {
    const index = Math.floor(Math.random() * elements.length);
    return elements[index];
  }

  /**
   * Select element using guided heuristics
   */
  private selectGuided(
    elements: InteractableElement[], 
    currentState: WebsiteState
  ): InteractableElement {
    // Guide based on current state context
    
    // If on a form, prioritize form elements
    const formElements = elements.filter(
      el => ['input', 'select', 'textarea', 'checkbox', 'radio'].includes(el.type)
    );
    if (formElements.length > 0) {
      return this.selectByPriority(formElements);
    }

    // If on navigation, prioritize links
    const navElements = elements.filter(el => el.type === 'link');
    if (navElements.length > 0 && currentState.url.includes('/')) {
      return this.selectByPriority(navElements);
    }

    // Default to priority selection
    return this.selectByPriority(elements);
  }

  /**
   * Count unexplored elements in a state
   */
  private countUnexploredElements(state: WebsiteState): number {
    return state.interactableElements.filter(element => {
      const key = `${state.id}:${element.selector}`;
      return !this.exploredElements.has(key);
    }).length;
  }

  /**
   * Reset exploration tracking
   */
  reset(): void {
    this.exploredElements.clear();
    this.priorityScores.clear();
  }

  /**
   * Get exploration statistics
   */
  getStats(): {
    strategy: string;
    exploredElements: number;
    prioritizedStates: number;
  } {
    return {
      strategy: this.strategy,
      exploredElements: this.exploredElements.size,
      prioritizedStates: this.priorityScores.size
    };
  }

  /**
   * Update strategy dynamically
   */
  updateStrategy(newStrategy: ExplorationStrategyType): void {
    this.strategy = newStrategy;
    logger.info(`Exploration strategy updated to: ${newStrategy}`);
  }
}