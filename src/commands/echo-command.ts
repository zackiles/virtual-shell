import BaseCommand from './base-command';
import { ERROR_MESSAGES } from '../types';

/**
 * @class
 * @classdesc Outputs strings to standard output.
 * Extends BaseCommand to utilize shared functionality.
 */
export default class EchoCommand extends BaseCommand {
  /**
   * Outputs strings to standard output.
   * @param {Array<string>} args - The command arguments.
   * @returns {Promise<string>} - The output of the command.
   * @throws {Error} If the argument is missing.
   */
  override async execute(args: string[]): Promise<string> {
    if (args.length === 0) {
      throw new Error(ERROR_MESSAGES.NO_COMMAND('echo')); 
    }

    const output = args.join(' ');
    return output;
  }
}
