import BaseCommand from './base-command';
import { ERROR_MESSAGES } from '../types';

export default class TouchCommand extends BaseCommand {
  override async execute(args: string[]): Promise<string> {
    if (args.length === 0) {
      throw new Error(ERROR_MESSAGES.ERR_MISSING_PATH);
    }

    const fileName = args[0];

    if (!fileName) {
      const errorMessage = ERROR_MESSAGES.ERR_MISSING_PATH;
      throw new Error(errorMessage);
    }

    const filePath = this.shell.path.resolve(this.shell.currentDirectory, fileName);

    try {
      const now = new Date();
      await this.shell.fs.utimes(filePath, now, now);
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return this.createFile(filePath);
      }
      this.handleError(error, fileName);
    }

    return '';
  }

  private async createFile(filePath: string): Promise<string> {
    try {
      await this.shell.fs.writeFile(filePath, '');
    } catch (err) {
      const writeError = err as NodeJS.ErrnoException;
      const errorMessage = `touch: cannot create file '${filePath}': ${writeError.message}`;
      throw new Error(errorMessage);
    }
    return '';
  }

  private handleError(error: NodeJS.ErrnoException, fileName: string): void {
    const errorMessage = `touch: cannot touch '${fileName}': ${error.message}`;
    throw new Error(errorMessage);
  }
}
