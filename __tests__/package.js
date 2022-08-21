/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

const osjs = require('osjs');
const path = require('path');
const Package = require('../src/package.js');

describe('Package', () => {
  let core;
  let pkg;

  beforeAll(() => osjs().then(c => (core = c)));
  afterAll(() => core.destroy());

  test('#constructor', () => {
    const filename = path.resolve(core.configuration.root, 'packages/JestTest/metadata.json');
    const metadata = require(filename);

    pkg = new Package(core, {
      filename,
      metadata
    });
  });

  test('#init', () => {
    return expect(pkg.init())
      .resolves
      .toBe(undefined);
  });

  test('#validate', () => {
    const manifest = require(
      path.resolve(core.configuration.public, 'metadata.json')
    );

    expect(pkg.validate(manifest))
      .toBe(true);

    expect(pkg.validate([]))
      .toBe(false);
  });

  test('#start', () => {
    expect(pkg.start())
      .toBe(true);
  });

  test('#action', () => {
    expect(pkg.action('init'))
      .toBe(true);

    expect(pkg.action('invalid'))
      .toBe(false);

    expect(pkg.action('test'))
      .toBe(false);
  });

  test('#resource', () => {
    expect(pkg.resource('test'))
      .toBe('/apps/JestTest/test');

    expect(pkg.resource('/test'))
      .toBe('/apps/JestTest/test');
  });

  test('#watch', () => {
    expect(pkg.watch(jest.fn()))
      .toBe(path.resolve(core.configuration.public, 'apps/JestTest'));
  });

  test('#destroy', async () => {
    await pkg.destroy();
  });
});
