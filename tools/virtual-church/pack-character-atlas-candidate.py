"""Offline candidate packaging using an existing Pillow or Blender toolchain.

No import/re-export of the rig or animations. Source and destination must differ.
Draco output still requires independent decoder/error verification before use.
"""
import argparse
import ctypes as ct
import io
import json
from pathlib import Path
import struct


def supports_unmorphed_atlas(doc, primitive):
    """Allow only known atlas groups; never accept arbitrary raw meshes."""
    if "TEXCOORD_1" not in primitive["attributes"]:
        return False
    material = doc["materials"][primitive["material"]]
    name = material.get("name", "")
    if any(group in name for group in ("FaceBrow_00_FACE", "FaceMouth_00_FACE", "EyeWhite_00_EYE")):
        return True
    if "_CLOTH" not in name:
        return False
    texture_index = material.get("pbrMetallicRoughness", {}).get("baseColorTexture", {}).get("index")
    if texture_index is None:
        return False
    texture = doc["textures"][texture_index]
    image_index = texture.get("source", texture.get("extensions", {}).get("EXT_texture_webp", {}).get("source"))
    return image_index is not None and doc["images"][image_index].get("name") == "Alife_Outfit_Atlas_Candidate"


def pack(source, *, lossless_webp=False, draco_dll=None):
    assert source[:4] == b"glTF" and struct.unpack_from("<I", source, 4)[0] == 2
    assert struct.unpack_from("<I", source, 8)[0] == len(source)
    size = struct.unpack_from("<I", source, 12)[0]
    doc = json.loads(source[20:20 + size])
    binary = bytearray(source[28 + size:])
    assert len(doc["buffers"]) == 1 and "uri" not in doc["buffers"][0]
    report = {"runtimeReleaseAllowed": False, "images": [], "primitives": []}

    def append(data):
        binary.extend(b"\0" * (-len(binary) % 4))
        index = len(doc["bufferViews"])
        doc["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
        binary.extend(data)
        return index

    if lossless_webp:
        from PIL import Image
        targets = [(i, image) for i, image in enumerate(doc["images"])
                   if image.get("name") in ("Alife_Outfit_Atlas_Candidate", "Alife_FaceLines_Atlas_Candidate", "Alife_FaceOpaque_Atlas_Candidate", "Alife_Skin_Atlas_Candidate")
                   and image.get("mimeType") == "image/png"]
        assert len(targets) == 1
        for index, image in targets:
            assert image["mimeType"] == "image/png"
            view = doc["bufferViews"][image["bufferView"]]
            data = bytes(binary[view.get("byteOffset", 0):view.get("byteOffset", 0) + view["byteLength"]])
            original = Image.open(io.BytesIO(data)).convert("RGBA")
            result = io.BytesIO()
            # exact=True retains RGB under alpha=0; otherwise mip edges can change.
            original.save(result, format="WEBP", lossless=True, exact=True, method=6)
            encoded = result.getvalue()
            decoded = Image.open(io.BytesIO(encoded)).convert("RGBA")
            assert original.size == decoded.size and original.tobytes() == decoded.tobytes()
            image["bufferView"] = append(encoded)
            image["mimeType"] = "image/webp"
            for texture in doc["textures"]:
                if texture.get("source") == index:
                    del texture["source"]
                    texture.setdefault("extensions", {})["EXT_texture_webp"] = {"source": index}
            for key in ("extensionsUsed", "extensionsRequired"):
                doc[key] = list(dict.fromkeys(doc.get(key, []) + ["EXT_texture_webp"]))
            report["images"].append({"originalBytes": len(data), "bytes": len(encoded), "rgbaExact": True})

    if draco_dll:
        dll = ct.CDLL(str(Path(draco_dll).resolve(strict=True)))
        signatures = {
            "encoderCreate": (ct.c_void_p, [ct.c_uint32]),
            "encoderRelease": (None, [ct.c_void_p]),
            "encoderSetCompressionLevel": (None, [ct.c_void_p, ct.c_uint32]),
            "encoderSetQuantizationBits": (None, [ct.c_void_p] + [ct.c_uint32] * 5),
            "encoderSetIndices": (None, [ct.c_void_p, ct.c_size_t, ct.c_uint32, ct.c_void_p]),
            "encoderSetAttribute": (ct.c_uint32, [ct.c_void_p, ct.c_char_p, ct.c_size_t, ct.c_char_p, ct.c_void_p, ct.c_bool]),
            "encoderEncode": (ct.c_bool, [ct.c_void_p, ct.c_uint8]),
            "encoderGetEncodedVertexCount": (ct.c_uint32, [ct.c_void_p]),
            "encoderGetEncodedIndexCount": (ct.c_uint32, [ct.c_void_p]),
            "encoderGetByteLength": (ct.c_uint64, [ct.c_void_p]),
            "encoderCopy": (None, [ct.c_void_p, ct.c_void_p]),
        }
        for name, (restype, argtypes) in signatures.items():
            getattr(dll, name).restype = restype
            getattr(dll, name).argtypes = argtypes
        widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
        component_bytes = {5121: 1, 5123: 2, 5125: 4, 5126: 4}

        def accessor_bytes(index):
            accessor = doc["accessors"][index]
            assert "sparse" not in accessor and "bufferView" in accessor
            view = doc["bufferViews"][accessor["bufferView"]]
            width = widths[accessor["type"]] * component_bytes[accessor["componentType"]]
            stride = view.get("byteStride", width)
            start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            data = b"".join(binary[start + i * stride:start + i * stride + width]
                            for i in range(accessor["count"]))
            assert len(data) == accessor["count"] * width
            return accessor, ct.create_string_buffer(data)

        for mesh in doc["meshes"]:
            for primitive in mesh["primitives"]:
                if "KHR_draco_mesh_compression" in primitive.get("extensions", {}):
                    continue
                assert primitive.get("mode", 4) == 4
                assert primitive.get("targets") or supports_unmorphed_atlas(doc, primitive), "Unknown unmorphed raw primitive"
                vertices = doc["accessors"][primitive["attributes"]["POSITION"]]["count"]
                encoder = dll.encoderCreate(vertices)
                assert encoder
                buffers, ids = [], {}
                try:
                    for name, index in primitive["attributes"].items():
                        accessor, data = accessor_bytes(index)
                        assert accessor["count"] == vertices
                        buffers.append(data)
                        ids[name] = dll.encoderSetAttribute(encoder, name.encode(), accessor["componentType"],
                                                           accessor["type"].encode(), data, accessor.get("normalized", False))
                    indices, data = accessor_bytes(primitive["indices"])
                    buffers.append(data)
                    dll.encoderSetIndices(encoder, indices["componentType"], indices["count"], data)
                    dll.encoderSetCompressionLevel(encoder, 7)
                    dll.encoderSetQuantizationBits(encoder, 20, 20, 20, 20, 24)
                    # Morph target vertex ordering must not change.
                    assert dll.encoderEncode(encoder, 1)
                    assert dll.encoderGetEncodedVertexCount(encoder) == vertices
                    assert dll.encoderGetEncodedIndexCount(encoder) == indices["count"]
                    length = dll.encoderGetByteLength(encoder)
                    output = (ct.c_uint8 * length)()
                    dll.encoderCopy(encoder, output)
                    primitive.setdefault("extensions", {})["KHR_draco_mesh_compression"] = {
                        "bufferView": append(bytes(output)), "attributes": ids}
                    for index in [*primitive["attributes"].values(), primitive["indices"]]:
                        doc["accessors"][index].pop("bufferView", None)
                        doc["accessors"][index].pop("byteOffset", None)
                    report["primitives"].append({"vertices": vertices, "indices": indices["count"],
                                                  "bytes": length, "preserveTriangleOrder": True,
                                                  "independentDecodeVerified": False})
                finally:
                    dll.encoderRelease(encoder)
        assert len(report["primitives"]) == 1
        for key in ("extensionsUsed", "extensionsRequired"):
            doc[key] = list(dict.fromkeys(doc.get(key, []) + ["KHR_draco_mesh_compression"]))

    doc["buffers"][0]["byteLength"] = len(binary)
    binary.extend(b"\0" * (-len(binary) % 4))
    text = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode()
    text += b" " * (-len(text) % 4)
    result = struct.pack("<5I", 0x46546C67, 2, 28 + len(text) + len(binary), len(text), 0x4E4F534A)
    result += text + struct.pack("<2I", len(binary), 0x004E4942) + binary
    return result, report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--lossless-webp", action="store_true")
    parser.add_argument("--draco-dll")
    args = parser.parse_args()
    source = args.input.resolve(strict=True)
    parent = args.output.parent.resolve(strict=True)
    root = Path("C:/Data/Alife/Temp").resolve(strict=True)
    assert parent != root and parent.is_relative_to(root)
    target = parent / args.output.name
    assert target != source and (args.lossless_webp or args.draco_dll)
    output, report = pack(source.read_bytes(), lossless_webp=args.lossless_webp, draco_dll=args.draco_dll)
    with target.open("xb") as stream:
        stream.write(output)
    print(json.dumps({"output": str(target), **report}, indent=2))
