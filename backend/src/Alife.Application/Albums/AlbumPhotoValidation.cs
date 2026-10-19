using System.Buffers.Binary;
using System.IO.Compression;

namespace Alife.Application.Albums;

public static class AlbumPhotoValidation
{
    // Bounded structural validation; do not trust extension or client Content-Type.
    public static bool IsValid(byte[] bytes, string type)
    {
        ReadOnlySpan<byte> b = bytes;
        if (b.Length < 24 || b.Length > AlbumPhotoService.MaxBytes) return false;
        if (type == "image/png")
        {
            if (!b[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return false;
            var offset = 8;
            var data = false;
            long expected = 0;
            using var compressed = new MemoryStream();
            while (offset <= b.Length - 12)
            {
                var length = BinaryPrimitives.ReadUInt32BigEndian(b.Slice(offset, 4));
                if (length > b.Length - offset - 12) return false;
                var kind = b.Slice(offset + 4, 4);
                if (Crc(b.Slice(offset + 4, (int)length + 4)) != BinaryPrimitives.ReadUInt32BigEndian(b.Slice(offset + 8 + (int)length, 4))) return false;
                if (offset == 8 && (!kind.SequenceEqual("IHDR"u8) || length != 13 || !Dimensions(b.Slice(offset + 8, 8)))) return false;
                if (offset == 8)
                {
                    var depth = b[offset + 16];
                    var color = b[offset + 17];
                    if (b[offset + 18] != 0 || b[offset + 19] != 0 || b[offset + 20] > 1) return false;
                    var channels = color switch { 0 => 1, 2 => 3, 3 => 1, 4 => 2, 6 => 4, _ => 0 };
                    if (channels == 0 || depth is not (1 or 2 or 4 or 8 or 16) || color == 3 && depth == 16 || color is 2 or 4 or 6 && depth < 8) return false;
                    var w = (long)BinaryPrimitives.ReadUInt32BigEndian(b.Slice(offset + 8, 4));
                    var h = (long)BinaryPrimitives.ReadUInt32BigEndian(b.Slice(offset + 12, 4));
                    if (b[offset + 20] == 0) expected = h * (1 + (w * channels * depth + 7) / 8);
                    else
                    {
                        int[] xs = [0, 4, 0, 2, 0, 1, 0], ys = [0, 0, 4, 0, 2, 0, 1], dx = [8, 8, 4, 4, 2, 2, 1], dy = [8, 8, 8, 4, 4, 2, 2];
                        for (var pass = 0; pass < 7; pass++)
                        {
                            var pw = Math.Max(0, (w - xs[pass] + dx[pass] - 1) / dx[pass]);
                            var ph = Math.Max(0, (h - ys[pass] + dy[pass] - 1) / dy[pass]);
                            if (pw > 0) expected += ph * (1 + (pw * channels * depth + 7) / 8);
                        }
                    }
                }
                if (kind.SequenceEqual("IDAT"u8) && length > 0) { data = true; compressed.Write(b.Slice(offset + 8, (int)length)); }
                offset += (int)length + 12;
                if (kind.SequenceEqual("IEND"u8))
                {
                    if (!data || length != 0 || offset != b.Length) return false;
                    try
                    {
                        compressed.Position = 0;
                        using var decoder = new ZLibStream(compressed, CompressionMode.Decompress);
                        var buffer = new byte[8192]; long decoded = 0; int count;
                        while ((count = decoder.Read(buffer)) > 0) { decoded += count; if (decoded > expected) return false; }
                        return decoded == expected;
                    }
                    catch (InvalidDataException) { return false; }
                }
            }
            return false;
        }
        if (type == "image/webp") return ValidWebp(b);
        if (type != "image/jpeg" || b[0] != 255 || b[1] != 216 || b[^2] != 255 || b[^1] != 217) return false;
        var p = 2;
        var frame = false;
        while (p < b.Length - 4)
        {
            if (b[p++] != 255) return false;
            while (p < b.Length && b[p] == 255) p++;
            if (p >= b.Length) return false;
            var marker = b[p++];
            if (marker == 218) return frame; // Entropy data is decoded by the browser before upload.
            if (p > b.Length - 2) return false;
            var length = BinaryPrimitives.ReadUInt16BigEndian(b.Slice(p, 2));
            if (length < 2 || length > b.Length - p) return false;
            if (marker is 192 or 193 or 194)
            {
                if (length < 8) return false;
                var h = BinaryPrimitives.ReadUInt16BigEndian(b.Slice(p + 3, 2));
                var w = BinaryPrimitives.ReadUInt16BigEndian(b.Slice(p + 5, 2));
                if (w == 0 || h == 0 || (long)w * h > 40_000_000) return false;
                frame = true;
            }
            p += length;
        }
        return false;
    }

    private static bool Dimensions(ReadOnlySpan<byte> b)
    {
        var w = BinaryPrimitives.ReadUInt32BigEndian(b[..4]);
        var h = BinaryPrimitives.ReadUInt32BigEndian(b[4..8]);
        return w > 0 && h > 0 && (ulong)w * h <= 40_000_000;
    }

    private static uint Crc(ReadOnlySpan<byte> bytes)
    {
        uint crc = 0xffffffff;
        foreach (var value in bytes)
        {
            crc ^= value;
            for (var bit = 0; bit < 8; bit++) crc = (crc >> 1) ^ ((crc & 1) == 1 ? 0xedb88320u : 0);
        }
        return crc ^ 0xffffffff;
    }

    private static bool ValidWebp(ReadOnlySpan<byte> b)
    {
        if (!b[..4].SequenceEqual("RIFF"u8) || !b.Slice(8, 4).SequenceEqual("WEBP"u8) || BinaryPrimitives.ReadUInt32LittleEndian(b.Slice(4, 4)) != b.Length - 8) return false;
        var offset = 12; var image = false;
        while (offset <= b.Length - 8)
        {
            var size = BinaryPrimitives.ReadUInt32LittleEndian(b.Slice(offset + 4, 4));
            if (size > b.Length - offset - 8) return false;
            var kind = b.Slice(offset, 4); var payload = b.Slice(offset + 8, (int)size);
            if (kind.SequenceEqual("VP8 "u8))
            {
                if (size < 10 || !payload.Slice(3, 3).SequenceEqual(new byte[] { 157, 1, 42 })) return false;
                var w = BinaryPrimitives.ReadUInt16LittleEndian(payload.Slice(6, 2)) & 16383;
                var h = BinaryPrimitives.ReadUInt16LittleEndian(payload.Slice(8, 2)) & 16383;
                if (w == 0 || h == 0 || (long)w * h > 40_000_000) return false;
                image = true;
            }
            if (kind.SequenceEqual("VP8L"u8))
            {
                if (size < 5 || payload[0] != 47) return false;
                var bits = BinaryPrimitives.ReadUInt32LittleEndian(payload.Slice(1, 4));
                if ((long)((bits & 16383) + 1) * (((bits >> 14) & 16383) + 1) > 40_000_000) return false;
                image = true;
            }
            offset += 8 + (int)size + ((int)size & 1);
        }
        return image && offset == b.Length;
    }
}
