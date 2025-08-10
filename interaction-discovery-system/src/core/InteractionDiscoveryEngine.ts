/**
 * Interaction Discovery Engine
 * Automatically discovers all possible interactions and states on a website
 */

import { Browser, Page } from 'puppeteer';
import { EventEmitter } from 'events';
import {
  DiscoveryConfig,
  InteractionDiscoveryConfig,
  DiscoveryResult,
  DiscoveredState,
  DiscoveredInteraction,
  DiscoveredTransition,
  SerializedStateGraph,
  WebsiteState,
  InteractableElement,
  StateGraph,
  StateNode,
  StateTransition,
  Interaction,
  ExplorationSession,
  ExplorationStatus,
  ExplorationMetrics
} from '../types';
import { ElementDetector } from './ElementDetector';
import { StateManager } from './StateManager';
import { InteractionExecutor } from './InteractionExecutor';
import { ExplorationStrategist } from './ExplorationStrategist';
import { StateComparator } from './StateComparator';
import { logger } from '../utils/logger';

export class InteractionDiscoveryEngine extends EventEmitter {
  private browser: Browser | null = null;
  private pages: Map<string, Page> = new Map();
  private config: DiscoveryConfig;
  private elementDetector: ElementDetector;
  private stateManager: StateManager;
  private interactionExecutor: InteractionExecutor;
  private strategist: ExplorationStrategist;
  private stateComparator: StateComparator;
  private session: ExplorationSession | null = null;
  private isExploring: boolean = false;
  private explorationQueue: Array<{ stateId: string; element: InteractableElement }> = [];

  constructor(config: DiscoveryConfig | InteractionDiscoveryConfig = {}) {
    super();
    
    // Handle both config types
    this.config = {
      maxDepth: 10,
      maxStates: 1000,
      timeoutPerInteraction: 5000,
      parallelExplorers: 1,
      strategy: 'breadth-first',
      enableVisualDiff: true,
      captureScreenshots: true,
      detectHiddenElements: false,
      simulateUserBehavior: true,
      ...config
    };

    this.elementDetector = new ElementDetector(this.config);
    this.stateManager = new StateManager();
    this.interactionExecutor = new InteractionExecutor(this.config);
    this.strategist = new ExplorationStrategist(this.config.strategy || 'breadth-first');
    this.stateComparator = new StateComparator(this.config.enableVisualDiff || true);
  }

  /**
   * Initialize the discovery engine
   */
  async initialize(browser: Browser): Promise<void> {
    this.browser = browser;
    logger.info('Interaction Discovery Engine initialized', {
      config: this.config
    });
  }

  /**
   * Start discovering interactions on a website
   */
  async startDiscovery(url: string): Promise<ExplorationSession> {
    if (this.isExploring) {
      throw new Error('Discovery already in progress');
    }

    try {
      this.isExploring = true;
      
      // Create new session
      this.session = this.createSession();
      
      logger.info('Starting interaction discovery', { url });
      
      // Create initial page
      const page = await this.createPage();
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      // Capture initial state
      const initialState = await this.captureState(page, url);
      this.stateManager.addState(initialState);
      this.session.graph.initialStateId = initialState.id;
      this.session.graph.currentStateId = initialState.id;
      
      // Start exploration
      await this.explore(page, initialState);
      
      // Mark session as completed
      this.session.status = 'completed';
      this.session.endTime = Date.now();
      
      this.emit('explorationCompleted', { 
        metrics: this.calculateMetrics() 
      });
      
      return this.session;
      
    } catch (error) {
      logger.error('Discovery failed', error);
      if (this.session) {
        this.session.status = 'failed';
      }
      throw error;
    } finally {
      this.isExploring = false;
    }
  }

  /**
   * Create a new exploration session
   */
  private createSession(): ExplorationSession {
    return {
      id: `session_${Date.now()}`,
      startTime: Date.now(),
      config: this.config,
      graph: {
        nodes: new Map(),
        edges: new Map(),
        initialStateId: '',
        currentStateId: '',
        statistics: {
          totalStates: 0,
          totalTransitions: 0,
          maxDepth: 0,
          averageBranchingFactor: 0,
          cycleCount: 0,
          unreachableStates: 0,
          terminalStates: 0,
          errorStates: 0
        }
      },
      status: 'exploring',
      metrics: {
        statesDiscovered: 0,
        transitionsFound: 0,
        interactionsPerformed: 0,
        failedInteractions: 0,
        explorationTime: 0,
        averageStateDiscoveryTime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }
    };
  }

  /**
   * Main exploration loop
   */
  private async explore(page: Page, currentState: WebsiteState): Promise<void> {
    const visited = new Set<string>();
    const queue: Array<{ state: WebsiteState; depth: number }> = [
      { state: currentState, depth: 0 }
    ];

    while (queue.length > 0 && this.isExploring) {
      // Check limits
      if (this.stateManager.getStateCount() >= (this.config.maxStates || 1000)) {
        logger.info('Maximum states reached');
        break;
      }

      // Get next state to explore based on strategy
      const { state, depth } = this.strategist.selectNext(queue);
      
      if (visited.has(state.id) || depth > (this.config.maxDepth || 10)) {
        continue;
      }
      
      visited.add(state.id);
      
      // Navigate to state if needed
      if (this.session!.graph.currentStateId !== state.id) {
        await this.navigateToState(page, state);
      }
      
      // Detect interactable elements
      const elements = await this.elementDetector.detect(page);
      state.interactableElements = elements;
      
      logger.info(`Found ${elements.length} interactable elements in state ${state.id}`);
      
      this.emit('explorationProgress', {
        statesDiscovered: this.stateManager.getStateCount(),
        currentDepth: depth,
        queueSize: queue.length
      });
      
      // Try each interaction
      for (const element of elements) {
        if (!this.isExploring) break;
        
        try {
          // Execute interaction
          const interaction = await this.interactionExecutor.execute(
            page, 
            element, 
            this.determineInteractionType(element)
          );
          
          // Wait for page to stabilize
          await this.waitForStable(page);
          
          // Capture new state
          const newState = await this.captureState(page, page.url());
          
          // Check if this is a new state
          const comparison = this.stateComparator.compare(state, newState);
          
          if (!comparison.isIdentical) {
            // New state discovered
            const existingState = this.stateManager.findSimilarState(newState);
            
            if (!existingState) {
              // Completely new state
              this.stateManager.addState(newState);
              queue.push({ state: newState, depth: depth + 1 });
              
              this.emit('stateDiscovered', { 
                state: newState, 
                isNew: true 
              });
            } else {
              // State already exists
              newState.id = existingState.id;
            }
            
            // Create transition
            const transition = this.createTransition(
              state.id, 
              newState.id, 
              interaction
            );
            
            this.stateManager.addTransition(transition);
            
            this.emit('transitionFound', { transition });
          }
          
          // Navigate back to original state
          await this.navigateToState(page, state);
          
          this.emit('interactionCompleted', { interaction });
          
        } catch (error) {
          logger.error('Interaction failed', { element, error });
          this.emit('interactionFailed', { 
            interaction: this.createFailedInteraction(element), 
            error: error as Error 
          });
        }
      }
    }
  }

  /**
   * Capture current page state
   */
  private async captureState(page: Page, url: string): Promise<WebsiteState> {
    const timestamp = Date.now();
    
    // Get viewport info
    const viewport = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth
    }));
    
    // Capture screenshot if enabled
    let screenshot: Buffer | undefined;
    if (this.config.captureScreenshots) {
      screenshot = await page.screenshot({ 
        fullPage: false,
        encoding: 'binary'
      }) as Buffer;
    }
    
    // Get page title
    const title = await page.title();
    
    // Compute hashes
    const visualHash = screenshot ? 
      await this.stateComparator.computeVisualHash(screenshot) : '';
    const structuralHash = await this.stateComparator.computeStructuralHash(page);
    
    // Get storage data
    const localStorage = await page.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          data[key] = window.localStorage.getItem(key) || '';
        }
      }
      return data;
    });
    
    const sessionStorage = await page.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key) {
          data[key] = window.sessionStorage.getItem(key) || '';
        }
      }
      return data;
    });
    
    // Create state object
    const state: WebsiteState = {
      id: `state_${timestamp}`,
      url,
      title,
      timestamp,
      visualHash,
      structuralHash,
      interactableElements: [],
      screenshot,
      viewport,
      cookies: await page.cookies(),
      localStorage,
      sessionStorage,
      consoleMessages: [],
      networkRequests: []
    };
    
    return state;
  }

  /**
   * Navigate to a specific state
   */
  private async navigateToState(page: Page, targetState: WebsiteState): Promise<void> {
    // For now, just navigate to URL
    // In a full implementation, this would replay interactions to reach the state
    if (page.url() !== targetState.url) {
      await page.goto(targetState.url, { waitUntil: 'networkidle0' });
    }
    
    // Restore cookies
    await page.setCookie(...targetState.cookies);
    
    // Restore storage
    await page.evaluate((localStorage, sessionStorage) => {
      // Clear existing storage
      window.localStorage.clear();
      window.sessionStorage.clear();
      
      // Set new values
      Object.entries(localStorage).forEach(([key, value]) => {
        window.localStorage.setItem(key, value);
      });
      
      Object.entries(sessionStorage).forEach(([key, value]) => {
        window.sessionStorage.setItem(key, value);
      });
    }, targetState.localStorage, targetState.sessionStorage);
    
    this.session!.graph.currentStateId = targetState.id;
  }

  /**
   * Wait for page to stabilize after interaction
   */
  private async waitForStable(page: Page): Promise<void> {
    try {
      // Wait for network idle
      await page.waitForLoadState('networkidle', { timeout: 3000 });
    } catch {
      // Continue even if timeout
    }
    
    // Additional wait if simulating user behavior
    if (this.config.simulateUserBehavior) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Determine interaction type based on element
   */
  private determineInteractionType(element: InteractableElement): 'click' | 'hover' | 'type' {
    if (element.type === 'input' || element.type === 'textarea') {
      return 'type';
    }
    
    // For now, default to click
    return 'click';
  }

  /**
   * Create a state transition
   */
  private createTransition(
    fromStateId: string, 
    toStateId: string, 
    interaction: Interaction
  ): StateTransition {
    return {
      id: `transition_${Date.now()}`,
      fromStateId,
      toStateId,
      interaction,
      probability: 1.0,
      isReversible: false
    };
  }

  /**
   * Create a failed interaction record
   */
  private createFailedInteraction(element: InteractableElement): Interaction {
    return {
      id: `interaction_${Date.now()}`,
      type: 'click',
      elementId: element.id,
      elementSelector: element.selector,
      timestamp: Date.now(),
      duration: 0,
      successful: false
    };
  }

  /**
   * Create a new page for exploration
   */
  private async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    const page = await this.browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    });
    
    // Enable console message collection
    page.on('console', msg => {
      if (this.session) {
        const currentState = this.stateManager.getState(
          this.session.graph.currentStateId
        );
        if (currentState) {
          currentState.consoleMessages.push({
            type: msg.type() as any,
            text: msg.text(),
            timestamp: Date.now()
          });
        }
      }
    });
    
    return page;
  }

  /**
   * Calculate exploration metrics
   */
  private calculateMetrics(): ExplorationMetrics {
    if (!this.session) {
      return {
        statesDiscovered: 0,
        transitionsFound: 0,
        interactionsPerformed: 0,
        failedInteractions: 0,
        explorationTime: 0,
        averageStateDiscoveryTime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      };
    }
    
    const explorationTime = (this.session.endTime || Date.now()) - this.session.startTime;
    const statesDiscovered = this.stateManager.getStateCount();
    
    return {
      statesDiscovered,
      transitionsFound: this.stateManager.getTransitionCount(),
      interactionsPerformed: this.session.metrics.interactionsPerformed,
      failedInteractions: this.session.metrics.failedInteractions,
      explorationTime,
      averageStateDiscoveryTime: explorationTime / statesDiscovered,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: 0 // Would need proper CPU monitoring
    };
  }

  /**
   * Stop exploration
   */
  async stopDiscovery(): Promise<void> {
    this.isExploring = false;
    logger.info('Stopping interaction discovery');
  }

  /**
   * Get current session
   */
  getSession(): ExplorationSession | null {
    return this.session;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.isExploring = false;
    
    // Close all pages
    for (const page of this.pages.values()) {
      await page.close();
    }
    this.pages.clear();
    
    // Clear data
    this.stateManager.clear();
    this.session = null;
    
    logger.info('Interaction Discovery Engine cleaned up');
  }

  /**
   * Discover interactions (wrapper for CLI compatibility)
   */
  async discover(): Promise<DiscoveryResult> {
    if (!('url' in this.config)) {
      throw new Error('URL must be provided in config for discover method');
    }
    
    const url = (this.config as InteractionDiscoveryConfig).url;
    const session = await this.startDiscovery(url);
    
    // Wait for exploration to complete
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.isExploring ||
            session.status === 'completed' ||
            session.status === 'failed' ||
            session.status === 'timeout') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });

    // Convert session to DiscoveryResult
    const states = Array.from(session.graph.nodes.values());
    const transitions = Array.from(session.graph.edges.values());
    
    const discoveredStates: DiscoveredState[] = states.map(node => ({
      id: node.state.id,
      url: node.state.url,
      title: node.state.title,
      screenshot: node.state.screenshot ?
        Buffer.from(node.state.screenshot).toString('base64') : undefined,
      possibleInteractions: node.state.interactableElements,
      metadata: {
        visitCount: node.visitCount,
        firstVisitTime: node.firstVisitTime,
        lastVisitTime: node.lastVisitTime,
        isTerminal: node.isTerminal,
        isError: node.isError
      }
    }));

    const discoveredInteractions: DiscoveredInteraction[] = [];
    const discoveredTransitions: DiscoveredTransition[] = [];
    const transitionCounts = new Map<string, number>();

    transitions.forEach(transition => {
      const key = `${transition.fromStateId}-${transition.toStateId}-${transition.interaction.type}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
      
      discoveredInteractions.push({
        id: transition.interaction.id,
        type: transition.interaction.type,
        selector: transition.interaction.elementSelector,
        fromState: transition.fromStateId,
        toState: transition.toStateId,
        successful: transition.interaction.successful
      });
    });

    transitionCounts.forEach((count, key) => {
      const [fromState, toState, interactionType] = key.split('-');
      discoveredTransitions.push({
        id: `transition-${discoveredTransitions.length}`,
        fromState,
        toState,
        interaction: interactionType,
        count
      });
    });

    // Create serialized state graph
    const stateGraph: SerializedStateGraph = {
      nodes: states.map(node => ({
        id: node.state.id,
        label: node.state.title || node.state.url,
        data: {
          url: node.state.url,
          interactionCount: node.state.interactableElements.length,
          isTerminal: node.isTerminal,
          isError: node.isError
        }
      })),
      edges: transitions.map((transition, index) => ({
        id: `edge-${index}`,
        from: transition.fromStateId,
        to: transition.toStateId,
        label: `${transition.interaction.type} on ${transition.interaction.elementSelector}`,
        data: {
          interactionType: transition.interaction.type,
          probability: transition.probability,
          isReversible: transition.isReversible
        }
      }))
    };

    // Calculate coverage estimate
    const coverage = this.estimateCoverage(session);

    return {
      url,
      timestamp: Date.now(),
      states: discoveredStates,
      interactions: discoveredInteractions,
      transitions: discoveredTransitions,
      stateGraph,
      coverage,
      metrics: session.metrics
    };
  }

  /**
   * Estimate exploration coverage
   */
  private estimateCoverage(session: ExplorationSession): number {
    const { graph } = session;
    const states = Array.from(graph.nodes.values());
    
    // Simple heuristic: ratio of explored interactions to total possible
    let totalPossible = 0;
    let totalExplored = 0;
    
    states.forEach(node => {
      const possibleCount = node.state.interactableElements.length;
      const exploredCount = node.outgoingEdges.length;
      
      totalPossible += possibleCount;
      totalExplored += Math.min(exploredCount, possibleCount);
    });
    
    return totalPossible > 0 ? totalExplored / totalPossible : 0;
  }

  /**
   * Emit progress events
   */
  private emitProgress(): void {
    if (!this.session) return;
    
    const states = Array.from(this.session.graph.nodes.values());
    const explored = states.filter(s => s.visitCount > 0).length;
    const total = states.length;
    
    this.emit('explorationProgress', { explored, total });
  }
}