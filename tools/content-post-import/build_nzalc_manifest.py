#!/usr/bin/env python3
"""Build an ALIFE ContentPost import manifest from the local NZALC static site."""

from __future__ import annotations

import argparse
import html
import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import unquote, urljoin, urlparse


PUBLIC_ORIGIN = "https://nzalc.org/"
ASSET_ORIGIN = "https://pages.nzalc.org/"
SLUG_OVERRIDES = {
    "2014-11-06-22-14-38/2014-02-09-21-26-28/28-4.html":
        "sermon-serving-like-jesus-4",
}
VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
SKIPPED_BODY_TAGS = {
    "script",
    "style",
    "noscript",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "svg",
    "math",
}
GLOBAL_ALLOWED_ATTRIBUTES = {"title", "lang", "dir"}
TAG_ALLOWED_ATTRIBUTES = {
    "a": {"href", "rel", "target"},
    "img": {"src", "alt", "width", "height", "loading"},
    "source": {"src", "type"},
    "table": {"border", "cellpadding", "cellspacing"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan", "scope"},
}
PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+?64[\s-]?)?(?:0?2\d)[\s-]?\d{3,4}[\s-]?\d{3,4}(?!\d)")
EMAIL_PATTERN = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
SENSITIVE_PATTERN = re.compile(
    r"(代[禱祷]|醫治|医治|病情|住院|身體需要|身体需要|癌|手術|手术|hospital|surgery)",
    re.IGNORECASE,
)
COMPACT_DATE_PATTERN = re.compile(r"(?<!\d)(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])(?!\d)")
SEPARATED_DATE_PATTERN = re.compile(
    r"(?<!\d)(20\d{2})\D{1,4}(0?[1-9]|1[0-2])\D{1,4}([0-2]?\d|3[01])(?!\d)"
)


@dataclass
class Node:
    tag: str
    attrs: list[tuple[str, str | None]] = field(default_factory=list)
    children: list[Node | str] = field(default_factory=list)

    def get_attr(self, name: str) -> str | None:
        name = name.lower()
        return next((value for key, value in self.attrs if key.lower() == name), None)

    def set_attr(self, name: str, value: str) -> None:
        lowered = name.lower()
        for index, (key, _) in enumerate(self.attrs):
            if key.lower() == lowered:
                self.attrs[index] = (key, value)
                return
        self.attrs.append((name, value))

    def remove_attr(self, name: str) -> None:
        lowered = name.lower()
        self.attrs = [(key, value) for key, value in self.attrs if key.lower() != lowered]

    def has_class(self, class_name: str) -> bool:
        return class_name in (self.get_attr("class") or "").split()


class StaticHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.root = Node("document")
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag.lower(), list(attrs))
        self.stack[-1].children.append(node)
        if tag.lower() not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.stack[-1].children.append(Node(tag.lower(), list(attrs)))

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == lowered:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        self.stack[-1].children.append(data)

    def handle_entityref(self, name: str) -> None:
        self.stack[-1].children.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.stack[-1].children.append(f"&#{name};")


@dataclass(frozen=True)
class CategorySource:
    relative_path: str
    category: str
    embedded: bool = False


CATEGORY_SOURCES = (
    CategorySource("2014-11-06-22-14-38/2014-02-06-22-15-18", "news"),
    CategorySource("2014-11-06-22-14-38/2014-02-09-21-26-28", "sermonOutline"),
    CategorySource("2014-02-09-21-31-48/2014-11-06-22-29-54", "testimony"),
    CategorySource("12-2014-01-06-03-35-04/2014-01-16-09-34-26", "general"),
    CategorySource("2014-02-09-21-31-48/2014-11-06-22-33-06.html", "learning", embedded=True),
)


def parse_html(value: str) -> Node:
    parser = StaticHtmlParser()
    parser.feed(value)
    parser.close()
    return parser.root


def walk(value: Node | str) -> Iterable[Node]:
    if isinstance(value, str):
        return
    yield value
    for child in value.children:
        yield from walk(child)


def find_first(root: Node, predicate) -> Node | None:
    return next((node for node in walk(root) if predicate(node)), None)


def text_content(value: Node | str) -> str:
    if isinstance(value, str):
        return html.unescape(value)
    if value.tag in SKIPPED_BODY_TAGS:
        return ""
    separator = "\n" if value.tag in {"br", "p", "div", "li", "tr", "h1", "h2", "h3", "h4"} else ""
    content = "".join(text_content(child) for child in value.children)
    return f"{separator}{content}{separator}"


def serialize(value: Node | str) -> str:
    if isinstance(value, str):
        return value
    if value.tag in SKIPPED_BODY_TAGS:
        return ""
    attrs = "".join(
        f' {name}="{html.escape(attribute, quote=True)}"' if attribute is not None else f" {name}"
        for name, attribute in value.attrs
    )
    if value.tag in VOID_TAGS:
        return f"<{value.tag}{attrs} />"
    return f"<{value.tag}{attrs}>{''.join(serialize(child) for child in value.children)}</{value.tag}>"


def is_noise_node(value: Node | str) -> bool:
    if isinstance(value, str):
        return not value.strip()
    if value.tag in {"h1", "h2"} and value.has_class("item-page-title"):
        return True
    if value.tag == "ul" and value.has_class("pager"):
        return True
    return value.has_class("item-separator") or value.has_class("clr")


def rewrite_links(
    content_nodes: list[Node | str],
    source_url: str,
    source_root: Path,
) -> tuple[list[str], list[str]]:
    media_urls: list[str] = []
    missing_media: list[str] = []
    for value in content_nodes:
        for node in walk(value):
            allowed = GLOBAL_ALLOWED_ATTRIBUTES | TAG_ALLOWED_ATTRIBUTES.get(node.tag, set())
            node.attrs = [
                (name, attribute)
                for name, attribute in node.attrs
                if name.lower() in allowed
            ]
            if node.tag in {"img", "source"}:
                source = node.get_attr("src")
                if source:
                    absolute = normalize_media_link(source_url, source)
                    if absolute:
                        node.set_attr("src", absolute)
                        media_urls.append(absolute)
                    else:
                        node.remove_attr("src")
            if node.tag == "a":
                target = node.get_attr("href")
                if target:
                    absolute = normalize_link(source_url, target)
                    if absolute:
                        node.set_attr("href", absolute)
                    else:
                        node.remove_attr("href")

    for media_url in dict.fromkeys(media_urls):
        parsed = urlparse(media_url)
        if parsed.hostname and parsed.hostname.lower() in {
            "nzalc.org",
            "www.nzalc.org",
            "pages.nzalc.org",
        }:
            local_path = source_root / unquote(parsed.path.lstrip("/"))
            if not local_path.is_file():
                missing_media.append(media_url)
    return list(dict.fromkeys(media_urls)), missing_media


def normalize_link(source_url: str, value: str) -> str | None:
    stripped = html.unescape(value).strip()
    if not stripped or stripped.startswith(("#", "data:", "javascript:", "mailto:", "tel:")):
        return None
    return urljoin(source_url, stripped)


def normalize_media_link(source_url: str, value: str) -> str | None:
    absolute = normalize_link(source_url, value)
    if absolute is None:
        return None

    parsed = urlparse(absolute)
    if parsed.hostname and parsed.hostname.lower() in {"nzalc.org", "www.nzalc.org"}:
        return parsed._replace(scheme="https", netloc=urlparse(ASSET_ORIGIN).netloc).geturl()
    return absolute


def extract_date(*values: str) -> str | None:
    joined = " ".join(values)
    for pattern in (COMPACT_DATE_PATTERN, SEPARATED_DATE_PATTERN):
        for match in pattern.finditer(joined):
            try:
                parsed = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            except ValueError:
                continue
            return f"{parsed.isoformat()}T00:00:00Z"
    return None


def summarize(node_values: list[Node | str], max_length: int = 500) -> str:
    text = re.sub(r"\s+", " ", "".join(text_content(value) for value in node_values)).strip()
    if len(text) <= max_length:
        return text
    shortened = text[: max_length + 1].rsplit(" ", 1)[0].rstrip("，。；、,:;")
    return f"{shortened}…"


def source_warnings(
    body_text: str,
    published_utc: str | None,
    missing_media: list[str],
) -> list[str]:
    warnings: list[str] = []
    if published_utc is None:
        warnings.append("missingPublishedUtc")
    if PHONE_PATTERN.search(body_text):
        warnings.append("possiblePhoneNumber")
    if EMAIL_PATTERN.search(body_text):
        warnings.append("possibleEmailAddress")
    if SENSITIVE_PATTERN.search(body_text):
        warnings.append("possibleSensitivePersonalData")
    warnings.extend(f"missingMedia:{value}" for value in missing_media)
    return warnings


def extract_detail(
    source_root: Path,
    file_path: Path,
    category: str,
) -> dict | None:
    root = parse_html(file_path.read_text(encoding="utf-8-sig", errors="replace"))
    item_page = find_first(root, lambda node: node.has_class("item-page"))
    if item_page is None:
        return None

    heading = find_first(
        item_page,
        lambda node: node.tag in {"h1", "h2"} and node.has_class("item-page-title"),
    )
    title_node = find_first(root, lambda node: node.tag == "title")
    title = re.sub(
        r"\s+",
        " ",
        text_content(heading or title_node or "").strip(),
    )
    if not title:
        return None

    content_nodes = [child for child in item_page.children if not is_noise_node(child)]
    recovered_empty_body = False
    if not content_nodes:
        content_nodes = [Node("p", children=[html.escape(title)])]
        recovered_empty_body = True
    relative_path = file_path.relative_to(source_root).as_posix()
    source_url = urljoin(PUBLIC_ORIGIN, relative_path)
    media_urls, missing_media = rewrite_links(content_nodes, source_url, source_root)
    body_html = "".join(serialize(child) for child in content_nodes).strip()
    body_text = re.sub(r"\s+", " ", "".join(text_content(child) for child in content_nodes)).strip()
    if not body_text:
        content_nodes = [Node("p", children=[html.escape(title)])]
        body_html = serialize(content_nodes[0])
        body_text = title
        recovered_empty_body = True

    author_meta = find_first(
        root,
        lambda node: node.tag == "meta" and (node.get_attr("name") or "").lower() == "author",
    )
    published_utc = extract_date(title, file_path.stem)
    slug = SLUG_OVERRIDES.get(
        relative_path,
        re.sub(r"^\d+-", "", file_path.stem).strip("-") or None,
    )
    warnings = source_warnings(body_text, published_utc, missing_media)
    if recovered_empty_body:
        warnings.append("emptyBodyRecoveredFromTitle")
    return {
        "sourceUrl": source_url,
        "title": {"zh": title},
        "summary": {"zh": summarize(content_nodes)},
        "body": {"zh": body_html},
        "category": category,
        "slug": slug,
        "coverImageUrl": media_urls[0] if media_urls else None,
        "byline": (author_meta.get_attr("content") or "").strip() if author_meta else None,
        "publishedUtc": published_utc,
        "sourceWarnings": warnings,
    }


def extract_embedded_learning(source_root: Path, file_path: Path) -> list[dict]:
    root = parse_html(file_path.read_text(encoding="utf-8-sig", errors="replace"))
    blog = find_first(root, lambda node: node.has_class("blog"))
    if blog is None:
        return []

    containers = [
        node
        for node in walk(blog)
        if node.has_class("leading") or (node.tag == "div" and node.has_class("item"))
    ]
    results: list[dict] = []
    relative_path = file_path.relative_to(source_root).as_posix()
    for item_index, container in enumerate(containers, start=1):
        heading = find_first(
            container,
            lambda node: node.tag in {"h1", "h2"} and node.has_class("item-page-title"),
        )
        if heading is None:
            continue
        title = re.sub(r"\s+", " ", text_content(heading).strip())
        content_nodes = [child for child in container.children if not is_noise_node(child)]
        content_nodes = [child for child in content_nodes if child is not heading]
        if not title or not content_nodes:
            continue

        source_url = f"{urljoin(PUBLIC_ORIGIN, relative_path)}?legacyItem={item_index}"
        media_urls, missing_media = rewrite_links(content_nodes, source_url, source_root)
        body_html = "".join(serialize(child) for child in content_nodes).strip()
        body_text = re.sub(r"\s+", " ", "".join(text_content(child) for child in content_nodes)).strip()
        if not body_text:
            continue
        published_utc = extract_date(title)
        results.append(
            {
                "sourceUrl": source_url,
                "title": {"zh": title},
                "summary": {"zh": summarize(content_nodes)},
                "body": {"zh": body_html},
                "category": "learning",
                "slug": None,
                "coverImageUrl": media_urls[0] if media_urls else None,
                "byline": None,
                "publishedUtc": published_utc,
                "sourceWarnings": source_warnings(body_text, published_utc, missing_media),
            }
        )
    return results


def build_manifest(source_root: Path) -> dict:
    resolved_root = source_root.resolve()
    if not (resolved_root / "index.html").is_file():
        raise ValueError(f"NZALC source root does not contain index.html: {resolved_root}")

    items: list[dict] = []
    scanned_files = 0
    skipped_files: list[str] = []
    category_counts: dict[str, int] = {}
    for source in CATEGORY_SOURCES:
        source_path = resolved_root / source.relative_path
        if source.embedded:
            scanned_files += 1
            extracted = extract_embedded_learning(resolved_root, source_path)
            items.extend(extracted)
            category_counts[source.category] = len(extracted)
            continue

        extracted_count = 0
        for file_path in sorted(source_path.glob("*.html")):
            scanned_files += 1
            item = extract_detail(resolved_root, file_path, source.category)
            if item is None:
                skipped_files.append(file_path.relative_to(resolved_root).as_posix())
                continue
            items.append(item)
            extracted_count += 1
        category_counts[source.category] = extracted_count

    warning_counts: dict[str, int] = {}
    for item in items:
        for warning in item["sourceWarnings"]:
            warning_code = warning.split(":", 1)[0]
            warning_counts[warning_code] = warning_counts.get(warning_code, 0) + 1

    return {
        "dryRun": True,
        "publish": False,
        "updateChanged": False,
        "items": items,
        "extractionReport": {
            "schemaVersion": 1,
            "sourceType": "nzalc-static",
            "sourceRoot": str(resolved_root),
            "generatedUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "scannedFileCount": scanned_files,
            "extractedItemCount": len(items),
            "skippedFileCount": len(skipped_files),
            "categoryCounts": category_counts,
            "warningCounts": warning_counts,
            "skippedFiles": skipped_files,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a dry-run ALIFE ContentPost import manifest from a local NZALC static repository."
    )
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    manifest = build_manifest(args.source_root)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    report = manifest["extractionReport"]
    print(
        f"Extracted {report['extractedItemCount']} items from "
        f"{report['scannedFileCount']} files; skipped {report['skippedFileCount']}."
    )
    print(f"Manifest: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
