/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-disable no-await-in-loop */

/**
 * @typedef ExtractedFields
 * @property {string} level log level (see LOG_LEVEL_MAPPING)
 * @property {string} message message extracted
 * @property {string} requestId optional request id
 * @property {string} timestamp optional timestamp
 */

/**
 * Message extractors for AWS messages.
 */
const MESSAGE_EXTRACTORS = [
  {
    pattern: /^INIT_START (?<text>[\s\S]+)\n$/,
    extract: ({ groups: { text } }) => ({
      message: `INIT_START ${text}`,
      level: 'DEBUG',
    }),
  },
  {
    pattern: /^(?<phase>START|END|REPORT) RequestId: (?<requestId>[0-9a-f-]{36})(?<text>[\s\S]+)?\n$/,
    extract: ({ groups: { phase, requestId, text } }) => {
      const segments = text?.split('\t') || [];
      let level = 'DEBUG';
      if (phase === 'REPORT') {
        const status = segments.find((segment) => segment.startsWith('Status: '));
        if (status) {
          level = 'ERROR';
        }
      }
      return {
        message: `${phase}${segments.join('\t')}`,
        requestId,
        level,
      };
    },
  },
  {
    /* AWS uses this format to report unexpected errors */
    pattern: /^RequestId: (?<requestId>[0-9a-f-]{36}) Error: (?<text>[\s\S]+)\n$/,
    extract: ({ groups: { requestId, text } }) => ({
      message: text,
      requestId,
      level: 'ERROR',
    }),
  },
  {
    /* standard extractor corresponding to pattern [timestamp=*Z, request_id="*-*", event] */
    pattern: /^(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\t(?<requestId>[0-9a-f-]{36})\t(?<text>[\s\S]+)\n$/,
    extract: ({ groups: { timestamp, requestId, text } }) => {
      const segments = text.split('\t');
      const message = segments.pop();
      if (segments.length === 0) {
        if (message.startsWith('Task timed out')) {
          return {
            level: 'ERROR', message, requestId, timestamp,
          };
        }
        return {
          level: 'INFO', message, requestId, timestamp,
        };
      }
      const level = segments.pop();
      return {
        level, message, requestId, timestamp,
      };
    },
  },
];

/**
 * Extract fields from log event, either by using `extractedFields` available with
 * filter pattern from CloudWatch, or by manually extracting using regular expressions.
 *
 * @param {LogEvent} logEvent log event
 * @returns {ExtractedFields} extracted fields or `null`
 */
export function extractFields(logEvent) {
  const { extractedFields } = logEvent;
  if (extractedFields) {
    let [level, message] = extractedFields.event.split('\t');
    if (message === undefined) {
      [level, message] = (['INFO', level]);
    }
    return {
      level,
      message,
      requestId: extractedFields.request_id,
      timestamp: extractedFields.timestamp,
    };
  }
  for (const { pattern, extract } of MESSAGE_EXTRACTORS) {
    const match = logEvent.message.match(pattern);
    if (match) {
      return extract(match);
    }
  }
  return null;
}
