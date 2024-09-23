/* eslint-disable @typescript-eslint/consistent-indexed-object-style */

import React from 'react';

interface ChunkHandlers {
  [key: string]: (content: string) => JSX.Element;
};

export default function rich(message: string, handlers: ChunkHandlers): JSX.Element {
  // Helper function to parse the message and replace custom XML/HTML tags with provided handlers
  const parseMessage = (str: string): (JSX.Element | string)[] => {
    const regex = /<([\w]+)>(.*?)<\/\1>/gi; // Regex to match opening and closing tags
    const result: (JSX.Element | string)[] = [];
    let lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(str)) !== null) {
      const fullMatch: string = match[0]; // Full match of the regex
      const tag: string = match[1] ?? '';       // Extracted tag (e.g., 'aip')
      const content: string = match[2] ?? '';   // Content inside the tag
      const startIndex = match.index;

      // Add the text before the current match
      if (startIndex > lastIndex) {
        result.push(str.slice(lastIndex, startIndex));
      }

      // Check if the tag has a handler
      if (handlers[tag]) {
        result.push(handlers[tag](content));
      } else {
        // If no handler is found, keep the original content
        result.push(fullMatch);
      }

      lastIndex = regex.lastIndex;
    }

    // Add any remaining text after the last match
    if (lastIndex < str.length) {
      result.push(str.slice(lastIndex));
    }

    return result;
  };

  // Parse and return the message as JSX elements
  return <>{parseMessage(message).map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>)}</>;
}
