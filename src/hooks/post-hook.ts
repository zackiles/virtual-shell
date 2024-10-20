export default class PostHook {
  hooks: Map<string, ((...args: unknown[]) => unknown)[]>

  constructor() {
    this.hooks = new Map()
  }

  /**
   * Registers a post-hook for a specific command.
   * @param {string} commandName - The name of the command.
   * @param {Function} hookFunction - The function to execute as a post-hook.
   */
  register(commandName: string, hookFunction: (...args: unknown[]) => unknown): void {
    if (!this.hooks.has(commandName)) {
      this.hooks.set(commandName, [])
    }
    this.hooks.get(commandName)?.push(hookFunction)
  }

  /**
   * Runs the post-hooks for a specific command.
   * @param {string} commandName - The name of the command.
   * @param {Array<string>} args - The arguments for the command.
   * @param {string} output - The output of the command.
   * @returns {Promise<void>}
   */
  async run(commandName: string, args: string[], output: string): Promise<void> {
    const hooks = this.hooks.get(commandName)
    if (hooks) {
      for (const hook of hooks) {
        await hook([...args], output)
      }
    }
  }
}
