/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
import assert from 'assert';
import util from 'util';
import zlib from 'zlib';
import { Request } from '@adobe/fetch';
import { main } from '../src/index.js';
import { Nock } from './utils.js';

const gzip = util.promisify(zlib.gzip);

describe('Index Tests', () => {
  let nock;
  beforeEach(() => {
    nock = new Nock();
  });

  afterEach(() => {
    nock.done();
  });

  it('invokes index without payload', async () => {
    const resp = await main(new Request('https://localhost/'), {
      invocation: {
        event: {},
      },
      func: {
        app: 'my-app',
      },
      env: {},
    });
    assert.strictEqual(resp.status, 204);
  });

  it('invokes index with payload', async () => {
    const payload = 'H4sIAAFPWWMAA92WS2/bMAzH7/0UQc51QlKiROVWYGmxw7ZDe1pTFIqtpAYSJ7OdNkPR7z45rz62AgnaDth8ksCHqD9/oHx/1Ipfexqqyo/Dxc95aPda7U8nFyfXX/rn5ydn/fbx2mV2V4SyMSKKVmwMoXZb42Q2Pitni3lj7/q7qjvx02Hmuzdhki+TKpS3eRqqJMmLLCxjmsew87oMftrEERB1EbrE3Utj1JVYG0ZG+5DZVLMBMZkGj1kw6LWk6TZJtRhWaZnP63xWnOaTOpRVTHe5Mq4cNocmTx3bK/PVYx3921DUzwPvd6t1mqypUlk0IgrYoGU2UQjUBqyQdUhaIWpCg+IAxLHRwspFM2yV2mWr86h57aeNZGiMsSAA7IRe+G06sxUoQUiIL1D3yPQ0d2LA90GN3mvnCJPUDSXRgGniRsonIyInzg+FgQf156+n3wZ1Oit9vG++7LVGk0V1kxfjFrbmociaVRl+LGJdVafTGRQvaw7LuvRpHbLTPEyyRqznEq2dGiGbct963CrbxuF6Lf4+9/xTlqdivypj+1ncw273cLwvEUopcSJMyoJiIGTWAmgF2ZEWJEUKrRW2ELd7EWGA1SFEmA4wvgMR8FuLWtmsCB8Ixd4n/j0u1mK+lQvTdFwp5Dg4kYUYnVgyBhxqceSs5mZSRHBiuzXqfbjAmEsO4IKxEwMiF5lFZ0MKCXqkqJTNElGpTtg3I8t7TjX8D5Nin3seTsRGxrcT4WKflbEkBBxfiPi6WbSKHVojSki0Fgsa4jMYzS/RfYUI4gOJILbvQMS/NSk+jItGzFe5WP9sHD0c/QIdNIXebwkAAA==';
    nock('https://api.coralogix.com')
      .post('/api/v1/logs')
      .reply((_, body) => {
        // eslint-disable-next-line no-param-reassign
        delete body.computerName;
        assert.deepStrictEqual(body, {
          applicationName: 'my-app',
          logEntries: [{
            timestamp: 1666708005982,
            text: JSON.stringify({
              inv: {
                functionName: 'indexer',
                requestId: '1aa49921-c9b8-401c-9f3a-f22989ab8505',
              },
              message: 'coralogix: flushing 1 pending requests...\n',
              level: 'info',
              timestamp: '2022-10-25T14:26:45.982Z',
            }),
            severity: 3,
          }, {
            timestamp: 1666708006053,
            text: JSON.stringify({
              inv: {
                functionName: 'indexer',
                requestId: '1aa49921-c9b8-401c-9f3a-f22989ab8505',
              },
              message: 'coralogix: flushing 0 pending requests done.\n',
              level: 'info',
              timestamp: '2022-10-25T14:26:46.051Z',
            }),
            severity: 3,
          }, {
            timestamp: 1666708011188,
            text: JSON.stringify({
              inv: {
                functionName: 'indexer',
                requestId: 'd7197ec0-1a12-407d-83c4-5a8900aa5c40',
              },
              message: 'coralogix: flushing 1 pending requests...\n',
              level: 'info',
              timestamp: '2022-10-25T14:26:51.188Z',
            }),
            severity: 3,
          }, {
            timestamp: 1666708011258,
            text: JSON.stringify({
              inv: {
                functionName: 'indexer',
                requestId: 'd7197ec0-1a12-407d-83c4-5a8900aa5c40',
              },
              message: 'coralogix: flushing 0 pending requests done.\n',
              level: 'info',
              timestamp: '2022-10-25T14:26:51.257Z',
            }),
            severity: 3,
          }],
          privateKey: 'foo-id',
          subsystemName: 'helix-services',
        });
        return [200];
      });

    const resp = await main(new Request('https://localhost/'), {
      invocation: {
        event: {
          awslogs: {
            data: payload,
          },
        },
      },
      func: {
        app: 'my-app',
      },
      env: {
        CORALOGIX_API_KEY: 'foo-id',
      },
    });
    assert.strictEqual(resp.status, 200, await resp.text());
  });

  it('returns error when posting fails', async () => {
    const payload = (await gzip(JSON.stringify({
      logEvents: [{
        timestamp: Date.now(),
        extractedFields: {
          event: 'INFO\tmessage\n',
        },
      }],
      logGroup: '/aws/lambda/services--func',
    }))).toString('base64');

    nock('https://api.coralogix.com/api/v1/')
      .post('/logs')
      .replyWithError('that went wrong');

    const resp = await main(new Request('https://localhost/'), {
      invocation: {
        event: {
          awslogs: {
            data: payload,
          },
        },
      },
      func: {
        app: 'my-app',
      },
      env: {
        CORALOGIX_API_KEY: 'foo-id',
      },
    });

    assert.strictEqual(resp.status, 500);
    assert.strictEqual(
      await resp.text(),
      'Failed to send logs with status 500: that went wrong',
    );
  });
});
