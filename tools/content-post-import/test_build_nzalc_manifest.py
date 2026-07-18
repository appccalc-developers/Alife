import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("build_nzalc_manifest.py")
SPEC = importlib.util.spec_from_file_location("build_nzalc_manifest", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class BuildNzalcManifestTests(unittest.TestCase):
    def test_detail_extracts_item_page_and_rewrites_local_image(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = root / "news" / "123-2019-02-03-church-news.html"
            image = root / "images" / "photo.jpg"
            path.parent.mkdir(parents=True)
            image.parent.mkdir(parents=True)
            image.write_bytes(b"image")
            (root / "index.html").write_text("<html></html>", encoding="utf-8")
            path.write_text(
                """
                <html><head>
                  <meta name="author" content="Editor" />
                  <title>Fallback title</title>
                </head><body>
                  <div class="item-page">
                    <h1 class="item-page-title">2019 02 03 教会消息</h1>
                    <p onclick="bad()"><script>alert(1)</script>
                      <img src="../../images/photo.jpg" style="float:left" />
                      <a href="../../learning.html">学习资料</a>正文内容 021 234 5678
                    </p>
                    <ul class="pager"><li>noise</li></ul>
                  </div>
                </body></html>
                """,
                encoding="utf-8",
            )

            item = MODULE.extract_detail(root, path, "news")

            self.assertEqual("2019 02 03 教会消息", item["title"]["zh"])
            self.assertEqual("2019-02-03T00:00:00Z", item["publishedUtc"])
            self.assertEqual("Editor", item["byline"])
            self.assertEqual(
                "https://pages.nzalc.org/images/photo.jpg",
                item["coverImageUrl"],
            )
            self.assertIn('src="https://pages.nzalc.org/images/photo.jpg"', item["body"]["zh"])
            self.assertIn('href="https://nzalc.org/learning.html"', item["body"]["zh"])
            self.assertNotIn("noise", item["body"]["zh"])
            self.assertNotIn("onclick", item["body"]["zh"])
            self.assertNotIn("alert(1)", item["body"]["zh"])
            self.assertNotIn("style=", item["body"]["zh"])
            self.assertIn("possiblePhoneNumber", item["sourceWarnings"])

    def test_embedded_learning_articles_receive_distinct_source_urls(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = root / "learning.html"
            (root / "index.html").write_text("<html></html>", encoding="utf-8")
            path.write_text(
                """
                <html><body><div class="blog">
                  <div class="items-leading"><div class="leading">
                    <h2 class="item-page-title">第一课</h2><p>第一课正文</p>
                  </div></div>
                  <div class="items-row"><div class="item">
                    <h2 class="item-page-title">第二课</h2><p>第二课正文</p>
                  </div></div>
                </div></body></html>
                """,
                encoding="utf-8",
            )

            items = MODULE.extract_embedded_learning(root, path)

            self.assertEqual(2, len(items))
            self.assertNotEqual(items[0]["sourceUrl"], items[1]["sourceUrl"])
            self.assertEqual("learning", items[0]["category"])
            self.assertIn("missingPublishedUtc", items[0]["sourceWarnings"])

    def test_title_only_article_is_preserved_with_review_warning(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = root / "news" / "180-cancelled.html"
            path.parent.mkdir(parents=True)
            (root / "index.html").write_text("<html></html>", encoding="utf-8")
            path.write_text(
                """
                <html><head><title>聚会取消</title></head><body>
                  <div class="item-page">
                    <h1 class="item-page-title">聚会取消</h1>
                  </div>
                </body></html>
                """,
                encoding="utf-8",
            )

            item = MODULE.extract_detail(root, path, "news")

            self.assertEqual("<p>聚会取消</p>", item["body"]["zh"])
            self.assertIn("emptyBodyRecoveredFromTitle", item["sourceWarnings"])

    def test_known_numeric_slug_collision_uses_reviewed_override(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = (
                root
                / "2014-11-06-22-14-38"
                / "2014-02-09-21-26-28"
                / "28-4.html"
            )
            path.parent.mkdir(parents=True)
            path.write_text(
                """
                <html><body><div class="item-page">
                  <h1 class="item-page-title">以耶稣的榜样来服事（4）</h1>
                  <p>讲章正文</p>
                </div></body></html>
                """,
                encoding="utf-8",
            )

            item = MODULE.extract_detail(root, path, "sermonOutline")

            self.assertEqual("sermon-serving-like-jesus-4", item["slug"])


if __name__ == "__main__":
    unittest.main()
