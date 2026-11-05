import io
import os
import shutil
import zipfile

MAX_UNZIPPED_BYTES = 1024**3  # 1 GB


def extract_upload(data: bytes, dest: str, max_bytes: int = MAX_UNZIPPED_BYTES) -> str:
    """Unpack an uploaded zip into dest and return the folder to index.

    zipfile already drops absolute and ../ paths, so entries can't land outside dest.
    """
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        # zipfile writes at most each entry's declared size, so this caps zip bombs
        if sum(info.file_size for info in zf.infolist()) > max_bytes:
            raise ValueError("Zip is larger than 1 GB unpacked")
        zf.extractall(dest)

    shutil.rmtree(os.path.join(dest, "__MACOSX"), ignore_errors=True)

    # Zipping a folder gives one top-level dir; index what's inside it
    entries = os.listdir(dest)
    if len(entries) == 1 and os.path.isdir(os.path.join(dest, entries[0])):
        return os.path.join(dest, entries[0])
    return dest


if __name__ == "__main__":
    import tempfile

    def make_zip(files):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            for name, body in files.items():
                zf.writestr(name, body)
        return buf.getvalue()

    with tempfile.TemporaryDirectory() as tmp:
        # Folder zip (macOS style) -> unwrapped to the inner folder
        d = os.path.join(tmp, "a")
        root = extract_upload(make_zip({"proj/main.py": "x", "__MACOSX/proj/._main.py": "junk"}), d)
        assert root == os.path.join(d, "proj") and os.listdir(root) == ["main.py"]

        # Loose files -> indexed in place
        d = os.path.join(tmp, "b")
        assert extract_upload(make_zip({"main.py": "x", "lib/util.py": "y"}), d) == d

        # ../ and absolute paths stay inside dest
        d = os.path.join(tmp, "c")
        extract_upload(make_zip({"../escape.py": "x", "/abs.py": "y"}), d)
        assert not os.path.exists(os.path.join(tmp, "escape.py"))
        assert sorted(os.listdir(d)) == ["abs.py", "escape.py"]

        # Over the size cap
        try:
            extract_upload(make_zip({"big.txt": "x" * 100}), os.path.join(tmp, "d"), max_bytes=10)
            raise AssertionError("expected ValueError")
        except ValueError:
            pass

    print("upload_zip checks ok")
