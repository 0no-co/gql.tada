import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { GraphQLSPConfig } from '@gql.tada/internal';

// TODO: add tada-version to the state file to detect changes in the CLI version
// TODO: use a similar way to thread.ts to gather all monitored files

export interface ChangeDetectionOptions {
  /** Whether to enable change detection */
  skipUnchanged: boolean;
}

export interface ChangeDetectionResult {
  /** Whether cache regeneration should be skipped */
  shouldSkip: boolean;
  /** Reason for the decision */
  reason: string;
  /** Hash of current state for debugging */
  currentHash?: string;
  /** Previous hash for comparison */
  previousHash?: string;
}

interface ChangeDetectionState {
  /** Hash of all GraphQL-related content */
  contentHash: string;
  /** Timestamp of last cache generation */
  timestamp: number;
  /** Paths that were monitored */
  monitoredPaths: string[];
  /** Configuration hash */
  configHash: string;
}

/**
 * Detects changes in GraphQL-related files to determine if cache regeneration is needed
 */
export class ChangeDetector {
  private readonly stateFilePath: string;
  private readonly rootPath: string;
  private readonly pluginConfig: GraphQLSPConfig;

  constructor(rootPath: string, pluginConfig: GraphQLSPConfig) {
    this.rootPath = rootPath;
    this.pluginConfig = pluginConfig;
    this.stateFilePath = path.join(rootPath, '.gql-tada-change-state.json');
  }

  /**
   * Check if cache regeneration should be skipped based on file changes
   */
  async shouldSkipRegeneration(options: ChangeDetectionOptions): Promise<ChangeDetectionResult> {
    if (!options.skipUnchanged) {
      return {
        shouldSkip: false,
        reason: 'Change detection disabled',
      };
    }

    try {
      const currentState = await this.getCurrentState();
      const previousState = await this.getPreviousState();

      if (!previousState) {
        return {
          shouldSkip: false,
          reason: 'No previous state found',
          currentHash: currentState.contentHash,
        };
      }

      // Check if configuration changed
      if (currentState.configHash !== previousState.configHash) {
        return {
          shouldSkip: false,
          reason: 'Configuration changed',
          currentHash: currentState.contentHash,
          previousHash: previousState.contentHash,
        };
      }

      // Check if GraphQL content changed
      if (currentState.contentHash !== previousState.contentHash) {
        return {
          shouldSkip: false,
          reason: 'GraphQL content changed',
          currentHash: currentState.contentHash,
          previousHash: previousState.contentHash,
        };
      }

      // Check if any monitored files were modified after last cache generation
      const hasModifiedFiles = await this.hasModifiedFiles(previousState);
      if (hasModifiedFiles) {
        return {
          shouldSkip: false,
          reason: 'Monitored files modified',
          currentHash: currentState.contentHash,
          previousHash: previousState.contentHash,
        };
      }

      return {
        shouldSkip: true,
        reason: 'No changes detected',
        currentHash: currentState.contentHash,
        previousHash: previousState.contentHash,
      };
    } catch (error) {
      return {
        shouldSkip: false,
        reason: `Error during change detection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Save current state after successful cache generation
   */
  async saveCurrentState(): Promise<void> {
    try {
      const state = await this.getCurrentState();
      await fs.promises.writeFile(this.stateFilePath, JSON.stringify(state, null, 2));
    } catch (error) {
      // Don't fail the entire process if we can't save state
      console.warn('Warning: Failed to save change detection state:', error);
    }
  }

  private async getCurrentState(): Promise<ChangeDetectionState> {
    const [contentHash, monitoredPaths] = await Promise.all([
      this.calculateContentHash(),
      this.getMonitoredPaths(),
    ]);

    return {
      contentHash,
      timestamp: Date.now(),
      monitoredPaths,
      configHash: this.calculateConfigHash(),
    };
  }

  private async getPreviousState(): Promise<ChangeDetectionState | null> {
    try {
      const data = await fs.promises.readFile(this.stateFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // State file doesn't exist or is corrupted
      return null;
    }
  }

  private async calculateContentHash(): Promise<string> {
    const hash = crypto.createHash('sha256');
    const monitoredPaths = await this.getMonitoredPaths();

    // Sort paths for consistent hashing
    const sortedPaths = monitoredPaths.sort();

    for (const filePath of sortedPaths) {
      try {
        // Hash file path and modification time for efficiency
        const stats = await fs.promises.stat(filePath);
        hash.update(filePath);
        hash.update(stats.mtime.toISOString());
        hash.update(stats.size.toString());
      } catch (error) {
        // File might have been deleted, include in hash
        hash.update(filePath + ':DELETED');
      }
    }

    return hash.digest('hex');
  }

  private calculateConfigHash(): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(this.pluginConfig));
    return hash.digest('hex');
  }

  private async getMonitoredPaths(): Promise<string[]> {
    const paths: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];

    await this.collectFilesRecursively(this.rootPath, paths, extensions);
    return paths;
  }

  private async collectFilesRecursively(
    dirPath: string,
    paths: string[],
    extensions: string[]
  ): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip common directories that shouldn't contain GraphQL files
        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
            continue;
          }
          await this.collectFilesRecursively(fullPath, paths, extensions);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            paths.push(path.relative(this.rootPath, fullPath));
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private async hasModifiedFiles(previousState: ChangeDetectionState): Promise<boolean> {
    // Check if any new files were added (already handled by content hash)
    // Check if any files were modified after the timestamp
    const threshold = new Date(previousState.timestamp);

    for (const filePath of previousState.monitoredPaths) {
      try {
        const stats = await fs.promises.stat(filePath);
        if (stats.mtime > threshold) {
          return true;
        }
      } catch (error) {
        // File was deleted, consider as modified
        return true;
      }
    }

    return false;
  }
}
