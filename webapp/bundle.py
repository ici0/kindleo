#!/usr/bin/env python3
"""
Single-file webapp bundler for Kindleo.

Merges HTML, CSS, JS, and SVG assets into a standalone HTML file.
Simple but smart - handles all asset types and optional data embedding.

Usage:
    python bundle.py                    # Bundle index.html
    python bundle.py sprint.html        # Bundle sprint.html
    python bundle.py -d data.json       # Embed data inline
    python bundle.py -o output.html     # Custom output name
"""

import os
import re
import sys
import json
import base64
import argparse
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()


def read_file(path):
    """Read file contents, return empty string if not found."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Warning: File not found: {path}")
        return ''


def svg_to_data_uri(svg_content):
    """Convert SVG content to a data URI."""
    # Clean up SVG - remove extra whitespace but keep it valid
    svg_clean = svg_content.strip()
    # URL-encode for data URI (base64 is simpler and more reliable)
    b64 = base64.b64encode(svg_clean.encode('utf-8')).decode('ascii')
    return f'data:image/svg+xml;base64,{b64}'


def inline_css(html, css_path):
    """Replace <link rel="stylesheet" href="..."> with inline <style>."""
    css_content = read_file(css_path)
    if not css_content:
        return html

    # Match link tags pointing to stylesheet
    pattern = r'<link\s+rel=["\']stylesheet["\']\s+href=["\'][^"\']*["\'][^>]*>'
    replacement = f'<style>\n{css_content}</style>'
    return re.sub(pattern, replacement, html)


def json_for_js(json_str):
    """Make JSON safe for embedding in <script> tags.

    JSON allows some characters that break JavaScript:
    - U+2028 LINE SEPARATOR (valid JSON, invalid JS string literal)
    - U+2029 PARAGRAPH SEPARATOR (valid JSON, invalid JS string literal)
    - </script> would close the script tag prematurely
    """
    return (json_str
        .replace('\u2028', '\\u2028')
        .replace('\u2029', '\\u2029')
        .replace('</script>', '<\\/script>')
        .replace('</Script>', '<\\/Script>')
        .replace('</SCRIPT>', '<\\/SCRIPT>'))


def inline_js(html, js_path, embedded_data=None):
    """Replace <script src="..."> with inline <script>."""
    js_content = read_file(js_path)
    if not js_content:
        return html

    # If we have embedded data, modify CONFIG to use it
    if embedded_data:
        # Make JSON safe for JS embedding
        safe_data = json_for_js(embedded_data)
        # Add embedded data and modify CONFIG to use null paths
        data_script = f'var EMBEDDED_DATA = {safe_data};\n\n'
        # Modify the JS to use embedded data
        js_content = data_script + js_content
        # Replace LOCAL_PATH with null and add embedded data loading
        js_content = re.sub(
            r"LOCAL_PATH:\s*'[^']*'",
            "LOCAL_PATH: null",
            js_content
        )
        # Modify _loadLocal to use EMBEDDED_DATA
        js_content = js_content.replace(
            'xhr.open(\'GET\', CONFIG.LOCAL_PATH, true);',
            '''if (typeof EMBEDDED_DATA !== 'undefined' && EMBEDDED_DATA) {
            self._processDictionary(EMBEDDED_DATA);
            callback();
            return;
        }
        xhr.open('GET', CONFIG.LOCAL_PATH, true);'''
        )

    # Match script tags with src attribute
    pattern = r'<script\s+src=["\'][^"\']*["\'][^>]*>\s*</script>'
    # Use lambda to avoid backslash interpretation in replacement string
    return re.sub(pattern, lambda m: f'<script>\n{js_content}\n</script>', html)


def inline_svgs(html, base_dir):
    """Replace <img src="*.svg"> with inline data URIs."""
    def replace_svg(match):
        src = match.group(1)
        # Handle relative paths
        if not src.startswith(('http://', 'https://', 'data:')):
            svg_path = base_dir / src
            svg_content = read_file(svg_path)
            if svg_content:
                data_uri = svg_to_data_uri(svg_content)
                return match.group(0).replace(src, data_uri)
        return match.group(0)

    # Match img tags with svg src
    pattern = r'<img[^>]+src=["\']([^"\']+\.svg)["\'][^>]*>'
    return re.sub(pattern, replace_svg, html)


def bundle(html_file, output_file=None, data_file=None):
    """Bundle HTML with all its assets into a single file."""
    base_dir = SCRIPT_DIR
    html_path = base_dir / html_file

    if not html_path.exists():
        print(f"Error: HTML file not found: {html_path}")
        sys.exit(1)

    print(f"Bundling: {html_file}")
    html = read_file(html_path)

    # Load embedded data if provided
    embedded_data = None
    if data_file:
        data_path = Path(data_file)
        if not data_path.is_absolute():
            data_path = base_dir / data_file
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            # Re-serialize to ensure proper escaping (newlines, quotes, etc.)
            embedded_data = json.dumps(data, ensure_ascii=False)
            print(f"  + Embedding data: {data_file}")
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Warning: Could not load data file: {e}")

    # Inline CSS
    css_path = base_dir / 'style.css'
    if css_path.exists():
        html = inline_css(html, css_path)
        print(f"  + Inlined: style.css")

    # Inline JS
    js_path = base_dir / 'script.js'
    if js_path.exists():
        html = inline_js(html, js_path, embedded_data)
        print(f"  + Inlined: script.js")

    # Inline SVGs
    html = inline_svgs(html, base_dir)
    print(f"  + Inlined: SVG assets")

    # Determine output filename
    if not output_file:
        stem = Path(html_file).stem
        output_file = f'{stem}.bundle.html'

    output_path = base_dir / output_file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    # Report size
    original_size = sum(
        os.path.getsize(base_dir / f)
        for f in [html_file, 'style.css', 'script.js']
        if (base_dir / f).exists()
    )
    bundle_size = os.path.getsize(output_path)

    print(f"\nOutput: {output_file}")
    print(f"Size: {bundle_size:,} bytes (original assets: {original_size:,} bytes)")

    return output_path


def main():
    parser = argparse.ArgumentParser(
        description='Bundle webapp into a single HTML file',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python bundle.py                     # Bundle index.html -> index.bundle.html
  python bundle.py sprint.html         # Bundle sprint.html -> sprint.bundle.html
  python bundle.py -d words.json       # Embed vocabulary data
  python bundle.py -o kindle.html      # Custom output filename
'''
    )
    parser.add_argument(
        'html',
        nargs='?',
        default='index.html',
        help='HTML file to bundle (default: index.html)'
    )
    parser.add_argument(
        '-o', '--output',
        help='Output filename (default: <input>.bundle.html)'
    )
    parser.add_argument(
        '-d', '--data',
        help='JSON data file to embed (enables offline mode)'
    )

    args = parser.parse_args()
    bundle(args.html, args.output, args.data)


if __name__ == '__main__':
    main()
