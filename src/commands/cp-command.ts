import BaseCommand from './base-command';
import { ERROR_MESSAGES } from '../types';

export default class CpCommand extends BaseCommand {
  override async execute(args: string[]): Promise<string> {
    if (args.length < 2 || !args[0]) {
      throw new Error(ERROR_MESSAGES.NO_COMMAND('cp'));
    }

    const options = {
      recursive: false,
    };

    while (args.length > 0 && args[0].startsWith('-')) {
      const option = args.shift();
      if (option) {
        if (option === '-r' || option === '-R') {
          options.recursive = true;
        } else {
          throw new Error(ERROR_MESSAGES.ERR_INVALID_OPERATOR(option));
        }
      }
    }

    if (args.length < 2) {
      throw new Error(ERROR_MESSAGES.ERR_MISSING_PATH);
    }

    const sources = args.slice(0, -1).map((src) => this.shell.path.resolve(this.shell.currentDirectory, src));
    const destination = this.shell.path.resolve(this.shell.currentDirectory, args[args.length - 1] as string); // Assert as string

    const copyFile = async (src: string, dest: string) => {
      await this.shell.fs.copyFile(src, dest);
    };

    const copyDir = async (src: string, dest: string) => {
      await this.shell.fs.mkdir(dest, { recursive: true });
      const entries = await this.shell.fs.readdir(src, { withFileTypes: true });

      for (const entry of entries) {
        const dirent = entry as unknown as { name: string; isDirectory: () => boolean };

        const srcPath = this.shell.path.join(src, dirent.name);
        const destPath = this.shell.path.join(dest, dirent.name);

        if (dirent.isDirectory()) {
          await copyDir(srcPath, destPath);
        } else {
          await copyFile(srcPath, destPath);
        }
      }
    };

    for (const src of sources) {
      try {
        const stats = await this.shell.fs.lstat(src);
        let destPath = destination;

        try {
          const destStats = await this.shell.fs.lstat(destination);
          if (destStats.isDirectory()) {
            destPath = this.shell.path.join(destination, this.shell.path.basename(src));
          }
        } catch {}

        if (stats.isDirectory()) {
          if (options.recursive) {
            await copyDir(src, destPath);
          } else {
            throw new Error(`cp: -r not specified; omitting directory '${this.shell.path.basename(src)}'`);
          }
        } else {
          await copyFile(src, destPath);
        }
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        let errorMessage = '';

        if (error.code === 'ENOENT') {
          errorMessage = ERROR_MESSAGES.ERR_NO_SUCH_DIRECTORY(this.shell.path.basename(src));
        } else {
          errorMessage = `cp: cannot copy '${this.shell.path.basename(src)}': ${error.message}`;
        }

        throw new Error(errorMessage);
      }
    }

    return '';
  }
}
