/**
 * commands/config.js — CLI handlers for config commands
 *
 * Responsibilities:
 *   - Registers Commander actions for get and set sub-commands.
 *   - Handles CLI presentation and formatted prints.
 */

import * as configService from '../services/configService.js';

/**
 * Handles `queuectl config set <key> <value>` CLI command.
 *
 * @param {string} key
 * @param {string} value
 */
export function configSetAction(key, value) {
  try {
    configService.setConfig(key, value);
    console.log('✓ Configuration updated.');
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handles `queuectl config get [key]` CLI command.
 * If key is provided, prints only its value.
 * Otherwise, lists all configuration keys and values.
 *
 * @param {string} [key]
 */
export function configGetAction(key) {
  try {
    if (key) {
      // Validate that the key exists/is allowed before fetching
      configService.validateConfig(key, 1);
      const value = configService.getConfig(key);
      console.log(value);
      return;
    }

    const configs = configService.getAllConfig();
    console.log('Configuration');
    console.log('------------------------');
    for (const conf of configs) {
      console.log(`${conf.key} : ${conf.value}`);
    }
    console.log('--------------------------------');
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
