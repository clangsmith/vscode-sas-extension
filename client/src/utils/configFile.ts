// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { existsSync, readFileSync, writeFileSync } from 'fs';

/**
 * ConfigFile is a configuration file manager that supports marshaling
 * a generic interface.
 */
export class ConfigFile<T> {
  protected value: T | undefined;

  constructor(
    private readonly filename: string,
    private readonly defaultValue: () => T) {
    this.getSync();
  }

  /**
   * Retreives the configuration {@link T}
   * 
   * @param reload {@link Boolean} reloads file before returning {@link T}
   * @returns Promise<T>
   */
  async get(reload = false): Promise<T> {
    return this.getSync(reload);
  }

  /**
   * Synchronous get with optional reload if value is already set 
   * @param reload {@link Boolean} reloading configuration file
   * @returns T
   */
  getSync(reload = false): T {
    if (this.value && !reload) {
      return this.value;
    }

    // if file exists, parse and set value
    if (existsSync(this.filename)) {
      const text = readFileSync(this.filename, 'utf-8');
      this.value = JSON.parse(text);
      return this.value;
    }

    // if file does not exist, set default and 
    // update, which in turn creates the file.
    this.updateSync(this.defaultValue());
    return this.value;
  }

  /**
   * Marshal's configuration file based on the T value
   * @param value 
   */
  async update(value: T): Promise<void> {
    this.updateSync(value);
  }

  /**
  * Marshal's configuration file based on the T value
  * @param value
  */
  updateSync(value: T): void {
    this.value = value;
    const text = JSON.stringify(this.value, undefined, 2);
    writeFileSync(this.filename, text);
  }
}