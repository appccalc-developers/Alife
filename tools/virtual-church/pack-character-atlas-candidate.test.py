"""No-dependency regression checks for offline native-encoder eligibility."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("atlas_pack", Path(__file__).with_name("pack-character-atlas-candidate.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class UnmorphedAtlasTests(unittest.TestCase):
    def setUp(self):
        self.doc = {"materials": [{"name": "N00_007_01_Tops_01_CLOTH_01 (Instance)",
                                  "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}}}],
                    "textures": [{"source": 0}], "images": [{"name": "Alife_Outfit_Atlas_Candidate"}]}
        self.primitive = {"material": 0, "attributes": {"TEXCOORD_0": 0, "TEXCOORD_1": 1}}

    def test_known_png_and_webp_outfit(self):
        self.assertTrue(module.supports_unmorphed_atlas(self.doc, self.primitive))
        self.doc["textures"][0] = {"extensions": {"EXT_texture_webp": {"source": 0}}}
        self.assertTrue(module.supports_unmorphed_atlas(self.doc, self.primitive))

    def test_original_cloth_texture_is_not_an_atlas(self):
        self.doc["images"][0]["name"] = "original"
        self.assertFalse(module.supports_unmorphed_atlas(self.doc, self.primitive))

    def test_missing_secondary_uv_is_rejected(self):
        del self.primitive["attributes"]["TEXCOORD_1"]
        self.assertFalse(module.supports_unmorphed_atlas(self.doc, self.primitive))

    def test_skin_and_missing_cloth_texture_are_rejected(self):
        self.doc["materials"][0]["name"] = "Face_00_SKIN (Instance)"
        self.assertFalse(module.supports_unmorphed_atlas(self.doc, self.primitive))
        self.doc["materials"][0]["name"] = "Tops_CLOTH (Instance)"
        del self.doc["materials"][0]["pbrMetallicRoughness"]
        self.assertFalse(module.supports_unmorphed_atlas(self.doc, self.primitive))

    def test_existing_face_candidates_remain_supported(self):
        for name in ("FaceBrow_00_FACE", "FaceMouth_00_FACE", "EyeWhite_00_EYE"):
            self.doc["materials"][0]["name"] = name
            self.assertTrue(module.supports_unmorphed_atlas(self.doc, self.primitive))


if __name__ == "__main__":
    unittest.main()
