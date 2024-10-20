import path from 'node:path'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import EventEmitter from 'node:events'
import { createFsFromVolume, Volume, type fs as memfs } from 'memfs'
import shellQuote, { type ParseEntry } from 'shell-quote'
import BaseCommand from './commands/base-command'
import PreHook from './hooks/pre-hook'
import PostHook from './hooks/post-hook'
import { ERROR_MESSAGES, type VirtualShellOptions } from './types'

/**
 * VirtualShell class represents a fully virtualized Unix-like shell
 * for AI agents using Node.js. It handles command execution,
 * command registration, and file system interactions.
 */
class VirtualShell extends EventEmitter {
  public path: typeof path
  public currentDirectory: string
  public user: string
  public environment: typeof process.env
  public commands: Record<string, BaseCommand>
  public preHook: PreHook
  public postHook: PostHook
  public fs: typeof memfs.promises
  private volume: InstanceType<typeof Volume>

  /**
   * Constructs a VirtualShell instance with the specified options.
   * @param options VirtualShellOptions to initialize the shell with.
   */
  constructor(options: VirtualShellOptions = {}) {
    super()
    this.path = path.posix
    this.currentDirectory = options.currentDirectory || '/'
    this.user = options.user || 'guest'
    this.environment = process.env
    this.commands = {}
    this.preHook = new PreHook()
    this.postHook = new PostHook()

    this.volume = options.serializedVolume
      ? this.deserializeVolume(options.serializedVolume)
      : new Volume()
    this.fs = createFsFromVolume(this.volume).promises

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const commandsDir = path.resolve(__dirname, 'commands')
    this.importCommandModules(readdirSync(commandsDir))

    Object.assign(this, options)
  }

  /**
   * Executes a command in the shell.
   * @param command The command string to execute.
   * @returns A promise resolving to the command execution result.
   */
  async executeCommand(command: string): Promise<string> {
    if (this.isInvalidCommand(command)) {
      return this.stderr(ERROR_MESSAGES.NO_COMMAND('bash'))
    }

    const { commandInput, redirectionOperator, targetFile } = this.extractRedirection(command)
    const args: ParseEntry[] = shellQuote.parse(commandInput)

    const commandName: string = typeof args[0] === 'string' ? args[0] : ''
    const commandArgs: string[] = args
      .slice(1)
      .map((arg) => {
        if (typeof arg === 'string') {
          return arg
        }
        if (typeof arg === 'object' && 'op' in arg) {
          if (arg.op === 'glob') {
            return arg.pattern
          }
          return arg.op
        }
        return ''
      })
      .filter((arg) => arg !== '')

    if (!commandName) {
      return this.stderr(ERROR_MESSAGES.NO_COMMAND('bash'))
    }

    if (!(commandName in this.commands)) {
      return this.stderr(ERROR_MESSAGES.ERR_CMD_NOT_FOUND(commandName))
    }

    try {
      await this.preHook.run(commandName, commandArgs)
      const commandInstance = this.commands[commandName]

      if (!commandInstance) {
        return this.stderr(ERROR_MESSAGES.ERR_CMD_NOT_FOUND(commandName))
      }

      const output = await commandInstance.execute(commandArgs)
      await this.postHook.run(commandName, commandArgs, output)

      return redirectionOperator && targetFile
        ? this.processRedirection(output, redirectionOperator, targetFile, commandName)
        : output
    } catch (err) {
      const errorMessage = (err as Error).message || ERROR_MESSAGES.ERR_UNKNOWN
      return this.stderr(errorMessage)
    }
  }

  /**
   * Validates the command input.
   * @param command The command string to validate.
   * @returns True if the command is invalid, otherwise false.
   */
  isInvalidCommand(command: string): boolean {
    return typeof command !== 'string' || command.trim() === ''
  }

  /**
   * Extracts the command input, redirection operator, and target file from the command string.
   * @param command The command string to extract from.
   * @returns An object containing the command input, redirection operator, and target file.
   */
  extractRedirection(command: string): {
    commandInput: string
    redirectionOperator: string | null
    targetFile: string | null
  } {
    const redirectionMatch = command.match(/(.*?)(\s*(?:>>|>)\s*(\S+))$/)
    let commandInput = command
    let redirectionOperator: string | null = null
    let targetFile: string | null = null

    if (redirectionMatch) {
      commandInput = redirectionMatch[1]?.trim() || command
      const redirectionDetails = redirectionMatch[2]?.trim().split(/\s+/) || []
      redirectionOperator = redirectionDetails[0] || null
      targetFile = redirectionDetails[1] || null
    }
    return { commandInput, redirectionOperator, targetFile }
  }

  /**
   * Processes output redirection based on the specified operator and target file.
   * @param output The output to redirect.
   * @param operator The redirection operator.
   * @param targetFile The target file for redirection.
   * @param commandName The name of the command being executed.
   * @returns A promise resolving to the command execution result.
   */
  async processRedirection(
    output: string,
    operator: string,
    targetFile: string,
    commandName: string
  ): Promise<string> {
    const filePath = this.path.resolve(this.currentDirectory, targetFile)

    try {
      await this.fs.access(filePath, this.fs.constants.W_OK)
    } catch {
      return this.stderr(ERROR_MESSAGES.ERR_PERMISSION_DENIED(filePath))
    }

    try {
      if (operator === '>') {
        await this.fs.writeFile(filePath, `${output}\n`)
      } else if (operator === '>>') {
        await this.fs.appendFile(filePath, `${output}\n`)
      } else {
        return this.stderr(ERROR_MESSAGES.ERR_INVALID_OPERATOR(operator))
      }
      return this.stdout('')
    } catch (err) {
      const errorMessage = (err as Error).message || ERROR_MESSAGES.ERR_UNKNOWN
      return this.stderr(`${commandName}: ${errorMessage}`)
    }
  }

  /**
   * Imports command modules from the specified files.
   * @param files An array of file names to import.
   */
  async importCommandModules(files: string[]): Promise<void> {
    for (const file of files) {
      if (!file.endsWith('.js')) {
        continue
      }

      const commandName = file.replace('-command.js', '').toLowerCase()
      const commandPath = path.resolve('commands', file)
      const module = await import(`file://${commandPath}`)
      const CommandClass = Object.values(module).find((exported) => typeof exported === 'function')

      if (CommandClass && this.isValidCommand(CommandClass)) {
        this.registerCommand(
          commandName,
          new (CommandClass as { new (options: { shell: VirtualShell }): BaseCommand })({
            shell: this,
          })
        )
      } else {
        throw new Error(ERROR_MESSAGES.ERR_INVALID_COMMAND_CLASS(commandPath))
      }
    }
  }

  /**
   * Validates if a command class is a valid command.
   * @param CommandClass The command class to validate.
   * @returns True if the command class is valid, otherwise false.
   */
  isValidCommand(CommandClass: unknown): boolean {
    return (
      typeof CommandClass === 'function' &&
      Object.getPrototypeOf(CommandClass) === Function.prototype &&
      Object.prototype.isPrototypeOf.call(BaseCommand, CommandClass.prototype)
    )
  }

  /**
   * Retrieves a list of built-in commands.
   * @returns An array of built-in command names.
   */
  getBuiltInCommands(): string[] {
    return Object.keys(this.commands)
  }

  /**
   * Registers a command with the specified name and instance.
   * @param name The name of the command.
   * @param commandInstance The instance of the command to register.
   */
  registerCommand(name: string, commandInstance: BaseCommand): void {
    this.commands[name] = commandInstance
  }

  /**
   * Deserializes a volume from a serialized string representation.
   * @param serializedVolume The serialized volume string.
   * @returns The deserialized volume instance.
   */
  deserializeVolume(serializedVolume: string): InstanceType<typeof Volume> {
    this.volume.reset()
    this.volume = Volume.fromJSON(JSON.parse(serializedVolume))
    this.fs = createFsFromVolume(this.volume).promises
    return this.volume
  }

  /**
   * Serializes the current volume to a string representation.
   * @returns The serialized volume string.
   */
  serializeVolume(): string {
    return JSON.stringify(this.volume.toJSON())
  }

  /**
   * Emits a standard output message and logs it to the console.
   * @param message The message to output.
   * @returns The formatted shell message.
   */
  stdout(message: string): string {
    const shellMessage = `bash: ${message}`
    console.debug(shellMessage)
    this.emit('stdout', shellMessage)
    return shellMessage
  }

  /**
   * Emits a standard error message and logs it to the console.
   * @param message The error message to output.
   * @returns The formatted shell error message.
   */
  stderr(message: string): string {
    const shellErrorMessage = `bash: ${message}`
    console.debug(shellErrorMessage)
    this.emit('stderr', shellErrorMessage)
    return shellErrorMessage
  }

  /**
   * Changes the current directory to the specified path.
   * @param newPath The new directory path.
   * @returns A promise resolving to the current directory path.
   */
  async changeDirectory(newPath: string): Promise<string> {
    const targetPath = this.path.resolve(this.currentDirectory, newPath)
    try {
      const stats = await this.fs.lstat(targetPath)
      if (stats.isDirectory()) {
        this.currentDirectory = targetPath
        return this.currentDirectory
      }
      return ERROR_MESSAGES.ERR_NOT_A_DIRECTORY(newPath)
    } catch {
      return ERROR_MESSAGES.ERR_NO_SUCH_DIRECTORY(newPath)
    }
  }
}

export default VirtualShell
