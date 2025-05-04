/**
 * This component is adapted from the Zero Email project.
 * Source: https://github.com/Mail-0/Zero
 *
 * MIT License
 * Copyright (c) 2025 Zero Email
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useEffect, useState } from 'react';

export function PixelatedBackground(props: SVGProps<SVGSVGElement>) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return (
    <svg
      width="1440"
      height="447"
      viewBox="0 0 1440 447"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      style={{
        opacity: isDarkMode ? 0.7 : 0.5,
        mixBlendMode: isDarkMode ? 'multiply' : 'screen',
      }}
      {...props}
    >
      <title>Pixelated Background</title>
      <g mask="url(#mask0_11_932)">
        <rect
          width="1438.5"
          height="446.149"
          transform="matrix(1 0 0 -1 0 446.149)"
          fill="url(#pattern0_11_932)"
        />
      </g>
      <defs>
        <pattern id="pattern0_11_932" patternContentUnits="objectBoundingBox" width="1" height="1">
          <use xlinkHref="#image0_11_932" transform="scale(0.000570125 0.00183824)" />
        </pattern>
        <image
          id="image0_11_932"
          width="1754"
          height="544"
          preserveAspectRatio="none"
          xlinkHref="data:image/png;省略部分+4X6QnFUL+WjOBqX4lxxaX5qHNXr3OPUmrvz0Zp01+HKT+2fmu/Kl/8Dm7Xnfqt6W5YAAAAASUVORK5CYII="
        />
      </defs>
    </svg>
  );
}
