/**
 * Integration tests for the Interaction Discovery System
 */

import { InteractionDiscoveryEngine } from '../../src';
import { InteractionDiscoveryConfig } from '../../src/types';
import * as puppeteer from 'puppeteer';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

// Test server setup
let server: http.Server;
let serverUrl: string;

beforeAll(async () => {
  // Create a simple test server
  server = http.createServer((req, res) => {
    const testPages = {
      '/': `
        <html>
          <head><title>Test Home</title></head>
          <body>
            <h1>Test Website</h1>
            <a href="/page1">Page 1</a>
            <a href="/page2">Page 2</a>
            <button id="btn1">Click Me</button>
            <input type="text" id="input1" placeholder="Enter text">
          </body>
        </html>
      `,
      '/page1': `
        <html>
          <head><title>Page 1</title></head>
          <body>
            <h1>Page 1</h1>
            <a href="/">Home</a>
            <button onclick="alert('Clicked!')">Alert Button</button>
          </body>
        </html>
      `,
      '/page2': `
        <html>
          <head><title>Page 2</title></head>
          <body>
            <h1>Page 2</h1>
            <a href="/">Home</a>
            <form>
              <input type="email" placeholder="Email">
              <input type="password" placeholder="Password">
              <button type="submit">Submit</button>
            </form>
          </body>
        </html>
      `
    };

    const content = testPages[req.url as string] || '<h1>404 Not Found</h1>';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address() as any;
      serverUrl = `http://localhost:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('InteractionDiscoveryEngine', () => {
  let engine: InteractionDiscoveryEngine;

  afterEach(async () => {
    if (engine) {
      await engine.cleanup();
    }
  });

  test('should discover basic website structure', async () => {
    const config: InteractionDiscoveryConfig = {
      url: serverUrl,
      strategy: 'breadth-first',
      maxDepth: 3,
      maxStates: 10,
      captureScreenshots: false,
      browserOptions: {
        headless: true,
        viewport: { width: 1280, height: 720 }
      }
    };

    engine = new InteractionDiscoveryEngine(config);
    
    const statesDiscovered: string[] = [];
    engine.on('stateDiscovered', ({ state }) => {
      statesDiscovered.push(state.url);
    });

    const result = await engine.discover();

    // Verify results
    expect(result.states.length).toBeGreaterThanOrEqual(3); // At least 3 pages
    expect(result.interactions.length).toBeGreaterThan(0);
    expect(result.transitions.length).toBeGreaterThan(0);
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThanOrEqual(1);

    // Check that all pages were discovered
    const urls = result.states.map(s => s.url);
    expect(urls).toContain(serverUrl + '/');
    expect(urls).toContain(serverUrl + '/page1');
    expect(urls).toContain(serverUrl + '/page2');
  }, 30000);

  test('should detect interactive elements', async () => {
    const config: InteractionDiscoveryConfig = {
      url: serverUrl,
      strategy: 'breadth-first',
      maxDepth: 1,
      captureScreenshots: false,
      browserOptions: {
        headless: true
      }
    };

    engine = new InteractionDiscoveryEngine(config);
    const result = await engine.discover();

    // Find the home page state
    const homeState = result.states.find(s => s.url === serverUrl + '/');
    expect(homeState).toBeDefined();
    expect(homeState!.possibleInteractions).toBeDefined();
    
    const interactions = homeState!.possibleInteractions!;
    
    // Should find links
    const links = interactions.filter(i => i.type === 'link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    
    // Should find button
    const buttons = interactions.filter(i => i.type === 'button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    
    // Should find input
    const inputs = interactions.filter(i => i.type === 'input');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  }, 20000);

  test('should handle exploration strategies', async () => {
    const strategies: Array<'breadth-first' | 'depth-first'> = ['breadth-first', 'depth-first'];
    
    for (const strategy of strategies) {
      const config: InteractionDiscoveryConfig = {
        url: serverUrl,
        strategy,
        maxDepth: 2,
        maxStates: 5,
        captureScreenshots: false,
        browserOptions: {
          headless: true
        }
      };

      engine = new InteractionDiscoveryEngine(config);
      
      const explorationOrder: string[] = [];
      engine.on('stateDiscovered', ({ state }) => {
        explorationOrder.push(state.url);
      });

      const result = await engine.discover();
      
      expect(result.states.length).toBeGreaterThan(0);
      expect(explorationOrder.length).toBeGreaterThan(0);
      
      // Cleanup for next iteration
      await engine.cleanup();
    }
  }, 40000);

  test('should generate state graph', async () => {
    const config: InteractionDiscoveryConfig = {
      url: serverUrl,
      strategy: 'breadth-first',
      maxDepth: 2,
      captureScreenshots: false,
      browserOptions: {
        headless: true
      }
    };

    engine = new InteractionDiscoveryEngine(config);
    const result = await engine.discover();

    expect(result.stateGraph).toBeDefined();
    expect(result.stateGraph!.nodes.length).toBeGreaterThan(0);
    expect(result.stateGraph!.edges.length).toBeGreaterThan(0);

    // Verify graph structure
    const nodeIds = new Set(result.stateGraph!.nodes.map(n => n.id));
    
    // All edges should reference valid nodes
    result.stateGraph!.edges.forEach(edge => {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    });
  }, 20000);

  test('should emit progress events', async () => {
    const config: InteractionDiscoveryConfig = {
      url: serverUrl,
      strategy: 'breadth-first',
      maxDepth: 2,
      captureScreenshots: false,
      browserOptions: {
        headless: true
      }
    };

    engine = new InteractionDiscoveryEngine(config);
    
    const progressUpdates: any[] = [];
    engine.on('explorationProgress', (progress) => {
      progressUpdates.push(progress);
    });

    await engine.discover();

    expect(progressUpdates.length).toBeGreaterThan(0);
    
    // Progress should increase
    for (let i = 1; i < progressUpdates.length; i++) {
      expect(progressUpdates[i].explored).toBeGreaterThanOrEqual(
        progressUpdates[i - 1].explored
      );
    }
  }, 20000);

  test('should handle errors gracefully', async () => {
    const config: InteractionDiscoveryConfig = {
      url: 'http://invalid-url-that-does-not-exist.com',
      strategy: 'breadth-first',
      maxDepth: 1,
      captureScreenshots: false,
      browserOptions: {
        headless: true
      }
    };

    engine = new InteractionDiscoveryEngine(config);
    
    const errors: any[] = [];
    engine.on('error', (error) => {
      errors.push(error);
    });

    await expect(engine.discover()).rejects.toThrow();
    
    // Should have emitted error events
    expect(errors.length).toBeGreaterThan(0);
  }, 10000);

  test('should respect max states limit', async () => {
    const maxStates = 3;
    const config: InteractionDiscoveryConfig = {
      url: serverUrl,
      strategy: 'breadth-first',
      maxDepth: 10, // High depth
      maxStates, // But limited states
      captureScreenshots: false,
      browserOptions: {
        headless: true
      }
    };

    engine = new InteractionDiscoveryEngine(config);
    const result = await engine.discover();

    expect(result.states.length).toBeLessThanOrEqual(maxStates);
  }, 20000);

  test('should capture screenshots when enabled', async () => {
    const config: InteractionDiscoveryConfig = {
      url: serverUrl,
      strategy: 'breadth-first',
      maxDepth: 1,
      maxStates: 2,
      captureScreenshots: true,
      browserOptions: {
        headless: true
      }
    };

    engine = new InteractionDiscoveryEngine(config);
    const result = await engine.discover();

    // At least one state should have a screenshot
    const statesWithScreenshots = result.states.filter(s => s.screenshot);
    expect(statesWithScreenshots.length).toBeGreaterThan(0);
    
    // Screenshots should be base64 encoded
    statesWithScreenshots.forEach(state => {
      expect(state.screenshot).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  }, 20000);
});

describe('CLI Export Functionality', () => {
  test('should export to different formats', async () => {
    // Mock discovery result
    const mockResult = {
      url: 'https://example.com',
      timestamp: Date.now(),
      states: [
        {
          id: 'state1',
          url: 'https://example.com',
          title: 'Home',
          possibleInteractions: []
        },
        {
          id: 'state2',
          url: 'https://example.com/page1',
          title: 'Page 1',
          possibleInteractions: []
        }
      ],
      interactions: [
        {
          id: 'int1',
          type: 'click' as const,
          selector: 'a[href="/page1"]',
          fromState: 'state1',
          toState: 'state2',
          successful: true
        }
      ],
      transitions: [
        {
          id: 'trans1',
          fromState: 'state1',
          toState: 'state2',
          interaction: 'click',
          count: 1
        }
      ],
      stateGraph: {
        nodes: [
          { id: 'state1', label: 'Home' },
          { id: 'state2', label: 'Page 1' }
        ],
        edges: [
          { from: 'state1', to: 'state2', label: 'click' }
        ]
      },
      coverage: 0.75
    };

    // Test UWR export format
    const uwrExport = {
      version: '1.0',
      metadata: {
        url: mockResult.url,
        captureDate: mockResult.timestamp,
        generator: 'interaction-discovery-system'
      },
      states: mockResult.states,
      stateGraph: mockResult.stateGraph
    };

    expect(uwrExport.version).toBe('1.0');
    expect(uwrExport.metadata.url).toBe(mockResult.url);
    expect(uwrExport.states.length).toBe(2);

    // Test Graphviz export format
    const graphvizExport = `digraph StateGraph {
  rankdir=LR;
  node [shape=box];

  "state1" [label="Home"];
  "state2" [label="Page 1"];

  "state1" -> "state2" [label="click"];
}`;

    expect(graphvizExport).toContain('digraph StateGraph');
    expect(graphvizExport).toContain('"state1" [label="Home"]');
    expect(graphvizExport).toContain('"state1" -> "state2"');
  });
});