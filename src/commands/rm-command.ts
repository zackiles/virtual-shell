import BaseCommand from './base-command';
import { ERROR_MESSAGES } from '../types';

export default class RmCommand extends BaseCommand {
  override async execute(args: string[]): Promise<string> {
    if (args.length === 0) {
      throw new Error(ERROR_MESSAGES.NO_COMMAND('rm'));
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

    if (args.length === 0) {
      throw new Error(ERROR_MESSAGES.ERR_MISSING_PATH);
    }

    const targets = args.map((arg) => this.resolvePath(arg));

    const rmFunction = async (params: { options: typeof options; targets: string[] }) => {
      const { options, targets } = params;

      for (const target of targets) {
        try {
          const stats = await this.shell.fs.lstat(target);
          if (stats.isDirectory()) {
            if (options.recursive) {
              await this.shell.fs.rm(target, { recursive: true, force: true });
            } else {
              throw new Error(`rm: cannot remove '${target}': Is a directory`);
            }
          } else {
            await this.shell.fs.unlink(target);
          }
        } catch (err: unknown) {
          const error = err as NodeJS.ErrnoException;
          let errorMessage = '';

          if (error.code === 'ENOENT') {
            errorMessage = ERROR_MESSAGES.ERR_NO_SUCH_DIRECTORY(target);
          } else {
            errorMessage = `rm: cannot remove '${target}': ${error.message}`;
          }

          throw new Error(errorMessage);
        }
      }
    };

   // const params = { options, targets };
    //await this.executeFunction(rmFunction, params, 2000, 128);

    return ''; // Return an empty string upon success
  }
}
