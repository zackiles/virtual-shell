import BaseCommand from './base-command'
import { ERROR_MESSAGES } from '../types'

/**
 * @class
 * @classdesc Changes the current working directory within the virtual shell environment.
 * Extends BaseCommand to utilize shared functionality.
 */
export default class CdCommand extends BaseCommand {
  /**
   * Changes the current working directory.
   * @param {Array<string>} args - The command arguments.
   * @returns {Promise<string>} - An empty string upon successful directory change.
   * @throws {Error} If the path is missing.
   */
  override async execute(args: string[]): Promise<string> {
    if (args.length === 0) {
      throw new Error(ERROR_MESSAGES.ERR_MISSING_PATH)
    }

    const newPath = args[0]

    if (newPath === undefined) {
      throw new Error(ERROR_MESSAGES.ERR_MISSING_PATH)
    }
    const result = await this.shell.changeDirectory(newPath)

    if (typeof result !== 'string') {
      throw new Error(result)
    }

    return ''
  }
}
