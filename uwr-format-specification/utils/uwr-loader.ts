/**
 * UWR Loader Utility
 * Provides functionality to load, validate, and work with UWR documents
 */

import { UWRDocument, Molecule, StateNode, BehavioralEquation } from '../types/uwr-types';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import Ajv from 'ajv';

export class UWRLoader {
  private static ajv = new Ajv({ allErrors: true });
  private static schema: any = null;

  /**
   * Load and validate a UWR document
   */
  static async load(filePath: string): Promise<UWRDocument> {
    try {
      // Read the main document
      const content = await fs.readFile(filePath, 'utf-8');
      const document = JSON.parse(content) as UWRDocument;

      // Validate against schema
      await this.validate(document);

      // Verify checksums
      await this.verifyChecksums(document, path.dirname(filePath));

      return document;
    } catch (error) {
      throw new Error(`Failed to load UWR document: ${error.message}`);
    }
  }

  /**
   * Validate a UWR document against the schema
   */
  static async validate(document: UWRDocument): Promise<boolean> {
    if (!this.schema) {
      const schemaPath = path.join(__dirname, '../schemas/uwr-schema.json');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      this.schema = JSON.parse(schemaContent);
    }

    const validate = this.ajv.compile(this.schema);
    const valid = validate(document);

    if (!valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validate.errors, null, 2)}`);
    }

    // Additional validation for fidelity scores
    if (document.metadata.fidelityScore.overall < 0.999) {
      console.warn(`Warning: Overall fidelity score ${document.metadata.fidelityScore.overall} is below target of 0.999`);
    }

    return true;
  }

  /**
   * Verify data integrity using checksums
   */
  static async verifyChecksums(document: UWRDocument, basePath: string): Promise<boolean> {
    const checksums = document.validationChecksums;

    // Verify visual data checksum
    const visualDataString = JSON.stringify(document.visualData);
    const visualChecksum = crypto.createHash('sha256').update(visualDataString).digest('hex');
    if (`sha256:${visualChecksum}` !== checksums.visualDataChecksum) {
      throw new Error('Visual data checksum mismatch');
    }

    // Verify molecule tree checksum
    const moleculeString = JSON.stringify(document.molecules);
    const moleculeChecksum = crypto.createHash('sha256').update(moleculeString).digest('hex');
    if (`sha256:${moleculeChecksum}` !== checksums.moleculeTreeChecksum) {
      throw new Error('Molecule tree checksum mismatch');
    }

    // Verify state graph checksum
    const stateGraphString = JSON.stringify(document.stateGraph);
    const stateGraphChecksum = crypto.createHash('sha256').update(stateGraphString).digest('hex');
    if (`sha256:${stateGraphChecksum}` !== checksums.stateGraphChecksum) {
      throw new Error('State graph checksum mismatch');
    }

    return true;
  }

  /**
   * Get a specific frame from the visual tensor
   */
  static async getFrame(document: UWRDocument, timestamp: number, basePath: string): Promise<ArrayBuffer> {
    const tensorPath = path.join(basePath, document.visualData.tensor4D.dataUrl);
    
    // This is a simplified implementation - in reality, we'd need to:
    // 1. Open the tensor file
    // 2. Seek to the correct position based on timestamp
    // 3. Decode the frame based on the encoding format
    // 4. Return the raw pixel data
    
    throw new Error('Frame extraction not yet implemented');
  }

  /**
   * Find molecules by type
   */
  static findMoleculesByType(document: UWRDocument, type: string): Molecule[] {
    return document.molecules.filter(mol => mol.type === type);
  }

  /**
   * Get the state at a specific timestamp
   */
  static getStateAtTimestamp(document: UWRDocument, timestamp: number): StateNode | null {
    // Find the state that was active at the given timestamp
    const states = document.stateGraph.nodes
      .filter(state => state.timestamp <= timestamp)
      .sort((a, b) => b.timestamp - a.timestamp);

    return states.length > 0 ? states[0] : null;
  }

  /**
   * Evaluate a behavioral equation
   */
  static evaluateEquation(
    document: UWRDocument,
    moleculeId: string,
    property: string,
    variables: Record<string, number>
  ): number | null {
    const equation = document.behavioralEquations.find(
      eq => eq.element === moleculeId && eq.property === property
    );

    if (!equation) {
      return null;
    }

    // This is a simplified implementation
    // In reality, we'd need a proper expression evaluator
    try {
      let expression = equation.equation;
      
      // Replace variables in the equation
      for (const [name, value] of Object.entries(variables)) {
        expression = expression.replace(new RegExp(name, 'g'), value.toString());
      }

      // Evaluate the expression (WARNING: eval is dangerous in production)
      // A real implementation would use a safe expression parser
      const result = eval(expression);

      // Apply constraints
      if (equation.constraints.min !== undefined && result < equation.constraints.min) {
        return equation.constraints.min;
      }
      if (equation.constraints.max !== undefined && result > equation.constraints.max) {
        return equation.constraints.max;
      }

      return result;
    } catch (error) {
      console.error(`Failed to evaluate equation: ${error.message}`);
      return null;
    }
  }

  /**
   * Find the shortest path between two states
   */
  static findStatePath(document: UWRDocument, fromStateId: string, toStateId: string): string[] | null {
    const { nodes, edges } = document.stateGraph;
    
    // Build adjacency list
    const adjacency: Record<string, string[]> = {};
    for (const edge of edges) {
      if (!adjacency[edge.fromState]) {
        adjacency[edge.fromState] = [];
      }
      adjacency[edge.fromState].push(edge.toState);
    }

    // BFS to find shortest path
    const queue: Array<{ state: string; path: string[] }> = [
      { state: fromStateId, path: [fromStateId] }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { state, path } = queue.shift()!;

      if (state === toStateId) {
        return path;
      }

      if (visited.has(state)) {
        continue;
      }
      visited.add(state);

      const neighbors = adjacency[state] || [];
      for (const neighbor of neighbors) {
        queue.push({
          state: neighbor,
          path: [...path, neighbor]
        });
      }
    }

    return null;
  }

  /**
   * Calculate the visual difference between two states
   */
  static calculateStateDifference(document: UWRDocument, state1Id: string, state2Id: string): number {
    const state1 = document.stateGraph.nodes.find(n => n.id === state1Id);
    const state2 = document.stateGraph.nodes.find(n => n.id === state2Id);

    if (!state1 || !state2) {
      throw new Error('State not found');
    }

    // Simple hash comparison (in reality, we'd do perceptual hashing)
    return state1.visualHash === state2.visualHash ? 0 : 1;
  }

  /**
   * Export a subset of the document
   */
  static async exportSubset(
    document: UWRDocument,
    options: {
      startTime?: number;
      endTime?: number;
      moleculeIds?: string[];
      stateIds?: string[];
    }
  ): Promise<UWRDocument> {
    // Deep clone the document
    const subset = JSON.parse(JSON.stringify(document)) as UWRDocument;

    // Filter by time range
    if (options.startTime !== undefined || options.endTime !== undefined) {
      const start = options.startTime || 0;
      const end = options.endTime || Infinity;

      // Filter keyframes
      subset.visualData.keyframes = subset.visualData.keyframes.filter(
        kf => kf.timestamp >= start && kf.timestamp <= end
      );

      // Filter states
      subset.stateGraph.nodes = subset.stateGraph.nodes.filter(
        node => node.timestamp >= start && node.timestamp <= end
      );
    }

    // Filter by molecules
    if (options.moleculeIds) {
      subset.molecules = subset.molecules.filter(
        mol => options.moleculeIds!.includes(mol.id)
      );
    }

    // Filter by states
    if (options.stateIds) {
      subset.stateGraph.nodes = subset.stateGraph.nodes.filter(
        node => options.stateIds!.includes(node.id)
      );
      
      subset.stateGraph.edges = subset.stateGraph.edges.filter(
        edge => options.stateIds!.includes(edge.fromState) && 
                options.stateIds!.includes(edge.toState)
      );
    }

    // Recalculate checksums
    subset.validationChecksums = this.calculateChecksums(subset);

    return subset;
  }

  /**
   * Calculate checksums for a document
   */
  private static calculateChecksums(document: UWRDocument): typeof document.validationChecksums {
    const visualDataString = JSON.stringify(document.visualData);
    const moleculeString = JSON.stringify(document.molecules);
    const stateGraphString = JSON.stringify(document.stateGraph);

    return {
      visualDataChecksum: `sha256:${crypto.createHash('sha256').update(visualDataString).digest('hex')}`,
      moleculeTreeChecksum: `sha256:${crypto.createHash('sha256').update(moleculeString).digest('hex')}`,
      stateGraphChecksum: `sha256:${crypto.createHash('sha256').update(stateGraphString).digest('hex')}`,
      crossValidation: document.validationChecksums.crossValidation
    };
  }

  /**
   * Generate a summary report of the document
   */
  static generateSummary(document: UWRDocument): string {
    const summary = [
      `UWR Document Summary`,
      `===================`,
      `Version: ${document.version}`,
      `URL: ${document.metadata.targetUrl}`,
      `Capture Time: ${document.metadata.captureTimestamp}`,
      `Platform: ${document.metadata.captureEnvironment.platform}`,
      ``,
      `Fidelity Scores:`,
      `  Overall: ${(document.metadata.fidelityScore.overall * 100).toFixed(2)}%`,
      `  Visual: ${(document.metadata.fidelityScore.visual * 100).toFixed(2)}%`,
      `  Behavioral: ${(document.metadata.fidelityScore.behavioral * 100).toFixed(2)}%`,
      `  Timing: ${(document.metadata.fidelityScore.timing * 100).toFixed(2)}%`,
      `  Color: ${(document.metadata.fidelityScore.color * 100).toFixed(2)}%`,
      ``,
      `Capture Settings:`,
      `  Frame Rate: ${document.metadata.captureSettings.frameRate} fps`,
      `  Color Space: ${document.metadata.captureSettings.colorSpace}`,
      `  Mode: ${document.metadata.captureSettings.captureMode}`,
      ``,
      `Data Statistics:`,
      `  Molecules: ${document.molecules.length}`,
      `  States: ${document.stateGraph.nodes.length}`,
      `  Transitions: ${document.stateGraph.edges.length}`,
      `  Behavioral Equations: ${document.behavioralEquations.length}`,
      `  Keyframes: ${document.visualData.keyframes.length}`,
      ``,
      `Molecule Types:`,
    ];

    // Count molecule types
    const typeCounts: Record<string, number> = {};
    for (const mol of document.molecules) {
      typeCounts[mol.type] = (typeCounts[mol.type] || 0) + 1;
    }
    
    for (const [type, count] of Object.entries(typeCounts)) {
      summary.push(`  ${type}: ${count}`);
    }

    if (document.metadata.edgeCasesDetected.length > 0) {
      summary.push(``, `Edge Cases Detected:`);
      for (const edgeCase of document.metadata.edgeCasesDetected) {
        summary.push(`  ${edgeCase.type}: ${edgeCase.description}`);
      }
    }

    return summary.join('\n');
  }
}

/**
 * Example usage:
 * 
 * const document = await UWRLoader.load('capture.uwr');
 * console.log(UWRLoader.generateSummary(document));
 * 
 * const buttons = UWRLoader.findMoleculesByType(document, 'interactive_button');
 * const opacity = UWRLoader.evaluateEquation(document, 'mol_001', 'opacity', { scrollY: 500 });
 * const path = UWRLoader.findStatePath(document, 'state_001', 'state_003');
 */