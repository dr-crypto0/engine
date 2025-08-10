/**
 * FrameBuffer - High-performance circular buffer for frame storage
 * Optimized for 60-120fps capture with minimal memory overhead
 */

import { Frame, FrameBufferStats } from '../types';
import { EventEmitter } from 'events';

export class FrameBuffer extends EventEmitter {
  private frames: Map<string, Frame>;
  private frameOrder: string[];
  private maxSize: number;
  private totalBytesStored: number = 0;
  private droppedFrames: number = 0;

  constructor(maxSize: number = 1000) {
    super();
    this.maxSize = maxSize;
    this.frames = new Map();
    this.frameOrder = [];
  }

  /**
   * Add a frame to the buffer
   */
  add(frame: Frame): boolean {
    try {
      // Check if buffer is full
      if (this.frameOrder.length >= this.maxSize) {
        // Remove oldest frame
        const oldestFrameId = this.frameOrder.shift();
        if (oldestFrameId) {
          const oldFrame = this.frames.get(oldestFrameId);
          if (oldFrame) {
            this.totalBytesStored -= oldFrame.data.length;
            this.frames.delete(oldestFrameId);
            this.droppedFrames++;
          }
        }
      }

      // Add new frame
      this.frames.set(frame.id, frame);
      this.frameOrder.push(frame.id);
      this.totalBytesStored += frame.data.length;

      // Emit event for frame addition
      this.emit('frameAdded', {
        frameId: frame.id,
        timestamp: frame.timestamp,
        bufferSize: this.frames.size
      });

      return true;
    } catch (error) {
      this.emit('error', {
        error,
        context: 'FrameBuffer.add'
      });
      return false;
    }
  }

  /**
   * Get a frame by ID
   */
  get(frameId: string): Frame | undefined {
    return this.frames.get(frameId);
  }

  /**
   * Get frame by timestamp (finds closest match)
   */
  getByTimestamp(timestamp: number): Frame | undefined {
    let closestFrame: Frame | undefined;
    let minDiff = Infinity;

    for (const frame of this.frames.values()) {
      const diff = Math.abs(frame.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }

    return closestFrame;
  }

  /**
   * Get frames within a time range
   */
  getRange(startTime: number, endTime: number): Frame[] {
    const rangeFrames: Frame[] = [];

    for (const frame of this.frames.values()) {
      if (frame.timestamp >= startTime && frame.timestamp <= endTime) {
        rangeFrames.push(frame);
      }
    }

    // Sort by timestamp
    return rangeFrames.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get the most recent N frames
   */
  getRecent(count: number): Frame[] {
    const startIndex = Math.max(0, this.frameOrder.length - count);
    const recentIds = this.frameOrder.slice(startIndex);
    
    return recentIds
      .map(id => this.frames.get(id))
      .filter((frame): frame is Frame => frame !== undefined);
  }

  /**
   * Get all frames in order
   */
  getAllFrames(): Frame[] {
    return this.frameOrder
      .map(id => this.frames.get(id))
      .filter((frame): frame is Frame => frame !== undefined);
  }

  /**
   * Remove frames older than a specific timestamp
   */
  removeOlderThan(timestamp: number): number {
    let removedCount = 0;
    const framesToRemove: string[] = [];

    for (const [id, frame] of this.frames.entries()) {
      if (frame.timestamp < timestamp) {
        framesToRemove.push(id);
      }
    }

    for (const id of framesToRemove) {
      const frame = this.frames.get(id);
      if (frame) {
        this.totalBytesStored -= frame.data.length;
        this.frames.delete(id);
        this.frameOrder = this.frameOrder.filter(frameId => frameId !== id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.emit('framesRemoved', {
        count: removedCount,
        reason: 'age'
      });
    }

    return removedCount;
  }

  /**
   * Clear all frames from the buffer
   */
  clear(): void {
    const previousSize = this.frames.size;
    this.frames.clear();
    this.frameOrder = [];
    this.totalBytesStored = 0;

    this.emit('bufferCleared', {
      framesCleared: previousSize
    });
  }

  /**
   * Get buffer statistics
   */
  getStats(): FrameBufferStats {
    const frames = this.getAllFrames();
    const oldestFrame = frames[0];
    const newestFrame = frames[frames.length - 1];

    return {
      size: this.frames.size,
      capacity: this.maxSize,
      oldestFrame: oldestFrame?.timestamp || 0,
      newestFrame: newestFrame?.timestamp || 0,
      averageFrameSize: this.frames.size > 0 ? this.totalBytesStored / this.frames.size : 0
    };
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.frames.size;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.frames.size >= this.maxSize;
  }

  /**
   * Get total memory usage in bytes
   */
  getMemoryUsage(): number {
    return this.totalBytesStored;
  }

  /**
   * Get dropped frame count
   */
  getDroppedFrameCount(): number {
    return this.droppedFrames;
  }

  /**
   * Export frames to array for processing
   */
  exportFrames(startIndex?: number, endIndex?: number): Frame[] {
    const start = startIndex || 0;
    const end = endIndex || this.frameOrder.length;
    
    const exportIds = this.frameOrder.slice(start, end);
    return exportIds
      .map(id => this.frames.get(id))
      .filter((frame): frame is Frame => frame !== undefined);
  }

  /**
   * Optimize buffer by removing duplicate or similar frames
   */
  optimize(threshold: number = 0.95): number {
    // This is a placeholder for frame similarity detection
    // In a real implementation, this would use perceptual hashing
    // or other image comparison techniques
    
    let optimizedCount = 0;
    
    // For now, just emit an event indicating optimization was requested
    this.emit('optimizationRequested', {
      threshold,
      currentSize: this.frames.size
    });

    return optimizedCount;
  }

  /**
   * Create a snapshot of the current buffer state
   */
  createSnapshot(): {
    frameCount: number;
    totalBytes: number;
    oldestTimestamp: number;
    newestTimestamp: number;
    frameIds: string[];
  } {
    const frames = this.getAllFrames();
    
    return {
      frameCount: this.frames.size,
      totalBytes: this.totalBytesStored,
      oldestTimestamp: frames[0]?.timestamp || 0,
      newestTimestamp: frames[frames.length - 1]?.timestamp || 0,
      frameIds: [...this.frameOrder]
    };
  }

  /**
   * Iterator for frames
   */
  *[Symbol.iterator](): Iterator<Frame> {
    for (const id of this.frameOrder) {
      const frame = this.frames.get(id);
      if (frame) {
        yield frame;
      }
    }
  }
}