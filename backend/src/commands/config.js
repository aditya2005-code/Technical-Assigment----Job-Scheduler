import * as configService from '../services/configService.js';

export function configSetAction(key, value) {
  try {
    configService.setConfig(key, value);
    console.log('✓ Configuration updated.');
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}

export function configGetAction(key) {
  try {
    if (key) {

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
