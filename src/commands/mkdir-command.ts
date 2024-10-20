import BaseCommand from './base-command';
import { ERROR_MESSAGES } from '../types';

/**
 * @class
 * @classdesc Creates new directories within the virtual filesystem, supporting options for creating parent directories as needed.
 * Extends BaseCommand to utilize shared functionality.
 */
export default class MkdirCommand extends BaseCommand {
  /**
   * Creates new directories with optional flags for creating parent directories.
   * @param {Array<string>} args - The command arguments representing directory paths and options.
   * @returns {Promise<string>} - An empty string upon successful creation of directories.
   * @throws {Error} If directory creation fails.
   */
  override async execute(args: string[]): Promise<string> {
    if (args.length === 0) {
      throw new Error(ERROR_MESSAGES.ERR_MISSING_PATH);
    }

    const options = {
      parents: false,
    };
    const directories: string[] = [];

    // Parse arguments for options and directory names
    for (const arg of args) {
      if (arg.startsWith('-')) {
        for (const char of arg.slice(1)) {
          if (char === 'p') {
            options.parents = true;
          } else {
            const errorMessage = ERROR_MESSAGES.ERR_INVALID_OPERATOR(char);
            throw new Error(errorMessage);
          }
        }
      } else {
        directories.push(this.shell.path.resolve(this.shell.currentDirectory, arg));
      }
    }

    const errors: string[] = [];

    for (const dir of directories) {
      try {
        await this.shell.fs.mkdir(dir, { recursive: options.parents });
      } catch (err: unknown) {
        const errorMsg = ERROR_MESSAGES.ERR_MKDIR_CREATE(this.shell.path.basename(dir), (err as Error).message);
        errors.push(errorMsg);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }

    return '';
  }
}
