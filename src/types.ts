import type VirtualShell from './virtual-shell.ts'
export type { VirtualShell }

export interface VirtualShellOptions {
  serializedVolume?: string
  currentDirectory?: string
  user?: string
}

export const ERROR_MESSAGES = {
  NO_COMMAND: (command: string) => `${command}: command not provided`,
  ERR_CMD_NOT_FOUND: (command: string) => `${command}: command not found`,
  ERR_PERMISSION_DENIED: (filePath: string) => `${filePath}: permission denied`,
  ERR_NOT_A_DIRECTORY: (path: string) => `cd: ${path}: not a directory`,
  ERR_NO_SUCH_DIRECTORY: (path: string) => `cd: ${path}: no such file or directory`,
  ERR_INVALID_OPERATOR: (operator: string) => `${operator}: invalid operator`,
  ERR_UNKNOWN: 'An unknown error occurred',
  ERR_INVALID_COMMAND_CLASS: (path: string) => `${path}: invalid command class`,
  ERR_MISSING_PATH: 'cd: missing operand',
  ERR_MKDIR_CREATE: (dir: string, message: string) => `mkdir: cannot create directory '${dir}': ${message}`,
}

export interface BaseCommand {
  execute(args: string[]): Promise<string>
}
