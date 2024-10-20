import ivm from 'isolated-vm'
import type { VirtualShell } from '../types'

/**
 * The base file for all commands. Provides global state and methods.
 * @extends EventEmitter
 */
export default class BaseCommand {
  shell: InstanceType<typeof VirtualShell>

  /**
   * Constructs a new command.
   * @param {VirtualShell} shell - An instance of the VirtualShell to access its properties.
   */
  constructor(shell: VirtualShell) {
    this.shell = shell
  }

  /**
   * Resolves a path relative to the current directory.
   * @param {string} targetPath - The target path to resolve.
   * @returns {string} - The resolved absolute path.
   */
  resolvePath(targetPath: string): string {
    return this.shell.path.resolve(this.shell.currentDirectory, targetPath)
  }

  /**
   * Executes the command with the given arguments.
   * @param {Array<string>} args - The command arguments.
   * @returns {Promise<string>} - The output of the command.
   * @throws {Error} If the method is not implemented.
   */

  // biome-ignore lint/correctness/noUnusedVariables:
  async execute(args: string[]): Promise<string> {
    throw new Error('Execute method not implemented.')
  }

  /**
   * Retrieves the directories from the PATH environment variable based on the current OS.
   * @returns {Array<string>} - An array of directories to search for commands.
   */
  getSearchPaths(): string[] {
    const pathEnv = this.shell.environment.PATH || ''
    return pathEnv.split(process.platform === 'win32' ? ';' : ':')
  }

  /**
   * Sets up an isolate with a context and configured console.
   * @param {number} memoryLimit - Memory limit for the isolate in MB.
   * @returns {Promise<Object>} - An object containing the isolate, context, jail, output, and errorOutput.
   */
  async setupIsolate(memoryLimit = 128): Promise<{
    isolate: ivm.Isolate
    context: ivm.Context
    jail: ivm.Reference<Record<string, unknown>>
    output: string
    errorOutput: string
  }> {
    const isolate = new ivm.Isolate({ memoryLimit })

    const context = await isolate.createContext()

    const jail = context.global

    await jail.set('global', jail.derefInto())

    let output = ''
    let errorOutput = ''

    const consoleRef = {
      log: (...args: unknown[]) => {
        output += `${args.join(' ')}\n`
      },
      error: (...args: unknown[]) => {
        errorOutput += `${args.join(' ')}\n`
      },
    }

    await jail.set('console', new ivm.Reference(consoleRef))

    const fsMethods = [
      'readFile',
      'writeFile',
      'stat',
      'lstat',
      'readdir',
      'mkdir',
      'copyFile',
      'access',
    ] as const

    for (const method of fsMethods) {
      await jail.set(`fs_${method}`, new ivm.Reference(this.shell.fs[method].bind(this.shell.fs)))
    }

    const env: Record<string, string> = {}
    for (const key in this.shell.environment) {
      if (typeof this.shell.environment[key] === 'string') {
        env[key] = this.shell.environment[key]
      }
    }

    await jail.set('process', { argv: [], env: env }, { copy: true })

    return { isolate, context, jail, output, errorOutput }
  }
  /**
   * Executes a function within an isolate and handles output and errors.
   * @param {Function} func - The function to execute inside the isolate.
   * @param {Object} params - Parameters to pass to the function.
   * @param {number} timeout - Execution timeout in milliseconds.
   * @param {number} memoryLimit - Memory limit for the isolate in MB.
   * @returns {Promise<Object>} - An object containing stdout and stderr outputs.
   */
  async executeFunction(
    func: (...args: unknown[]) => unknown,
    params: Record<string, unknown> = {},
    timeout = 1000,
    memoryLimit = 128
  ): Promise<{ stdout: string; stderr: string }> {
    const { isolate, context, jail, output, errorOutput } = await this.setupIsolate(memoryLimit)

    try {
      await jail.set('params', new ivm.ExternalCopy(params).copyInto())

      const funcCode = func.toString()
      const code = `(${funcCode})(params);`

      const script = await isolate.compileScript(code)
      await script.run(context, { timeout })

      return { stdout: output.trim(), stderr: errorOutput.trim() }
    } catch (err) {
      return { stdout: output.trim(), stderr: err instanceof Error ? err.message : 'Unknown error' }
    } finally {
      isolate.dispose()
    }
  }

  /**
   * Retrieves the list of built-in commands available in the virtual shell.
   * @returns {Array<string>} - An array of built-in command names.
   */
  getBuiltInCommands(): string[] {
    return Object.keys(this.shell.commands || {})
  }
}
