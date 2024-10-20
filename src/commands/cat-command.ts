import BaseCommand from './base-command';
import { ERROR_MESSAGES } from '../types';

export default class CatCommand extends BaseCommand {
  override async execute(args: string[]): Promise<string> {
    if (args.length === 0) {

      throw new Error(ERROR_MESSAGES.NO_COMMAND('cat'));
    }

    const filePaths = args.map((file) => this.shell.path.resolve(this.shell.currentDirectory, file));
    let output = '';

    for (const filePath of filePaths) {
      try {
        const stats = await this.shell.fs.lstat(filePath);
        if (stats.isDirectory()) {
          throw new Error(ERROR_MESSAGES.ERR_NOT_A_DIRECTORY(this.shell.path.basename(filePath)));
        }
        
        const data = await this.shell.fs.readFile(filePath, 'utf8');
        output += data;
      } catch (err: unknown) {
        if (err instanceof Error) {
          const error = err as NodeJS.ErrnoException;
          if ('code' in error) {
            if (error.code === 'ENOENT') {
              throw new Error(ERROR_MESSAGES.ERR_NO_SUCH_DIRECTORY(this.shell.path.basename(filePath)));
            }
          }
          throw new Error(`cat: ${this.shell.path.basename(filePath)}: ${error.message}`);
        }
        throw new Error(`cat: ${this.shell.path.basename(filePath)}: ${ERROR_MESSAGES.ERR_UNKNOWN}`);
      }
    }

    return output;
  }
}
